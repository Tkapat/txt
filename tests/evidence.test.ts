import { describe, expect, it } from "vitest";
import { topEvidence } from "@/backend/explain/evidence";
import {
  splitClauses,
  splitUnits,
  truncateWords,
} from "@/backend/explain/sentences";

describe("sentence splitting", () => {
  it("returns offsets that slice back to each unit", () => {
    const text = "One. Two! Three?";
    const units = splitUnits(text);
    expect(units.map((unit) => unit.text)).toEqual(["One.", "Two!", "Three?"]);
    units.forEach((unit) => {
      expect(text.slice(unit.start, unit.end)).toBe(unit.text);
    });
  });

  it("splits a single sentence into clauses as a fallback", () => {
    const text = "First part, second part; third part";
    expect(splitClauses(text).map((unit) => unit.text)).toEqual([
      "First part,",
      "second part;",
      "third part",
    ]);
  });

  it("truncates long units by words", () => {
    const text = Array.from({ length: 30 }, (_, index) => `w${index}`).join(" ");
    const short = truncateWords(text, 22);
    expect(short.split(/\s+/)).toHaveLength(22);
    expect(short.endsWith("\u2026")).toBe(true);
    expect(truncateWords("short text", 22)).toBe("short text");
  });
});

describe("occlusion evidence", () => {
  it("keeps only units whose removal lowers the AI score", async () => {
    const text = "AI phrase. Human phrase. Neutral.";
    const scorer = async (texts: string[]) =>
      texts.map((candidate) => (candidate.includes("AI phrase") ? 0.9 : 0.2));

    const evidence = await topEvidence(text, scorer, 3);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].text).toBe("AI phrase.");
    expect(evidence[0].start).toBe(0);
    expect(evidence[0].end).toBe("AI phrase.".length);
    expect(evidence[0].weight).toBeCloseTo(0.7, 4);
  });

  it("returns the whole text when it cannot be split further", async () => {
    const text = "Only one sentence";
    const evidence = await topEvidence(text, async () => [0.5]);
    expect(evidence).toEqual([
      { text, start: 0, end: text.length, weight: 1 },
    ]);
  });
});
