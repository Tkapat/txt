import type { PhraseEvidence } from "@/shared/types";
import { splitClauses, splitUnits, truncateWords } from "./sentences";

export type Scorer = (texts: string[]) => Promise<number[]>;

export async function topEvidence(
  text: string,
  scorer: Scorer,
  k = 3,
  maxUnits = 24,
): Promise<PhraseEvidence[]> {
  let units = splitUnits(text);
  if (units.length < 2) units = splitClauses(text);
  units = units.slice(0, maxUnits);
  if (units.length < 2) {
    return [{ text: truncateWords(text), start: 0, end: text.length, weight: 1 }];
  }

  const variants = units.map((_, index) =>
    units
      .filter((_, other) => other !== index)
      .map((unit) => unit.text)
      .join(" "),
  );
  const [full, ...without] = await scorer([text, ...variants]);
  return units
    .map((unit, index) => ({ unit, weight: full - without[index] }))
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, k)
    .map(({ unit, weight }) => ({
      text: truncateWords(unit.text),
      start: unit.start,
      end: unit.end,
      weight: Number(weight.toFixed(4)),
    }));
}
