import type {
  DocumentResult,
  ModelKey,
  TextResult,
  Warning,
} from "@/shared/types";
import {
  MAX_TEXT_CHARS,
  MIN_WORDS_WARN,
  REVIEW_MAX_WORDS,
} from "@/shared/constants";
import { ApiError } from "@/backend/http/errors";
import { normalizeText, countWords } from "@/backend/text";
import { loadJson, type ModelMeta } from "@/backend/model/meta";
import { requireModel } from "@/backend/model/registry";
import { extractFeatures } from "@/backend/detector/features";
import { scoreReviewTexts } from "@/backend/detector/score";
import { toConfidence, toVerdict } from "@/backend/detector/verdict";
import type { Sty } from "@/backend/detector/stylometric";
import { topCues } from "@/backend/explain/cues";
import { topEvidence } from "@/backend/explain/evidence";
import { scoreAsDocument } from "./detectDocument";

async function scoreAsReview(
  text: string,
  wordCount: number,
  warnings: Warning[],
): Promise<TextResult> {
  const meta = await loadJson<ModelMeta>("review-meta");
  const stylometric = await loadJson<Sty>("stylometric");
  const features = extractFeatures(text);
  const [aiProbability] = await scoreReviewTexts([text]);

  return {
    aiProbability,
    verdict: toVerdict(aiProbability, meta.thresholds),
    confidence: toConfidence(aiProbability, meta.thresholds, wordCount),
    wordCount,
    model: "review",
    modelVersion: meta.version,
    warnings,
    evidence:
      aiProbability >= meta.thresholds.low
        ? await topEvidence(text, scoreReviewTexts)
        : [],
    cues: topCues(features, stylometric.human_mean, stylometric.human_std),
  };
}

export async function detectText(
  raw: string,
  forced?: ModelKey,
): Promise<TextResult | DocumentResult> {
  if (raw.length > MAX_TEXT_CHARS) {
    throw new ApiError(
      "too_large",
      `Max text length is ${MAX_TEXT_CHARS} characters.`,
      413,
    );
  }

  const text = normalizeText(raw);
  const wordCount = countWords(text);
  if (wordCount === 0) {
    throw new ApiError("empty_text", "No readable words found.", 422);
  }

  const warnings: Warning[] = ["detector_not_proof"];
  if (wordCount < MIN_WORDS_WARN) warnings.push("short_text");

  const model =
    forced ?? (wordCount > REVIEW_MAX_WORDS ? "document" : "review");
  await requireModel(model);
  return model === "review"
    ? scoreAsReview(text, wordCount, warnings)
    : scoreAsDocument(text, wordCount, warnings);
}
