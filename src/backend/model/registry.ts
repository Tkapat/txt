import fs from "node:fs/promises";
import path from "node:path";
import { pipeline, env } from "@huggingface/transformers";
import { ApiError } from "@/backend/http/errors";
import type { ModelKey } from "@/shared/types";
import {
  DOCUMENT_MODEL_DIR,
  MODELS_DIR,
  REVIEW_MODEL_DIR,
  SCORE_BATCH_SIZE,
} from "@/backend/config";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = MODELS_DIR;

type Row = { label: string; score: number };
type Classifier = (
  inputs: string[],
  opts?: { top_k?: number | null },
) => Promise<Row[] | Row[][]>;

const globalCache = globalThis as unknown as {
  __txtModels?: Map<ModelKey, Promise<Classifier>>;
};
const cache = (globalCache.__txtModels ??= new Map());

export function getClassifier(key: ModelKey): Promise<Classifier> {
  if (!cache.has(key)) {
    const classifier = pipeline("text-classification", key, { dtype: "q8" })
      .then((p) => p as unknown as Classifier)
      .catch((error: unknown) => {
        cache.delete(key);
        throw error;
      });
    cache.set(key, classifier);
  }
  return cache.get(key)!;
}

const modelDirs: Record<ModelKey, string> = {
  review: REVIEW_MODEL_DIR,
  document: DOCUMENT_MODEL_DIR,
};

const readyCache = new Map<ModelKey, Promise<boolean>>();

export function clearClassifierCache(): void {
  cache.clear();
  readyCache.clear();
}

export function isModelReady(key: ModelKey): Promise<boolean> {
  const cached = readyCache.get(key);
  if (cached) return cached;
  const check = modelReady(modelDirs[key]).then((ready) => {
    if (!ready) readyCache.delete(key);
    return ready;
  });
  readyCache.set(key, check);
  return check;
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
  batch = SCORE_BATCH_SIZE,
): Promise<number[]> {
  if (texts.length === 0) return [];
  await requireModel(key);
  const clf = await getClassifier(key);
  const out: number[] = [];
  for (let i = 0; i < texts.length; i += batch) {
    const res = await clf(texts.slice(i, i + batch), { top_k: null });
    const rows = (Array.isArray(res) && Array.isArray(res[0])
      ? res
      : [res]) as Row[][];
    for (const row of rows) {
      const labels = Array.isArray(row) ? row : [row];
      const ai = labels.find((l) => l.label.toLowerCase() === "ai");
      if (!ai) {
        throw new Error(
          `Model "${key}" has no 'ai' label: ${JSON.stringify(labels)}`,
        );
      }
      if (!Number.isFinite(ai.score)) {
        throw new Error(`Model "${key}" returned a non-finite score`);
      }
      out.push(ai.score);
    }
  }
  return out;
}

async function modelReady(dir: string): Promise<boolean> {
  try {
    await Promise.all([
      fs.access(path.join(dir, "config.json")),
      fs.access(path.join(dir, "tokenizer.json")),
      fs.access(path.join(dir, "onnx", "model_quantized.onnx")),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function modelsInstalled(): Promise<boolean> {
  const [review, document] = await Promise.all([
    isModelReady("review"),
    isModelReady("document"),
  ]);
  return review && document;
}

export async function warmup(): Promise<void> {
  if (!(await modelsInstalled())) {
    console.info(
      "Model warmup skipped: models/review or models/document is missing.",
    );
    return;
  }
  await scoreBatch("review", [
    "warm up the review model with a short sentence.",
  ]);
  await scoreBatch("document", [
    "warm up the document model with a short sentence.",
  ]);
}
