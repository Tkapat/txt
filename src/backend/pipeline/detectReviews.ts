import type {
  ReviewInput,
  ReviewScore,
  ReviewsReport,
  Warning,
} from "@/shared/types";
import {
  MAX_REVIEWS,
  MAX_TEXT_CHARS,
  MIN_WORDS_REVIEW,
} from "@/shared/constants";
import { ApiError } from "@/backend/http/errors";
import { countWords, normalizeText } from "@/backend/text";
import { getReviewMeta, requireModel } from "@/backend/model/registry";
import { toVerdict } from "@/backend/detector/verdict";
import { estimatePrevalence } from "@/backend/analyzers/prevalence";
import { groupSignals } from "@/backend/analyzers/groupSimilarity";
import { topEvidence } from "@/backend/explain/evidence";
import { scoreReviewTexts } from "@/backend/detector/score";

export async function detectReviews(
  input: ReviewInput[],
): Promise<ReviewsReport> {
  if (input.length > MAX_REVIEWS) {
    throw new ApiError(
      "too_many",
      `Max ${MAX_REVIEWS} reviews per request.`,
      413,
    );
  }
  if (input.length === 0) {
    throw new ApiError("empty_text", "No reviews found.", 422);
  }
  if (input.some((review) => review.text.length > MAX_TEXT_CHARS)) {
    throw new ApiError(
      "too_large",
      `Each review must be at most ${MAX_TEXT_CHARS} characters.`,
      413,
    );
  }

  await requireModel("review");
  const meta = await getReviewMeta();
  const items = input.map((review, index) => ({
    id: review.id ?? String(index + 1),
    text: normalizeText(review.text),
  }));
  const usable = items.filter(
    (item) => countWords(item.text) >= MIN_WORDS_REVIEW,
  );
  const probabilities = await scoreReviewTexts(usable.map((item) => item.text));

  const reviews: ReviewScore[] = usable.map((item, index) => ({
    id: item.id,
    aiProbability: probabilities[index],
    flagged: probabilities[index] >= meta.thresholds.high,
    verdict: toVerdict(probabilities[index], meta.thresholds),
    wordCount: countWords(item.text),
  }));

  const flaggedCount = reviews.filter((review) => review.flagged).length;
  const ranked = usable
    .map((item, index) => ({ review: reviews[index], text: item.text }))
    .filter(({ review }) => review.flagged)
    .sort((a, b) => b.review.aiProbability - a.review.aiProbability)
    .slice(0, 5);

  const evidence = (
    await Promise.all(
      ranked.map(async ({ review, text }) => {
        const phrases = await topEvidence(text, scoreReviewTexts, 1);
        return phrases.map((phrase) => ({ ...phrase, reviewId: review.id }));
      }),
    )
  )
    .flat()
    .slice(0, 5);

  const groups = groupSignals(usable.map((item) => item.text));
  const warnings: Warning[] = [
    "detector_not_proof",
    ...(usable.length < 20 ? (["short_text"] as Warning[]) : []),
  ];

  return {
    total: items.length,
    analyzed: usable.length,
    skippedShort: items.length - usable.length,
    flaggedCount,
    prevalence: estimatePrevalence(
      flaggedCount,
      usable.length,
      meta.sensitivity_unseen,
      meta.specificity,
    ),
    topEvidence: evidence,
    groupSignals: {
      ...groups,
      note: "Experimental: reviews that share the same sentence structure.",
    },
    reviews,
    modelVersion: meta.version,
    warnings,
  };
}
