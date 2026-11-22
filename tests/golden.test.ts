import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFeatures } from "@/backend/detector/features";
import { scoreBatch } from "@/backend/model/registry";

interface Golden {
  texts: string[];
  features: number[][];
  p_bert_q8: number[];
}

const goldenPath = path.join(process.cwd(), "models/meta/golden.json");
const hasGolden = existsSync(goldenPath);
const golden = hasGolden
  ? (JSON.parse(readFileSync(goldenPath, "utf8")) as Golden)
  : null;
const hasModels =
  existsSync(path.join(process.cwd(), "models/review/config.json")) &&
  existsSync(path.join(process.cwd(), "models/document/config.json"));

describe("parity with Colab", () => {
  it.skipIf(!hasGolden)("features match Python", () => {
    golden!.texts.forEach((text, index) => {
      extractFeatures(text).forEach((value, featureIndex) => {
        expect(value).toBeCloseTo(golden!.features[index][featureIndex], 6);
      });
    });
  });

  it.skipIf(!hasGolden || !hasModels)(
    "ONNX q8 probabilities match",
    async () => {
      const probabilities = await scoreBatch("review", golden!.texts);
      probabilities.forEach((value, index) => {
        expect(Math.abs(value - golden!.p_bert_q8[index])).toBeLessThan(0.03);
      });
    },
    120_000,
  );
});
