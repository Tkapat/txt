import path from "node:path";

export const MODELS_DIR = path.join(process.cwd(), "models");
export const META_DIR = path.join(MODELS_DIR, "meta");

export const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000";
export const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 90_000);

export const RATE_LIMIT = {
  text: { limit: 30, windowMs: 60_000 },
  file: { limit: 10, windowMs: 60_000 },
  reviews: { limit: 20, windowMs: 60_000 },
} as const;
