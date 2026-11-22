import type { Prevalence } from "@/shared/types";

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}

export function estimatePrevalence(
  flagged: number,
  n: number,
  sensitivity: number,
  specificity: number,
): Prevalence {
  if (n === 0) return { observed: 0, estimated: 0, low: 0, high: 0 };
  const observed = flagged / n;
  const denom = sensitivity + specificity - 1;
  const fix = (value: number) =>
    denom > 0.1 ? clamp((value + specificity - 1) / denom) : value;
  const [low, high] = wilson(flagged, n);
  return {
    observed,
    estimated: fix(observed),
    low: fix(low),
    high: fix(high),
  };
}
