import { loadJson } from "@/backend/model/meta";
import { scoreBatch } from "@/backend/model/registry";
import { extractFeatures } from "./features";
import { stackProbWith, type StackerFile } from "./stacker";
import { stylometricProbWith, type Sty } from "./stylometric";

export async function scoreReviewTexts(texts: string[]): Promise<number[]> {
  if (texts.length === 0) return [];
  const [pBert, stylometric, stacker] = await Promise.all([
    scoreBatch("review", texts),
    loadJson<Sty>("stylometric"),
    loadJson<StackerFile>("stacker"),
  ]);
  return texts.map((text, index) =>
    stackProbWith(
      stacker,
      pBert[index],
      stylometricProbWith(stylometric, extractFeatures(text)),
    ),
  );
}

export const scoreDocumentChunks = (texts: string[]): Promise<number[]> =>
  scoreBatch("document", texts);
