import { ApiError } from "@/backend/http/errors";
import type { ModelKey } from "@/shared/types";
import type { ModelMeta } from "@/backend/model/meta";
import { ML_SERVICE_URL, ML_TIMEOUT_MS } from "@/backend/config";

type MetaEntry = { value: ModelMeta; at: number };

type GlobalCache = {
  __txtModelMeta?: Map<ModelKey, MetaEntry>;
};

const globalCache = globalThis as unknown as GlobalCache;

const META_TTL_MS = 60_000;

function metaCache(): Map<ModelKey, MetaEntry> {
  return (globalCache.__txtModelMeta ??= new Map());
}

async function callService<T>(route: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ML_SERVICE_URL}${route}`, {
      ...init,
      signal: AbortSignal.timeout(ML_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(
      "model_unavailable",
      "The detection model service is unreachable.",
      503,
    );
  }
  if (!response.ok) {
    throw new ApiError(
      "model_unavailable",
      "The detection model is not ready.",
      503,
    );
  }
  return response.json() as Promise<T>;
}

export async function getModelMeta(key: ModelKey): Promise<ModelMeta> {
  const cache = metaCache();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < META_TTL_MS) return cached.value;
  const meta = await callService<ModelMeta>(`/meta/${key}`);
  cache.set(key, { value: meta, at: Date.now() });
  return meta;
}

export const getReviewMeta = (): Promise<ModelMeta> => getModelMeta("review");

export function clearClassifierCache(): void {
  metaCache().clear();
}

export async function isModelReady(key: ModelKey): Promise<boolean> {
  try {
    const health = await callService<{
      models?: Record<string, { ready?: boolean }>;
    }>("/health");
    return health.models?.[key]?.ready === true;
  } catch {
    return false;
  }
}

export async function requireModel(key: ModelKey): Promise<void> {
  if (!(await isModelReady(key))) {
    throw new ApiError(
      "model_unavailable",
      `The ${key} detection model is not installed yet.`,
      503,
    );
  }
}

export async function scoreBatch(
  key: ModelKey,
  texts: string[],
): Promise<number[]> {
  if (texts.length === 0) return [];
  const result = await callService<{ probabilities?: number[] }>("/score", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts, model: key }),
  });
  const probabilities = result.probabilities;
  if (!Array.isArray(probabilities) || probabilities.length !== texts.length) {
    throw new ApiError(
      "model_unavailable",
      "The model service returned an invalid response.",
      503,
    );
  }
  for (const value of probabilities) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new ApiError(
        "model_unavailable",
        "The model service returned an invalid score.",
        503,
      );
    }
  }
  return probabilities;
}

export async function modelsStatus(): Promise<{
  review: boolean;
  document: boolean;
}> {
  const [review, document] = await Promise.all([
    isModelReady("review"),
    isModelReady("document"),
  ]);
  return { review, document };
}

export async function modelsInstalled(): Promise<boolean> {
  const status = await modelsStatus();
  return status.review && status.document;
}

export async function warmup(): Promise<void> {
  for (const key of ["review", "document"] as const) {
    try {
      await scoreBatch(key, [
        `warm up the ${key} model with a short sentence.`,
      ]);
    } catch (error) {
      console.info(`${key} model warmup skipped:`, (error as Error).message);
    }
  }
}
