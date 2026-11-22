const STOP = new Set(
  (
    "a an the and or but if so as of to in on at by for with from into over after before is are was were be been being " +
    "i me my we our you your it its this that these those they them their he she his her not no very really just also too " +
    "have has had do does did can could will would should may might one more most all any some than then there here when while"
  ).split(" "),
);

const skeleton = (text: string) =>
  (text.toLowerCase().match(/[a-z']+/g) ?? []).map((word) =>
    STOP.has(word) ? word : "_",
  );

function shingles(tokens: string[], size = 4): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i + size <= tokens.length; i++) {
    const key = tokens.slice(i, i + size).join(" ");
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [key, value] of a) {
    normA += value * value;
    const other = b.get(key);
    if (other) dot += value * other;
  }
  for (const value of b.values()) normB += value * value;
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

export function groupSignals(
  texts: string[],
  threshold = 0.6,
): { clusters: number; reviewsInClusters: number } {
  const sh = texts.map((text) => shingles(skeleton(text)));
  const parent = texts.map((_, index) => index);
  const find = (x: number): number =>
    parent[x] === x ? x : (parent[x] = find(parent[x]));

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (cosine(sh[i], sh[j]) >= threshold) parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, number[]>();
  texts.forEach((_, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), index]);
  });
  const clusters = [...groups.values()].filter((group) => group.length >= 3);
  return {
    clusters: clusters.length,
    reviewsInClusters: clusters.reduce((sum, group) => sum + group.length, 0),
  };
}
