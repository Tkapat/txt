import path from "node:path";

export const MODELS_DIR = path.join(process.cwd(), "models");
export const META_DIR = path.join(MODELS_DIR, "meta");
export const REVIEW_MODEL_DIR = path.join(MODELS_DIR, "review");
export const DOCUMENT_MODEL_DIR = path.join(MODELS_DIR, "document");

export const RATE_LIMIT = {
  text: { limit: 30, windowMs: 60_000 },
  file: { limit: 10, windowMs: 60_000 },
  reviews: { limit: 20, windowMs: 60_000 },
} as const;

export const SCORE_BATCH_SIZE = 8;
