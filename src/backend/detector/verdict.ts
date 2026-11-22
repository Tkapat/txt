import type { Confidence, Verdict } from "@/shared/types";
import { MIN_WORDS_WARN } from "@/shared/constants";

export function toVerdict(
  p: number,
  thresholds: { low: number; high: number },
): Verdict {
  return p >= thresholds.high
    ? "likely_ai"
    : p < thresholds.low
      ? "likely_human"
      : "uncertain";
}

export function toConfidence(
  p: number,
  thresholds: { low: number; high: number },
  words: number,
): Confidence {
  if (words < MIN_WORDS_WARN) return "low";
  const margin =
    p >= thresholds.high
      ? p - thresholds.high
      : p < thresholds.low
        ? thresholds.low - p
        : 0;
  return margin > 0.25 ? "high" : margin > 0.1 ? "medium" : "low";
}
