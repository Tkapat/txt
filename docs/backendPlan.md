# txt: Backend Plan (Next.js, TypeScript)

> Audience: Team B and any AI coding agent. The backend lives in the same Next.js project as the frontend, in `src/backend/`.
> Input from Team A: the `models/` folder from `01_MODEL_TRAINING_PLAN.md`.

## 1. Architecture

```
Browser (src/frontend) ──fetch──▶ src/app/api/**/route.ts   (thin HTTP layer)
                                      │
                                      ▼
                         src/backend/pipeline/*      (orchestrators)
          ┌───────────────┬───────────────┬──────────────────┐
          ▼               ▼               ▼                  ▼
   extractors/*     detector/*       analyzers/*        explain/*
   (PDF, DOCX,      (chunker, ONNX   (group similarity, (occlusion
   TXT, CSV)         scorer, feature  specificity,        evidence,
                     model, stacker)  prevalence)         cues)
                          │
                   models/ (ONNX + JSON from Colab, loaded once per server process)
```

The "brain" is `detector/`. The "tools or skills" are `extractors/`, `analyzers/` and `explain/`. They are plain TypeScript functions with typed inputs and outputs, so nothing needs an agent framework.

## 2. Project layout (whole repo, shared by frontend and backend docs)

```
txt/
├── models/                       # from Colab (git-ignored; shared via Drive/Release)
│   ├── review/  document/  meta/
├── src/
│   ├── app/                      # Next.js routes only
│   │   ├── (site)/page.tsx, reviews/page.tsx, method/page.tsx, layout.tsx
│   │   └── api/
│   │       ├── detect/text/route.ts
│   │       ├── detect/file/route.ts
│   │       ├── detect/reviews/route.ts
│   │       └── health/route.ts
│   ├── backend/
│   │   ├── config.ts             # limits, paths
│   │   ├── http/                 # handler.ts, errors.ts, rateLimit.ts
│   │   ├── model/                # registry.ts, meta.ts
│   │   ├── detector/             # features.ts, stylometric.ts, stacker.ts, chunker.ts, score.ts
│   │   ├── extractors/           # types.ts, registry.ts, txt.ts, docx.ts, pdf.ts, csv.ts
│   │   ├── analyzers/            # groupSimilarity.ts, specificity.ts, prevalence.ts
│   │   ├── explain/              # evidence.ts, cues.ts, sentences.ts
│   │   └── pipeline/             # detectText.ts, detectDocument.ts, detectReviews.ts
│   ├── frontend/                 # see 03_FRONTEND_PLAN.md
│   └── shared/                   # types.ts, constants.ts (used by both sides)
├── tests/                        # golden.test.ts, prevalence.test.ts, extractors.test.ts
├── instrumentation.ts            # model warm-up
├── next.config.ts
└── package.json
```

## 3. Critical rules (do not skip)

1. **API routes must use `export const runtime = "nodejs"`.** ONNX runtime does not run on the Edge runtime.
2. **Load each model once per process** (singleton on `globalThis`, so it survives hot reload) and warm it up at boot.
3. **Feature parity with Python** is mandatory. `tests/golden.test.ts` must pass against `models/meta/golden.json` before any release.
4. **Never store or log user text.** No database, no request-body logging. Delete temporary buffers.
5. **Hard limits** on text length, file size, review count and request rate (section 9).
6. The model returns a **probability**. The UI wording is "likely AI-written", never "fake". Keep disclaimers in the API response (`warnings`).
7. Percentages for review sets are **corrected for detector error** (section 8) and returned with a range.
8. Short text (under 40 words) always returns the `short_text` warning and lower confidence.
9. Deployment: `onnxruntime-node` is large. Run on a Node server or Docker (VPS, Railway, Render, a Hugging Face Space), not on a serverless function with a small size limit. Check the host's limit before choosing.

## 4. Setup

```bash
npm i @huggingface/transformers zod papaparse mammoth unpdf
npm i -D vitest @types/papaparse
```

Docs: Transformers.js https://huggingface.co/docs/transformers.js, `serverExternalPackages` https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages

```ts
// next.config.ts
import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["onnxruntime-node", "sharp", "@huggingface/transformers"],
  outputFileTracingIncludes: { "/api/**": ["./models/**"] },   // ship model files with the server build
};
export default config;
```

```ts
// instrumentation.ts  (Next.js runs this once on server start)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmup } = await import("@/backend/model/registry");
    warmup().catch((e) => console.error("model warmup failed", e));
  }
}
```

## 5. Shared types and constants

```ts
// src/shared/constants.ts
export const MAX_TEXT_CHARS = 100_000;
export const MAX_FILE_MB = 10;
export const MAX_REVIEWS = 500;
export const MIN_WORDS_WARN = 40;
export const MIN_WORDS_REVIEW = 15;
export const REVIEW_MAX_WORDS = 160;
```

```ts
// src/shared/types.ts
export type ModelKey = "review" | "document";
export type Verdict = "likely_ai" | "uncertain" | "likely_human";
export type Confidence = "low" | "medium" | "high";
export type Warning = "short_text" | "english_only" | "scanned_pdf" | "truncated" | "detector_not_proof";

export interface PhraseEvidence { text: string; start: number; end: number; weight: number; reviewId?: string }
export interface Cue { label: string; direction: "toward_ai" | "toward_human" }

export interface TextResult {
  aiProbability: number; verdict: Verdict; confidence: Confidence;
  wordCount: number; model: ModelKey; modelVersion: string;
  evidence: PhraseEvidence[]; cues: Cue[]; warnings: Warning[];
}
export interface ChunkResult { index: number; start: number; end: number; aiProbability: number; flagged: boolean }
export interface DocumentResult extends TextResult { chunks: ChunkResult[]; flaggedShare: number; source?: { fileName: string; chars: number } }

export interface ReviewInput { id?: string; text: string; rating?: number }
export interface ReviewScore { id: string; aiProbability: number; flagged: boolean; verdict: Verdict; wordCount: number }
export interface Prevalence { observed: number; estimated: number; low: number; high: number }
export interface ReviewsReport {
  total: number; analyzed: number; skippedShort: number; flaggedCount: number;
  prevalence: Prevalence;                       // share of AI-written reviews, error-corrected, with range
  topEvidence: PhraseEvidence[];                // at least 3 phrases when available, each with reviewId
  groupSignals: { clusters: number; reviewsInClusters: number; note: string };
  reviews: ReviewScore[]; modelVersion: string; warnings: Warning[];
}
export interface ApiErrorBody { error: { code: string; message: string } }
```

## 6. Using the Colab model in Next.js

1. Copy Colab's `exports/models/` to the project root as `models/`. Final structure: `models/review/{config.json, tokenizer.json, ..., onnx/model_quantized.onnx}`, same for `document/`, plus `models/meta/*.json`.
2. Transformers.js loads local models from `env.localModelPath`. With `dtype: "q8"` it uses `onnx/model_quantized.onnx`. (If your installed version names files differently, check its docs. This is the first thing to verify.)
3. The label named `ai` is the AI class (fixed in training).

```ts
// src/backend/model/registry.ts
import path from "node:path";
import { pipeline, env } from "@huggingface/transformers";
import type { ModelKey } from "@/shared/types";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = path.join(process.cwd(), "models");

type Row = { label: string; score: number };
type Classifier = (inputs: string[], opts?: Record<string, unknown>) => Promise<Row[] | Row[][]>;

const g = globalThis as unknown as { __txtModels?: Map<ModelKey, Promise<Classifier>> };
const cache = (g.__txtModels ??= new Map());

export function getClassifier(key: ModelKey): Promise<Classifier> {
  if (!cache.has(key)) {
    cache.set(key, pipeline("text-classification", key, { dtype: "q8" }).then((p) => p as unknown as Classifier));
  }
  return cache.get(key)!;
}

export async function scoreBatch(key: ModelKey, texts: string[], batch = 8): Promise<number[]> {
  const clf = await getClassifier(key);
  const out: number[] = [];
  for (let i = 0; i < texts.length; i += batch) {
    const res = await clf(texts.slice(i, i + batch), { top_k: null });
    const rows = (Array.isArray(res[0]) ? res : [res]) as Row[][];
    for (const labels of rows) {
      const ai = labels.find((l) => l.label.toLowerCase() === "ai");
      if (!ai) throw new Error(`Model "${key}" has no 'ai' label: ${JSON.stringify(labels)}`);
      out.push(ai.score);
    }
  }
  return out;
}

export async function warmup() {
  await scoreBatch("review", ["warm up the review model with a short sentence."]);
  await scoreBatch("document", ["warm up the document model with a short sentence."]);
}
```

```ts
// src/backend/model/meta.ts
import fs from "node:fs/promises";
import path from "node:path";
const cache = new Map<string, unknown>();
export async function loadJson<T>(name: string): Promise<T> {
  if (!cache.has(name)) cache.set(name, JSON.parse(await fs.readFile(path.join(process.cwd(), "models/meta", `${name}.json`), "utf8")));
  return cache.get(name) as T;
}
export interface ModelMeta {
  version: string; chunk: { words: number; stride: number; min_words: number };
  thresholds: { low: number; high: number }; sensitivity_unseen: number; specificity: number;
}
```

## 7. Tools: detector (the brain)

### 7.1 Feature extraction (must match Python in `01_MODEL_TRAINING_PLAN.md` A5)

```ts
// src/backend/detector/features.ts
export const FEATURE_NAMES = ["log_n_words","mean_sent_len","std_sent_len","cv_sent_len","max_sent_len","ttr","avg_word_len",
  "comma_ratio","exclam_ratio","question_ratio","ellipsis_ratio","paren_ratio","upper_ratio","allcaps_word_ratio",
  "digit_ratio","contraction_ratio","first_person_ratio","nonascii_ratio","repeated_bigram_ratio",
  "sent_start_lower_ratio","ends_with_terminal","emdash_ratio"] as const;
export const IDX = Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, i])) as Record<(typeof FEATURE_NAMES)[number], number>;

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
const SENT_SPLIT = /(?<=[.!?])\s+/;
const CONTR = /^[a-z]+'(?:s|t|re|ve|ll|d|m)$/;
const FIRST_PERSON = new Set(["i","me","my","mine","myself","we","our","us"]);
const div = (a: number, b: number) => (b ? a / b : 0);
const count = (s: string, sub: string) => s.split(sub).length - 1;
const words = (s: string) => s.match(WORD_RE) ?? [];

export function extractFeatures(raw: string): number[] {
  const text = raw.replaceAll("\u2019", "'");
  const ws = words(text); const n = ws.length;
  if (n === 0) return new Array(FEATURE_NAMES.length).fill(0);
  const low = ws.map((w) => w.toLowerCase());
  const sents = text.trim().split(SENT_SPLIT).filter((s) => words(s).length > 0);
  const sl = sents.length ? sents.map((s) => words(s).length) : [n];
  const mean = sl.reduce((a, b) => a + b, 0) / sl.length;
  const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / sl.length);   // population std
  const chars = Array.from(text);                       // CODE POINTS, not UTF-16 units
  const nchar = chars.length;
  let letters = 0, upper = 0, digits = 0, nonAscii = 0;
  for (const c of chars) {
    const cp = c.codePointAt(0)!;
    if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) letters++;
    if (cp >= 65 && cp <= 90) upper++;
    if (cp >= 48 && cp <= 57) digits++;
    if (cp > 127) nonAscii++;
  }
  const bc = new Map<string, number>();
  for (let i = 0; i < low.length - 1; i++) { const k = `${low[i]} ${low[i + 1]}`; bc.set(k, (bc.get(k) ?? 0) + 1); }
  let rep = 0; for (const v of bc.values()) if (v > 1) rep += v;
  const nBigrams = Math.max(low.length - 1, 0);
  const starts = sents.map((s) => s.match(/[A-Za-z]/)).filter(Boolean) as RegExpMatchArray[];
  const startLow = starts.filter((m) => m[0] === m[0].toLowerCase()).length;
  const t = text.trim();
  return [
    Math.log1p(n), mean, std, div(std, mean), Math.max(...sl), new Set(low).size / n, ws.reduce((a, w) => a + w.length, 0) / n,
    count(text, ",") / n, count(text, "!") / n, count(text, "?") / n, count(text, "...") / n, count(text, "(") / n,
    div(upper, letters), ws.filter((w) => w.length >= 2 && w === w.toUpperCase()).length / n,
    digits / nchar, low.filter((w) => CONTR.test(w)).length / n, low.filter((w) => FIRST_PERSON.has(w)).length / n, nonAscii / nchar,
    div(rep, nBigrams), div(startLow, starts.length), t && ".!?".includes(t[t.length - 1]) ? 1 : 0, count(text, "\u2014") / n,
  ];
}
```

### 7.2 Stylometric model and stacker

```ts
// src/backend/detector/stylometric.ts
import { loadJson } from "@/backend/model/meta";
export interface Sty { mean: number[]; scale: number[]; coef: number[]; intercept: number; human_mean: number[]; human_std: number[] }
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
export const logit = (p: number) => { const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6); return Math.log(q / (1 - q)); };

export async function stylometricProb(f: number[]) {
  const m = await loadJson<Sty>("stylometric");
  const z = f.reduce((acc, x, i) => acc + ((x - m.mean[i]) / (m.scale[i] || 1)) * m.coef[i], m.intercept);
  return sigmoid(z);
}
export async function stackProb(pBert: number, pFeat: number) {
  const s = (await loadJson<{ stacker: { coef: number[]; intercept: number } }>("stacker")).stacker;
  return sigmoid(s.coef[0] * logit(pBert) + s.coef[1] * logit(pFeat) + s.intercept);
}
```

### 7.3 Scoring (review model = BERT + features + stacker; document model = RoBERTa chunks)

```ts
// src/backend/detector/score.ts
import { scoreBatch } from "@/backend/model/registry";
import { extractFeatures } from "./features";
import { stylometricProb, stackProb } from "./stylometric";

export async function scoreReviewTexts(texts: string[]): Promise<number[]> {
  const pBert = await scoreBatch("review", texts);
  return Promise.all(texts.map(async (t, i) => stackProb(pBert[i], await stylometricProb(extractFeatures(t)))));
}
export const scoreDocumentChunks = (texts: string[]) => scoreBatch("document", texts);
```

### 7.4 Chunker (long text)

```ts
// src/backend/detector/chunker.ts
export interface Chunk { index: number; start: number; end: number; text: string }
export function chunkText(text: string, size = 160, stride = 120, minWords = 60): Chunk[] {
  const spans = [...text.matchAll(/\S+/g)].map((m) => ({ s: m.index!, e: m.index! + m[0].length }));
  const out: Chunk[] = [];
  for (let i = 0; i < spans.length; i += stride) {
    const slice = spans.slice(i, i + size);
    if (slice.length < minWords && i > 0) break;           // tail is already covered by overlap
    const start = slice[0].s, end = slice[slice.length - 1].e;
    out.push({ index: out.length, start, end, text: text.slice(start, end) });
    if (i + size >= spans.length) break;
  }
  return out;
}
```

### 7.5 Verdict and confidence

```ts
// src/backend/detector/verdict.ts
import type { Confidence, Verdict } from "@/shared/types";
export function toVerdict(p: number, t: { low: number; high: number }): Verdict {
  return p >= t.high ? "likely_ai" : p < t.low ? "likely_human" : "uncertain";
}
export function toConfidence(p: number, t: { low: number; high: number }, words: number): Confidence {
  if (words < 40) return "low";
  const margin = p >= t.high ? p - t.high : p < t.low ? t.low - p : 0;
  return margin > 0.25 ? "high" : margin > 0.1 ? "medium" : "low";
}
```

## 8. Tools: analyzers and explainers

### 8.1 Error-corrected percentage (Rogan-Gladen) with range

```ts
// src/backend/analyzers/prevalence.ts
import type { Prevalence } from "@/shared/types";
const clamp = (x: number) => Math.min(1, Math.max(0, x));
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}
export function estimatePrevalence(flagged: number, n: number, sens: number, spec: number): Prevalence {
  const observed = n ? flagged / n : 0, denom = sens + spec - 1;
  const fix = (o: number) => (denom > 0.1 ? clamp((o + spec - 1) / denom) : o);
  const [lo, hi] = wilson(flagged, n);
  return { observed, estimated: fix(observed), low: fix(lo), high: fix(hi) };
}
```
`sens` is `sensitivity_unseen` and `spec` is `specificity` from the meta file. The UI shows the range, never a single exact number.

### 8.2 Evidence phrases (occlusion): which sentences push the score toward AI

```ts
// src/backend/explain/sentences.ts
export interface Unit { text: string; start: number; end: number }
export function splitUnits(text: string, re = /[^.!?]+[.!?]*\s*/g): Unit[] {
  const out: Unit[] = []; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const trimmed = m[0].trim(); if (!trimmed) continue;
    const start = m.index + m[0].indexOf(trimmed);
    out.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}
export const splitClauses = (t: string) => splitUnits(t, /[^,;\u2014]+[,;\u2014]?\s*/g);   // fallback for one-sentence reviews
export function truncateWords(s: string, max = 22) { const w = s.split(/\s+/); return w.length <= max ? s : w.slice(0, max).join(" ") + "\u2026"; }
```

```ts
// src/backend/explain/evidence.ts
import type { PhraseEvidence } from "@/shared/types";
import { splitUnits, splitClauses, truncateWords } from "./sentences";
export type Scorer = (texts: string[]) => Promise<number[]>;

export async function topEvidence(text: string, scorer: Scorer, k = 3, maxUnits = 24): Promise<PhraseEvidence[]> {
  let units = splitUnits(text); if (units.length < 2) units = splitClauses(text);
  units = units.slice(0, maxUnits);
  if (units.length < 2) return [{ text: truncateWords(text), start: 0, end: text.length, weight: 1 }];
  const variants = units.map((_, i) => units.filter((_, j) => j !== i).map((u) => u.text).join(" "));
  const [full, ...without] = await scorer([text, ...variants]);
  return units.map((u, i) => ({ u, w: full - without[i] })).filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w).slice(0, k)
    .map(({ u, w }) => ({ text: truncateWords(u.text), start: u.start, end: u.end, weight: Number(w.toFixed(4)) }));
}
```
Cost is one extra model call per sentence, so cap `maxUnits` and only run this on the top flagged reviews. These are **evidence of what moved the model's score**, not proof.

### 8.3 Style cues (human-readable reasons)

```ts
// src/backend/explain/cues.ts
import type { Cue } from "@/shared/types";
import { IDX } from "@/backend/detector/features";
const RULES = [
  { i: IDX.cv_sent_len, lo: "Very even sentence lengths" },
  { i: IDX.contraction_ratio, lo: "No casual contractions" },
  { i: IDX.first_person_ratio, lo: "Little personal voice" },
  { i: IDX.emdash_ratio, hi: "Frequent em dashes" },
  { i: IDX.nonascii_ratio, lo: "No informal symbols or emoji" },
  { i: IDX.sent_start_lower_ratio, lo: "Every sentence starts with a capital letter" },
] as const;
export function topCues(f: number[], humanMean: number[], humanStd: number[], k = 3): Cue[] {
  const hits = RULES.map((r) => { const z = (f[r.i] - humanMean[r.i]) / (humanStd[r.i] || 1);
      return { z, label: z <= -1.2 && "lo" in r ? r.lo : z >= 1.2 && "hi" in r ? r.hi : null }; })
    .filter((h) => h.label).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  return hits.slice(0, k).map((h) => ({ label: h.label as string, direction: "toward_ai" as const }));
}
```

### 8.4 Group similarity (experimental): do many reviews share one template?

Reviews of one product share topic words, so compare **structure**: replace content words with a placeholder and keep common function words.

```ts
// src/backend/analyzers/groupSimilarity.ts
const STOP = new Set(("a an the and or but if so as of to in on at by for with from into over after before is are was were be been being " +
  "i me my we our you your it its this that these those they them their he she his her not no very really just also too " +
  "have has had do does did can could will would should may might one more most all any some than then there here when while").split(" "));
const skeleton = (t: string) => (t.toLowerCase().match(/[a-z']+/g) ?? []).map((w) => (STOP.has(w) ? w : "_"));
function shingles(tokens: string[], n = 4) { const m = new Map<string, number>(); for (let i = 0; i + n <= tokens.length; i++) { const k = tokens.slice(i, i + n).join(" "); m.set(k, (m.get(k) ?? 0) + 1); } return m; }
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0; for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w; } for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
export function groupSignals(texts: string[], threshold = 0.6) {
  const sh = texts.map((t) => shingles(skeleton(t))); const parent = texts.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++)
    if (cosine(sh[i], sh[j]) >= threshold) parent[find(i)] = find(j);
  const groups = new Map<number, number[]>(); texts.forEach((_, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); });
  const clusters = [...groups.values()].filter((g) => g.length >= 3);
  return { clusters: clusters.length, reviewsInClusters: clusters.reduce((a, g) => a + g.length, 0) };
}
```
O(n²) is fine for up to 500 reviews. Tune `threshold` on the Colab test data and report it. This is a bonus signal and is not part of the main score.

### 8.5 Specificity (heuristic, 0 to 1)

```ts
// src/backend/analyzers/specificity.ts
export function specificity(text: string): number {
  const w = text.split(/\s+/).filter(Boolean).length || 1;
  const nums = (text.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).length;
  const units = (text.match(/\b\d+\s?(?:mm|cm|kg|g|ml|oz|lb|hours?|days?|weeks?|months?|years?)\b/gi) ?? []).length;
  const proper = (text.match(/(?<=[a-z,]\s)[A-Z][a-z]{2,}/g) ?? []).length;          // mid-sentence capitalised words
  const exp = (text.match(/\b(after|since|bought|ordered|returned|broke|stopped|replaced)\b/gi) ?? []).length;
  return Math.min(1, ((nums + 2 * units + proper + exp) / w) * 6);
}
```
Show it only as a secondary signal ("generic praise with few concrete details").

## 9. Tools: extractors (the "skills" that feed text to the detector)

```ts
// src/backend/extractors/types.ts
export interface ExtractedUnit { id: string; text: string; meta?: Record<string, unknown> }
export interface FileInfo { name: string; mime: string; size: number }
export interface Extractor { id: string; accepts(f: FileInfo): boolean; extract(buf: Buffer): Promise<ExtractedUnit[]> }
```

```ts
// src/backend/extractors/txt.ts
export const txtExtractor: Extractor = {
  id: "txt", accepts: (f) => /\.(txt|md)$/i.test(f.name) || f.mime.startsWith("text/plain"),
  async extract(buf) { return [{ id: "doc", text: buf.toString("utf8").replace(/^\uFEFF/, "") }]; },
};
// docx.ts
import mammoth from "mammoth";
export const docxExtractor: Extractor = {
  id: "docx", accepts: (f) => /\.docx$/i.test(f.name),
  async extract(buf) { const { value } = await mammoth.extractRawText({ buffer: buf }); return [{ id: "doc", text: value }]; },
};
// pdf.ts  (unpdf: https://github.com/unjs/unpdf , verify the API for your installed version)
import { extractText, getDocumentProxy } from "unpdf";
export const pdfExtractor: Extractor = {
  id: "pdf", accepts: (f) => /\.pdf$/i.test(f.name) || f.mime === "application/pdf",
  async extract(buf) {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    if (text.replace(/\s/g, "").length < 200) throw new ApiError("scanned_pdf", "This PDF has no selectable text (scanned?). OCR is not supported.", 422);
    return [{ id: "doc", text }];
  },
};
// csv.ts  (reviews)
import Papa from "papaparse";
export const csvExtractor: Extractor = {
  id: "csv", accepts: (f) => /\.csv$/i.test(f.name) || f.mime === "text/csv",
  async extract(buf) {
    const { data, meta } = Papa.parse<Record<string, string>>(buf.toString("utf8"), { header: true, skipEmptyLines: true });
    const col = (meta.fields ?? []).find((c) => /^(review|text|body|content|comment)/i.test(c)); if (!col) throw new ApiError("no_text_column", "CSV needs a column named review, text, body or content.", 422);
    return data.slice(0, 5000).map((r, i) => ({ id: String(i + 1), text: (r[col] ?? "").trim(), meta: { rating: Number(r.rating) || undefined } }));
  },
};
// registry.ts
export const extractors = [txtExtractor, docxExtractor, pdfExtractor, csvExtractor];
export function pickExtractor(f: FileInfo) { const e = extractors.find((x) => x.accepts(f)); if (!e) throw new ApiError("unsupported_type", "Supported files: .txt, .md, .docx, .pdf, .csv", 415); return e; }
```
To add a new source (for example a Flipkart page parser for the browser extension), implement `Extractor` or add a route that returns `ReviewInput[]`. The detector does not change.

## 10. Pipelines

```ts
// src/backend/pipeline/detectText.ts
export async function detectText(raw: string, forced?: ModelKey): Promise<TextResult | DocumentResult> {
  const text = normalizeText(raw), wordCount = countWords(text);
  if (wordCount === 0) throw new ApiError("empty_text", "No readable words found.", 422);
  const warnings: Warning[] = ["detector_not_proof"]; if (wordCount < MIN_WORDS_WARN) warnings.push("short_text");
  const model = forced ?? (wordCount > REVIEW_MAX_WORDS ? "document" : "review");
  return model === "review" ? scoreAsReview(text, wordCount, warnings) : scoreAsDocument(text, wordCount, warnings);
}
async function scoreAsReview(text: string, wordCount: number, warnings: Warning[]): Promise<TextResult> {
  const meta = await loadJson<ModelMeta>("review-meta"), sty = await loadJson<Sty>("stylometric");
  const [p] = await scoreReviewTexts([text]);
  return { aiProbability: p, verdict: toVerdict(p, meta.thresholds), confidence: toConfidence(p, meta.thresholds, wordCount),
    wordCount, model: "review", modelVersion: meta.version, warnings,
    evidence: p >= meta.thresholds.low ? await topEvidence(text, scoreReviewTexts) : [],
    cues: topCues(extractFeatures(text), sty.human_mean, sty.human_std) };
}
async function scoreAsDocument(text: string, wordCount: number, warnings: Warning[]): Promise<DocumentResult> {
  const meta = await loadJson<ModelMeta>("document-meta");
  const chunks = chunkText(text, meta.chunk.words, meta.chunk.stride, meta.chunk.min_words);
  const ps = await scoreDocumentChunks(chunks.map((c) => c.text));
  const p = ps.reduce((a, b) => a + b, 0) / ps.length;
  const results = chunks.map((c, i) => ({ index: c.index, start: c.start, end: c.end, aiProbability: ps[i], flagged: ps[i] >= meta.thresholds.high }));
  const top = [...results].sort((a, b) => b.aiProbability - a.aiProbability).slice(0, 2);     // explain only the 2 most suspicious chunks
  const evidence = (await Promise.all(top.map(async (r) => (await topEvidence(text.slice(r.start, r.end), scoreDocumentChunks, 2))
      .map((e) => ({ ...e, start: e.start + r.start, end: e.end + r.start }))))).flat();
  return { aiProbability: p, verdict: toVerdict(p, meta.thresholds), confidence: toConfidence(p, meta.thresholds, wordCount),
    wordCount, model: "document", modelVersion: meta.version, warnings, evidence, cues: [], chunks: results,
    flaggedShare: results.filter((r) => r.flagged).length / results.length };
}
```

```ts
// src/backend/pipeline/detectReviews.ts
export async function detectReviews(input: ReviewInput[]): Promise<ReviewsReport> {
  if (input.length > MAX_REVIEWS) throw new ApiError("too_many", `Max ${MAX_REVIEWS} reviews per request.`, 413);
  const meta = await loadJson<ModelMeta>("review-meta");
  const items = input.map((r, i) => ({ id: r.id ?? String(i + 1), text: normalizeText(r.text) }));
  const usable = items.filter((r) => countWords(r.text) >= MIN_WORDS_REVIEW);
  const ps = await scoreReviewTexts(usable.map((r) => r.text));
  const reviews: ReviewScore[] = usable.map((r, i) => ({ id: r.id, aiProbability: ps[i], flagged: ps[i] >= meta.thresholds.high,
    verdict: toVerdict(ps[i], meta.thresholds), wordCount: countWords(r.text) }));
  const flaggedCount = reviews.filter((r) => r.flagged).length;
  const ranked = [...reviews].filter((r) => r.flagged).sort((a, b) => b.aiProbability - a.aiProbability).slice(0, 5);
  const evidence = (await Promise.all(ranked.map(async (r) => {
    const text = usable.find((u) => u.id === r.id)!.text;
    return (await topEvidence(text, scoreReviewTexts, 1)).map((e) => ({ ...e, reviewId: r.id }));
  }))).flat().slice(0, 5);                                    // at least 3 when 3+ reviews are flagged
  const g = groupSignals(usable.map((u) => u.text));
  return { total: items.length, analyzed: usable.length, skippedShort: items.length - usable.length, flaggedCount,
    prevalence: estimatePrevalence(flaggedCount, usable.length, meta.sensitivity_unseen, meta.specificity),
    topEvidence: evidence, groupSignals: { ...g, note: "Experimental: reviews that share the same sentence structure." },
    reviews, modelVersion: meta.version, warnings: ["detector_not_proof", ...(usable.length < 20 ? (["short_text"] as Warning[]) : [])] };
}
```
Helpers (`src/backend/text.ts`): `normalizeText` (replace `\u2019` with `'`, normalise line breaks, strip control characters) and `countWords` (same regex as the features file).

## 11. API contract

| Method + path | Body | Returns |
|---|---|---|
| `POST /api/detect/text` | `{ text: string, model?: "review"\|"document" }` | `TextResult` or `DocumentResult` |
| `POST /api/detect/file` | multipart `file` (.txt .md .docx .pdf) | `DocumentResult` (+ `source`) |
| `POST /api/detect/reviews` | JSON `{ reviews: ReviewInput[] }` or multipart `file` (.csv) | `ReviewsReport` |
| `GET /api/health` | none | `{ ok: true, models: { review: version, document: version } }` |

Errors always use `ApiErrorBody`: `empty_text` 422, `too_large` 413, `unsupported_type` 415, `scanned_pdf` 422, `rate_limited` 429, `bad_request` 400, `internal` 500.

```ts
// src/backend/http/errors.ts
export class ApiError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }
// src/backend/http/handler.ts
import { NextResponse } from "next/server"; import { ZodError } from "zod";
export async function handle<T>(fn: () => Promise<T>) {
  try { return NextResponse.json(await fn()); }
  catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    if (e instanceof ZodError) return NextResponse.json({ error: { code: "bad_request", message: e.issues[0]?.message ?? "Invalid request" } }, { status: 400 });
    console.error("detect failed:", (e as Error).name);            // never log user text
    return NextResponse.json({ error: { code: "internal", message: "Something went wrong." } }, { status: 500 });
  }
}
// src/backend/http/rateLimit.ts  (simple per-IP limit; replace with Redis if you scale out)
const hits = new Map<string, number[]>();
export function enforceRateLimit(req: Request, limit = 30, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"; const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs); recent.push(now); hits.set(ip, recent);
  if (recent.length > limit) throw new ApiError("rate_limited", "Too many requests. Please wait a minute.", 429);
}
```

```ts
// src/app/api/detect/text/route.ts
import { NextRequest } from "next/server"; import { z } from "zod";
export const runtime = "nodejs"; export const maxDuration = 60;
const Body = z.object({ text: z.string().min(1).max(MAX_TEXT_CHARS), model: z.enum(["review", "document"]).optional() });
export async function POST(req: NextRequest) {
  return handle(async () => { enforceRateLimit(req); const b = Body.parse(await req.json()); return detectText(b.text, b.model); });
}
```

```ts
// src/app/api/detect/file/route.ts
export const runtime = "nodejs"; export const maxDuration = 60;
export async function POST(req: NextRequest) {
  return handle(async () => {
    enforceRateLimit(req, 10);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError("bad_request", "Attach a file in the 'file' field.", 400);
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new ApiError("too_large", `Max file size is ${MAX_FILE_MB} MB.`, 413);
    const info = { name: file.name, mime: file.type, size: file.size };
    const units = await pickExtractor(info).extract(Buffer.from(await file.arrayBuffer()));
    const text = units.map((u) => u.text).join("\n\n").slice(0, MAX_TEXT_CHARS);
    const result = await detectText(text, "document");
    return { ...result, source: { fileName: file.name, chars: text.length } };
  });
}
```
`detect/reviews/route.ts` follows the same pattern: if the request is JSON, validate `{ reviews: [{ id?, text, rating? }] }` with zod; if multipart, use `csvExtractor`; then call `detectReviews`.

## 12. Tests (run in CI and before every handoff)

```ts
// tests/golden.test.ts
import { describe, it, expect } from "vitest"; import golden from "../models/meta/golden.json";
import { extractFeatures } from "@/backend/detector/features"; import { scoreBatch } from "@/backend/model/registry";
describe("parity with Colab", () => {
  it("features match Python", () => golden.texts.forEach((t: string, i: number) =>
    extractFeatures(t).forEach((v, j) => expect(v).toBeCloseTo(golden.features[i][j], 6))));
  it("ONNX q8 probabilities match", async () => {
    const p = await scoreBatch("review", golden.texts as string[]);
    p.forEach((v, i) => expect(Math.abs(v - golden.p_bert_q8[i])).toBeLessThan(0.03));
  }, 120_000);
});
```
Also test: `estimatePrevalence` (known numbers), `chunkText` (offsets map back to the original text), each extractor (small sample files in `tests/fixtures/`), API limits (oversized text and file return 413).

## 13. Performance and privacy notes

- A quantized DistilBERT answers in tens of milliseconds per short review on a normal CPU. The RoBERTa document model is slower, and a 20-page document is about 40 chunks.
- Score in batches of 8. Cap review sets at 500 and keep occlusion to the top flagged items.
- Keep `models/` out of Git. Share it through a Drive link or a Release, and document the download step in the README.
- No database and no request-body logging. Add a clear privacy sentence on the Method page.

## 14. Task checklist for agents

- [ ] Project scaffold, `next.config.ts`, `instrumentation.ts`, shared types and constants
- [ ] `registry.ts` and `meta.ts`, `/api/health`
- [ ] `features.ts` with the golden parity test passing
- [ ] `stylometric.ts`, `stacker.ts`, `score.ts`, `chunker.ts`, `verdict.ts`
- [ ] Extractors (txt, docx, pdf, csv) and the registry
- [ ] `detectText` and the `/api/detect/text` route
- [ ] `/api/detect/file`
- [ ] `evidence.ts` (occlusion) and `cues.ts`
- [ ] `prevalence.ts`, `detectReviews`, `/api/detect/reviews`
- [ ] `groupSimilarity.ts` and `specificity.ts` (stretch)
- [ ] Rate limit, error handler, size limits, privacy review
- [ ] Docker or run instructions in the README