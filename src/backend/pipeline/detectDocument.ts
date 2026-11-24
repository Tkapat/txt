import type { DocumentResult, Warning } from "@/shared/types";
import { getModelMeta } from "@/backend/model/registry";
import { chunkText } from "@/backend/detector/chunker";
import { scoreDocumentChunks } from "@/backend/detector/score";
import { toConfidence, toVerdict } from "@/backend/detector/verdict";
import { topEvidence } from "@/backend/explain/evidence";

export async function scoreAsDocument(
  text: string,
  wordCount: number,
  warnings: Warning[],
): Promise<DocumentResult> {
  const meta = await getModelMeta("document");
  const chunks = chunkText(
    text,
    meta.chunk.words,
    meta.chunk.stride,
    meta.chunk.min_words,
  );
  const probabilities = await scoreDocumentChunks(chunks.map((c) => c.text));
  const aiProbability = probabilities.length
    ? probabilities.reduce((a, b) => a + b, 0) / probabilities.length
    : 0;

  const results = chunks.map((chunk, index) => ({
    index: chunk.index,
    start: chunk.start,
    end: chunk.end,
    aiProbability: probabilities[index],
    flagged: probabilities[index] >= meta.thresholds.high,
  }));

  const top = [...results]
    .sort((a, b) => b.aiProbability - a.aiProbability)
    .slice(0, 2);

  const evidence = (
    await Promise.all(
      top.map(async (result) => {
        const chunk = text.slice(result.start, result.end);
        const phrases = await topEvidence(chunk, scoreDocumentChunks, 2);
        return phrases.map((phrase) => ({
          ...phrase,
          start: phrase.start + result.start,
          end: phrase.end + result.start,
        }));
      }),
    )
  ).flat();

  return {
    aiProbability,
    verdict: toVerdict(aiProbability, meta.thresholds),
    confidence: toConfidence(aiProbability, meta.thresholds, wordCount),
    wordCount,
    model: "document",
    modelVersion: meta.version,
    warnings,
    evidence,
    cues: [],
    chunks: results,
    flaggedShare: results.length
      ? results.filter((result) => result.flagged).length / results.length
      : 0,
  };
}
