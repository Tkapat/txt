import { loadJson } from "@/backend/model/meta";
import { logit, sigmoid } from "./stylometric";

export interface StackerFile {
  stacker: { coef: number[]; intercept: number };
}

export function stackProbWith(
  model: StackerFile,
  pBert: number,
  pFeat: number,
): number {
  const { coef, intercept } = model.stacker;
  if (coef.length < 2) throw new Error("stacker.json needs two coefficients");
  return sigmoid(coef[0] * logit(pBert) + coef[1] * logit(pFeat) + intercept);
}

export async function stackProb(pBert: number, pFeat: number): Promise<number> {
  return stackProbWith(await loadJson<StackerFile>("stacker"), pBert, pFeat);
}
