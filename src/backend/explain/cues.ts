import type { Cue } from "@/shared/types";
import { IDX } from "@/backend/detector/features";

const RULES: Array<{ index: number; lo?: string; hi?: string }> = [
  { index: IDX.cv_sent_len, lo: "Very even sentence lengths" },
  { index: IDX.contraction_ratio, lo: "No casual contractions" },
  { index: IDX.first_person_ratio, lo: "Little personal voice" },
  { index: IDX.emdash_ratio, hi: "Frequent em dashes" },
  { index: IDX.nonascii_ratio, lo: "No informal symbols or emoji" },
  {
    index: IDX.sent_start_lower_ratio,
    lo: "Every sentence starts with a capital letter",
  },
];

export function topCues(
  features: number[],
  humanMean: number[],
  humanStd: number[],
  k = 3,
): Cue[] {
  const hits = RULES.map((rule) => {
    const z =
      (features[rule.index] - humanMean[rule.index]) /
      (humanStd[rule.index] || 1);
    const label =
      z <= -1.2 && rule.lo
        ? rule.lo
        : z >= 1.2 && rule.hi
          ? rule.hi
          : null;
    return { z, label };
  })
    .filter((hit) => hit.label)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

  return hits.slice(0, k).map((hit) => ({
    label: hit.label as string,
    direction: "toward_ai" as const,
  }));
}
