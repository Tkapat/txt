export const FEATURE_NAMES = [
  "log_n_words",
  "mean_sent_len",
  "std_sent_len",
  "cv_sent_len",
  "max_sent_len",
  "ttr",
  "avg_word_len",
  "comma_ratio",
  "exclam_ratio",
  "question_ratio",
  "ellipsis_ratio",
  "paren_ratio",
  "upper_ratio",
  "allcaps_word_ratio",
  "digit_ratio",
  "contraction_ratio",
  "first_person_ratio",
  "nonascii_ratio",
  "repeated_bigram_ratio",
  "sent_start_lower_ratio",
  "ends_with_terminal",
  "emdash_ratio",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export const IDX = Object.fromEntries(
  FEATURE_NAMES.map((name, index) => [name, index]),
) as Record<FeatureName, number>;

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
const SENT_SPLIT = /(?<=[.!?])\s+/;
const CONTR = /^[a-z]+'(?:s|t|re|ve|ll|d|m)$/;
const FIRST_PERSON = new Set([
  "i",
  "me",
  "my",
  "mine",
  "myself",
  "we",
  "our",
  "us",
]);

const div = (a: number, b: number) => (b ? a / b : 0);
const count = (s: string, sub: string) => s.split(sub).length - 1;
const words = (s: string) => s.match(WORD_RE) ?? [];

export function extractFeatures(raw: string): number[] {
  const text = raw.replaceAll("\u2019", "'");
  const ws = words(text);
  const n = ws.length;
  if (n === 0) return new Array(FEATURE_NAMES.length).fill(0);

  const low = ws.map((w) => w.toLowerCase());
  const sents = text
    .trim()
    .split(SENT_SPLIT)
    .filter((s) => words(s).length > 0);
  const sl = sents.length ? sents.map((s) => words(s).length) : [n];
  const mean = sl.reduce((a, b) => a + b, 0) / sl.length;
  const std = Math.sqrt(
    sl.reduce((a, b) => a + (b - mean) ** 2, 0) / sl.length,
  );

  const chars = Array.from(text);
  const nchar = chars.length;
  let letters = 0;
  let upper = 0;
  let digits = 0;
  let nonAscii = 0;
  for (const c of chars) {
    const cp = c.codePointAt(0)!;
    if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) letters++;
    if (cp >= 65 && cp <= 90) upper++;
    if (cp >= 48 && cp <= 57) digits++;
    if (cp > 127) nonAscii++;
  }

  const bc = new Map<string, number>();
  for (let i = 0; i < low.length - 1; i++) {
    const key = `${low[i]} ${low[i + 1]}`;
    bc.set(key, (bc.get(key) ?? 0) + 1);
  }
  let rep = 0;
  for (const value of bc.values()) if (value > 1) rep += value;
  const nBigrams = Math.max(low.length - 1, 0);

  const starts = sents
    .map((s) => s.match(/[A-Za-z]/))
    .filter(Boolean) as RegExpMatchArray[];
  const startLow = starts.filter((m) => m[0] === m[0].toLowerCase()).length;

  const t = text.trim();
  const maxSent = sl.reduce((a, b) => Math.max(a, b), 0);

  return [
    Math.log1p(n),
    mean,
    std,
    div(std, mean),
    maxSent,
    new Set(low).size / n,
    ws.reduce((a, w) => a + w.length, 0) / n,
    count(text, ",") / n,
    count(text, "!") / n,
    count(text, "?") / n,
    count(text, "...") / n,
    count(text, "(") / n,
    div(upper, letters),
    ws.filter((w) => w.length >= 2 && w === w.toUpperCase()).length / n,
    digits / nchar,
    low.filter((w) => CONTR.test(w)).length / n,
    low.filter((w) => FIRST_PERSON.has(w)).length / n,
    nonAscii / nchar,
    div(rep, nBigrams),
    div(startLow, starts.length),
    t && ".!?".includes(t[t.length - 1]) ? 1 : 0,
    count(text, "\u2014") / n,
  ];
}
