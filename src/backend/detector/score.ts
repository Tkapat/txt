import { scoreBatch } from "@/backend/model/registry";
import { extractFeatures } from "./features";
import { loadStackerOrNull, stackProbWith } from "./stacker";
import { loadStylometricOrNull, stylometricProbWith } from "./stylometric";

export async function scoreReviewTexts(texts: string[]): Promise<number[]> {
  if (texts.length === 0) return [];
  const pBert = await scoreBatch("review", texts);
  const [stylometric, stacker] = await Promise.all([
    loadStylometricOrNull(),
    loadStackerOrNull(),
  ]);
  if (!stylometric || !stacker) return pBert;
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
