import { describe, expect, it } from "vitest";
import {
  FEATURE_NAMES,
  IDX,
} from "@/backend/detector/features";
import {
  logit,
  sigmoid,
  stylometricProbWith,
} from "@/backend/detector/stylometric";
import { stackProbWith } from "@/backend/detector/stacker";
import { toConfidence, toVerdict } from "@/backend/detector/verdict";
import { groupSignals } from "@/backend/analyzers/groupSimilarity";
import { specificity } from "@/backend/analyzers/specificity";
import { topCues } from "@/backend/explain/cues";

describe("stylometric and stacker math", () => {
  it("round-trips logit and sigmoid", () => {
    expect(sigmoid(logit(0.3))).toBeCloseTo(0.3, 12);
  });

  it("scores a one-feature stylometric model", () => {
    const model = {
      mean: [0],
      scale: [1],
      coef: [1],
      intercept: 0,
      human_mean: [0],
      human_std: [1],
    };
    expect(stylometricProbWith(model, [0])).toBe(0.5);
    expect(stylometricProbWith(model, [2])).toBeCloseTo(sigmoid(2), 12);
    expect(() => stylometricProbWith(model, [1, 2])).toThrow();
  });

  it("stacks two probabilities", () => {
    const model = { stacker: { coef: [1, 1], intercept: 0 } };
    expect(stackProbWith(model, 0.8, 0.2)).toBeCloseTo(0.5, 12);
  });
});

describe("verdicts and confidence", () => {
  const thresholds = { low: 0.6, high: 0.8 };

  it("maps probabilities to verdicts", () => {
    expect(toVerdict(0.9, thresholds)).toBe("likely_ai");
    expect(toVerdict(0.7, thresholds)).toBe("uncertain");
    expect(toVerdict(0.1, thresholds)).toBe("likely_human");
  });

  it("lowers confidence near a threshold and for short text", () => {
    const confidenceThresholds = { low: 0.6, high: 0.7 };
    expect(toConfidence(0.99, confidenceThresholds, 100)).toBe("high");
    expect(toConfidence(0.85, confidenceThresholds, 100)).toBe("medium");
    expect(toConfidence(0.72, confidenceThresholds, 100)).toBe("low");
    expect(toConfidence(0.99, confidenceThresholds, 10)).toBe("low");
  });
});

describe("style cues", () => {
  const humanMean = new Array(FEATURE_NAMES.length).fill(0);
  const humanStd = new Array(FEATURE_NAMES.length).fill(1);

  it("returns nothing when features are typical", () => {
    expect(
      topCues(new Array(FEATURE_NAMES.length).fill(0), humanMean, humanStd),
    ).toEqual([]);
  });

  it("labels unusual features and sorts by effect size", () => {
    const features = new Array(FEATURE_NAMES.length).fill(0);
    features[IDX.cv_sent_len] = -2;
    features[IDX.emdash_ratio] = 3;
    const cues = topCues(features, humanMean, humanStd, 2);
    expect(cues).toEqual([
      { label: "Frequent em dashes", direction: "toward_ai" },
      { label: "Very even sentence lengths", direction: "toward_ai" },
    ]);
  });
});

describe("group similarity", () => {
  it("clusters reviews that share a sentence skeleton", () => {
    const texts = [
      "The product is good and the price is good.",
      "The camera is great and the battery is great.",
      "The screen is bright and the speaker is loud.",
      "I bought it after two weeks and returned it.",
    ];
    expect(groupSignals(texts)).toEqual({
      clusters: 1,
      reviewsInClusters: 3,
    });
  });

  it("finds no clusters in unrelated text", () => {
    expect(
      groupSignals(["Alpha beta gamma delta.", "One two three four."]),
    ).toEqual({ clusters: 0, reviewsInClusters: 0 });
  });
});

describe("specificity", () => {
  it("scores concrete details above generic praise", () => {
    const concrete =
      "After 3 weeks, I replaced the Acme filter; it lasted 120 hours.";
    const generic = "This product is really good and I like it.";
    expect(specificity(concrete)).toBeGreaterThan(0.5);
    expect(specificity(generic)).toBeLessThan(0.1);
    expect(specificity(concrete)).toBeGreaterThan(specificity(generic));
  });
});
