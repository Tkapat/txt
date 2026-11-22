import { describe, expect, it } from "vitest";
import golden from "./fixtures/features-golden.json";
import {
  FEATURE_NAMES,
  extractFeatures,
} from "@/backend/detector/features";

describe("extractFeatures", () => {
  it("matches the Python reference implementation", () => {
    expect(golden.feature_names).toEqual([...FEATURE_NAMES]);
    golden.texts.forEach((text, index) => {
      const actual = extractFeatures(text);
      expect(actual).toHaveLength(FEATURE_NAMES.length);
      actual.forEach((value, featureIndex) => {
        expect(value).toBeCloseTo(golden.features[index][featureIndex], 10);
      });
    });
  });

  it("returns zeros when there are no ASCII words", () => {
    expect(extractFeatures("😀 — 123 !!!")).toEqual(
      new Array(FEATURE_NAMES.length).fill(0),
    );
  });
});
