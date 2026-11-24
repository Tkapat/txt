import { loadJson } from "@/backend/model/meta";

export interface Sty {
  mean: number[];
  scale: number[];
  coef: number[];
  intercept: number;
  human_mean: number[];
  human_std: number[];
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export const logit = (p: number) => {
  const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return Math.log(q / (1 - q));
};

export function stylometricProbWith(model: Sty, features: number[]): number {
  if (
    model.mean.length !== features.length ||
    model.scale.length !== features.length ||
    model.coef.length !== features.length
  ) {
    throw new Error("stylometric.json does not match the feature vector length");
  }
  const z = features.reduce(
    (acc, value, index) =>
      acc + ((value - model.mean[index]) / (model.scale[index] || 1)) * model.coef[index],
    model.intercept,
  );
  return sigmoid(z);
}

export async function stylometricProb(features: number[]): Promise<number> {
  return stylometricProbWith(await loadJson<Sty>("stylometric"), features);
}

export async function loadStylometricOrNull(): Promise<Sty | null> {
  try {
    return await loadJson<Sty>("stylometric");
  } catch {
    return null;
  }
}
