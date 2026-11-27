# txt — Current Workflow

Working reference for the current state of the project: what it is, how the
pieces fit, how the models were trained, and how to run and continue the work.
Last reviewed: 2026-11-25.

---

## 1. What txt is

`txt` estimates the probability that a piece of text was written (or rewritten)
by an AI. It has three user-facing flows:

- **Detector (`/`)** — paste text or upload a file, get a probability, a
  verdict, evidence phrases and style cues.
- **Reviews (`/reviews`)** — analyse many product reviews (JSON, CSV or XLSX), get a
  flagged share, an error-corrected prevalence estimate with a confidence
  interval, and group signals.
- **Method (`/method`)** — accuracy, limitations and privacy.

The app is a **Next.js UI + API layer** backed by a **local FastAPI + PyTorch
service** that runs two fine-tuned transformers on CPU. No database, no
request-body logging, no third-party AI calls.

Label semantics are fixed everywhere:

```text
0 = human
1 = ai
id2label = {0: "human", 1: "ai"}
label2id = {"human": 0, "ai": 1}
```

The positive class means **AI-generated or AI-rephrased**, not "fake".

---

## 2. Current snapshot

| Item | Value |
|---|---|
| Node.js | 24.16.0 (`unpdf` requires Node 24+) |
| pnpm | 10.33.0 |
| Python | 3.14.10 (3.10+ supported) |
| Next.js | 16.4.6 (App Router, Turbopack) |
| React | 19.3.0 |
| TypeScript | 5 (`tsc --noEmit`) |
| Tailwind CSS | 4.3.3 (`@tailwindcss/turbopack`) |
| Animation | GSAP 3.15.1 (only inside `src/frontend/animations/`) + CSS keyframes |
| Tests | Vitest 5.1.1 — 56 passed, 2 skipped, 11 files |
| Review model | `review-v2` — DeBERTa-v3-base, fp32, 737,719,272 B (~184.4M params) |
| Document model | `document-v1` — RoBERTa-base (HC3-initialised), fp32, 498,612,824 B (~124.7M params) |
| ML service | `http://127.0.0.1:8000` (`ML_SERVICE_URL`) |
| Next.js dev | `http://localhost:3000` |

Checks currently expected to pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm build`.

---

## 3. Technology stack

| Layer | Technology | Role |
|---|---|---|
| UI | Next.js 16.4.6 App Router, React 19.3.0, TypeScript 5 | Pages, routing, client components |
| Styling | Tailwind CSS 4.3.3 + custom CSS tokens | Paper/editorial design, responsive layout, print |
| API | Next.js Route Handlers, Zod 4.6.7 | Validation, typed errors, rate limits |
| Extraction | unpdf 2.2.1, mammoth 1.13.0, papaparse 5.7.1, read-excel-file 9.3.20 | PDF, DOCX, CSV, XLSX; UTF-8 for TXT/MD |
| Backend logic | TS modules (`detector`, `analyzers`, `explain`, `pipeline`) | Chunking, scoring, verdicts, evidence, prevalence |
| Model service | Python, FastAPI ≥0.110, Uvicorn ≥0.29 | Local HTTP inference |
| ML runtime | PyTorch ≥2.2, Transformers ≥4.44, safetensors ≥0.4 | fp32 CPU inference |
| Models | DeBERTa-v3-base (review), RoBERTa-base (document) | Binary human/AI classifiers |
| Training | Google Colab T4, HF `transformers`/`datasets`, scikit-learn, pandas, NumPy | Fine-tuning + calibration |
| Data | Amazon Reviews 2023, HC3, RAID | Training and held-out tests |
| Testing | Vitest 5.1.1, ESLint 9, `tsc` | Unit/integration tests, lint, typecheck |
| Tooling | Node 24, pnpm 10 | Runtime + package manager |

Historical note: the first design used Transformers.js / ONNX Runtime inside
Node. It was replaced with the local PyTorch service because the exported
checkpoints are native `safetensors` and PyTorch gave better control over
batching, thresholds and quantization experiments. The Next.js layer never
loads model weights.

---

## 4. Repository map

```text
txt/
├── ml/
│   ├── app.py                     # FastAPI: /health, /meta, /meta/{model}, /score
│   ├── requirements.txt           # torch, transformers, fastapi, uvicorn, safetensors
│   ├── document-meta.json         # tracked copy of document thresholds/error rates
│   └── models/                    # gitignored weights (review/, document/)
├── models/                        # gitignored model archives + .gitkeep
│   ├── final_model_v2.zip
│   └── models-20261124T102743Z-1-001.zip
├── public/
│   ├── stickers/sticker-01..07.webp   # v3 desk stickers (+ SOURCES.md)
│   └── sketches/{leaves,flower,circuit-leaf}.webp
├── scripts/
│   └── slice_stickers.py           # cut a sticker sheet to transparent WebP
├── src/
│   ├── app/
│   │   ├── layout.tsx              # html/body, fonts, masthead/footer, stamp filter
│   │   ├── page.tsx                # re-exports (site)/page
│   │   ├── globals.css             # imports tokens/paper/art/animations/print
│   │   ├── (site)/page.tsx         # Detector page (client)
│   │   ├── (site)/reviews/page.tsx # Reviews page (client)
│   │   ├── (site)/method/page.tsx  # Method page (server)
│   │   └── api/detect/{text,file,reviews}/route.ts, api/health/route.ts
│   ├── backend/
│   │   ├── config.ts               # ML URL/timeout, rate limits
│   │   ├── text.ts                 # normalise + count words
│   │   ├── detector/               # chunker, features, stylometric, stacker, score, verdict
│   │   ├── analyzers/              # prevalence (Wilson + Rogan–Gladen), specificity, groupSimilarity
│   │   ├── explain/                # evidence (occlusion), sentences, cues
│   │   ├── extractors/             # txt/md, docx, pdf, csv, xlsx + registry
│   │   ├── http/                   # handler, errors, rateLimit
│   │   ├── model/                  # registry (HTTP client, readiness, warmup), meta
│   │   └── pipeline/               # detectText, detectDocument, detectReviews
│   ├── frontend/
│   │   ├── animations/desk.ts      # GSAP intro (stickOn, dropClip, wipeSwipe, playIntro)
│   │   ├── components/             # art, feedback, input, layout, paper, result, reviews
│   │   ├── hooks/                  # useDetect, useReviewsReport, useReducedMotion
│   │   ├── lib/                    # api, format, samples, cn, desk-items, desk-assets.zip
│   │   └── styles/                 # tokens, paper, art, animations, print
│   └── shared/                     # constants.ts, types.ts
├── tests/                          # vitest (11 files incl. 2 desk-art suites)
└── docs/
    ├── project_report.md           # full report (training, quantization, results)
    ├── project_presentation.md
    └── plans/                      # backendPlan, frontendPlan, frontendaddition,
                                    # uiuxPlan, uiaddition, trainingPlanA, trainingPlanB*
```

`docs/*.md` were moved into `docs/plans/` (the old top-level paths are shown as
deleted in `git status`).

---

## 5. Runtime architecture

```text
Browser (Next.js / React)
  └─ /api/detect/*, /api/health        validation, extraction, rate limits
       └─ http://127.0.0.1:8000        ML_SERVICE_URL
            └─ FastAPI (ml/app.py)
                 ├─ DeBERTa-v3  review
                 └─ RoBERTa     document
```

### 5.1 Text flow

`POST /api/detect/text` → Zod validate → rate limit → `detectText`:

1. Reject > 100,000 chars (`too_large`).
2. Normalise text, count words; reject 0 words (`empty_text`).
3. Warnings: `detector_not_proof` always; `short_text` under 40 words.
4. Route: `≤160 words → review`, `>160 words → document` unless `model` is forced.
5. Check model readiness → `503 model_unavailable` if missing.
6. Score, build verdict/confidence; for review also evidence + style cues.

### 5.2 File flow

`POST /api/detect/file` (multipart) → registry picks extractor by
extension/MIME (`.txt`, `.md`, `.docx`, `.pdf`) → join units → truncate to
100,000 chars → force document model → attach `source: { fileName, chars }`.
PDFs with < 200 non-space chars are rejected as `scanned_pdf` (no OCR).

### 5.3 Reviews flow

`POST /api/detect/reviews` accepts JSON `{ reviews: [{ id?, text, rating? }] }`
or a multipart `.csv`/`.xlsx` file. Tabular headers are matched
case-insensitively against `review`, `text`, `body`, `content`, `comment`
(with a `rating` column carried through). CSV handling also strips UTF-8 BOMs,
`sep=` preambles, zero-width characters and supports UTF-16LE; XLSX picks the
first sheet with a recognised header (up to 10 leading preamble rows) and
rejects legacy `.xls` with a save-as message. Reviews under 15 words are skipped.
Remaining texts are batch-scored, converted to verdicts, then aggregated into
flagged count, prevalence (observed + corrected + interval), up to 5 evidence
phrases, and experimental group signals.

### 5.4 Health flow

`GET /api/health` asks FastAPI for both models and returns:

```json
{
  "ok": true,
  "models": { "review": "review-v2", "document": "document-v1" },
  "available": true,
  "ready": { "review": true, "document": true }
}
```

---

## 6. Models and checkpoints

### 6.1 Review model — `review-v2`

| Property | Value |
|---|---|
| Base | `microsoft/deberta-v3-base` (DeBERTaV2, 12 layers, 768 hidden, 12 heads) |
| Head | 2-label sequence classification |
| Params / size | ~184.4M / 737,719,272 B fp32 |
| Max length | 256 tokens |
| Files (`ml/models/review/`) | `config.json`, `model.safetensors`, `tokenizer.json`, `tokenizer_config.json`, `training_args.bin`, `threshold.json` |
| `threshold.json` | `{"margin_threshold": 7.05, "model": "microsoft/deberta-v3-base", "max_len": 256}` |

`margin_threshold = 7.05` is a logit margin (~P(ai) ≈ 0.9991) that this
checkpoint effectively never reaches, so it is **metadata only**. Deployed
verdict cutoffs are provisional: `low = 0.5`, `high = 0.9`
(`THRESHOLD_LOW` / `THRESHOLD_HIGH`), with neutral sensitivity/specificity
(0.5 / 0.5) so prevalence is not falsely corrected.

Observed behaviour: obvious AI reviews ≈ 0.92–0.996, casual human ≈ 0.50,
negative human ≈ 0.36, long human paragraph ≈ 0.02.

### 6.2 Document model — `document-v1`

| Property | Value |
|---|---|
| Base | `Hello-SimpleAI/chatgpt-detector-roberta` (RoBERTa-base, 12 layers, 768 hidden, 12 heads) |
| Params / size | ~124.7M / 498,612,824 B fp32 |
| Checkpoint | `checkpoint-4492` (epoch 2 best, `best_metric = 0.99768`) |
| Max length | 256 tokens per chunk |
| Files (`ml/models/document/`) | `config.json`, `model.safetensors`, `tokenizer.json`, `tokenizer_config.json`, `vocab.json`, `merges.txt`, `special_tokens_map.json`, `document-meta.json` |

`ml/document-meta.json` (tracked):

```json
{
  "version": "document-v1",
  "max_tokens": 256,
  "chunk": { "words": 160, "stride": 120, "min_words": 60 },
  "thresholds": {
    "low": 0.00019910391711164266,
    "high": 0.9962259531021118
  },
  "sensitivity_unseen": 0.9850839030453697,
  "specificity": 0.9800055284253202
}
```

- `low` = 60th percentile of human validation chunks (human-leaning band).
- `high` = 98th percentile (≈ 2% human FPR) → only very high scores are flagged.
- Validation: epoch 2 loss 0.0854, accuracy 0.98377, AUC 0.99768, F1 0.98716.

### 6.3 Model artifacts are out of band

`ml/models/` and `models/` are **gitignored** and must be shared separately
(Drive/Release). Local copies here:

- `models/final_model_v2.zip` (≈ 668 MB)
- `models/models-20261124T102743Z-1-001.zip` (≈ 1.79 GB)

If models are missing, `/api/health` reports `ready: {review:false,
document:false}` and detection routes return `503 model_unavailable`;
validation, extraction, limits and analytics still work.

### 6.4 Optional stylometric stacker (currently absent)

The training plan defines a 22-feature stylometric model plus a logistic
stacker that fuses the transformer probability with the feature probability.
The code supports it (`src/backend/detector/stylometric.ts`,
`stacker.ts`, `score.ts`) and loads `models/meta/stylometric.json` and
`models/meta/stacker.json` at request time. Those files are **not present in
this checkout**, so review scoring silently falls back to the raw DeBERTa
probability. Dropping the two JSON files into `models/meta/` re-enables the
fused score with no code change. `models/meta/golden.json` (legacy golden
fixtures) is also optional; `tests/golden.test.ts` skips without it.

---

## 7. Training workflow

### 7.1 Evaluation protocol (both models)

1. **Human data predates ChatGPT** — Amazon reviews only before 2022-01-01.
2. **Group splits, never random** — by `parent_asin` (reviews) or `doc_id`
   (documents); an item never appears in two splits.
3. **Hold out generators and domains** — test sets contain new LLMs and a new
   domain.
4. **Thresholds fitted on validation only**; final numbers on test.

### 7.2 Part A — review detector

**Data**

| Role | Source | Use |
|---|---|---|
| Human (main) | Amazon Reviews 2023 — `All_Beauty`, `Health_and_Household`, `Amazon_Fashion` | train/val/test human |
| Human (held-out) | `Appliances` | unseen-category test (T4) |
| AI (main) | Synthetic reviews from several open-weight families via **Ollama** | train/val/test AI |
| AI (optional) | RAID reviews, Salminen GPT-2 fake reviews, Yelp/OpSpam | external checks (T5) |

Human filtering: pre-2022, 15–160 words, ≥ 95% ASCII, no duplicates.
AI generation: ≥ 4 generators from different families (e.g. two
Llama/Mistral for training, Qwen/Gemma held out). Four equal modes:

| Mode | Intent |
|---|---|
| `scratch` | write a review from scratch |
| `rephrase` | rewrite a human review preserving meaning |
| `casual` | phone-typing style with minor imperfections |
| `short` | 15–25 word review |

Temperature 0.9, top-p 0.95; strip preambles/quotes/refusals; keep 15–160
words. Target ≈ 3,000 reviews per generator, ~12k human + 12k AI.

**Splits** — human 70/15/15 by `parent_asin`; generators G1/G2 70/15/15,
G3/G4 (+G5) test-only. Evaluation sets:

| Set | Composition | Purpose |
|---|---|---|
| T1 | `h_test` + G1/G2 test | in-distribution |
| T2 | `h_test` + G3/G4/G5 | unseen generators |
| T3 | `h_test` + `casual` mode | adversarial/informal |
| T4 | `Appliances` | unseen category |
| T5 | RAID/OpSpam | external |

**Leakage checks** — logistic regression on length alone and on TF-IDF of the
first three words must both stay at AUC ≤ 0.85; otherwise rebalance
(length-matched per 10-word bin) and strip artefacts.

**Fine-tuning**

| Setting | Value |
|---|---|
| Base | `microsoft/deberta-v3-base` |
| Epochs | 2 |
| Learning rate | 1e-5 |
| Train batch | 16 |
| Gradient accumulation | 2 (effective 32) |
| Eval batch | 64 |
| Weight decay | 0.01 |
| LR schedule | Linear |
| Max grad norm | 1.0 |
| Precision | fp16 |
| Max length | 256 |
| Best metric | AUROC |
| Eval/save | every epoch |
| Seed | 42 |
| Hardware | Colab, NVIDIA T4 |

`Trainer(load_best_model_at_end=True, metric_for_best_model="auroc")`; the
best checkpoint is exported with tokenizer and `training_args.bin`.

### 7.3 Part B — document detector

**Data**

| Source | Content | Role |
|---|---|---|
| **HC3** (`Hello-SimpleAI/HC3`) | human vs ChatGPT answers, domains `finance`, `medicine`, `open_qa`, `reddit_eli5`, `wiki_csai` | in-domain pairs |
| **RAID** (`liamdugan/raid`) | multi-generator/domain, `attack = none`, domains `abstracts`, `books`, `news`, `reddit`, `wiki`, `recipes`, up to 60k docs streamed | generator/domain diversity |

Held out: generators `gpt4`, `cohere-chat`, `mpt-chat`; domain `recipes`.

**Chunking / splits** — 160-word chunks, stride 120 (40 overlap), min 60
words, 256 tokens max. Chunks inherit `doc_id` and are split by `doc_id`
70/15/15. Training chunks capped at 20k/generator and 25k/source, then 1:1
class balance → ~35,936 chunks per epoch (2,246 optimizer steps, batch 16).

**Fine-tuning**

| Setting | Value |
|---|---|
| Base | `Hello-SimpleAI/chatgpt-detector-roberta` |
| Epochs | 2 |
| Learning rate | 1e-5 |
| Train batch | 16 |
| Eval batch | 64 |
| Weight decay | 0.01 |
| Warmup ratio | 0.06 |
| LR schedule | Linear |
| Max grad norm | 1.0 |
| Precision | fp16 |
| Max length | 256 |
| Best metric | AUC |
| Seed | 42 |
| Hardware | Colab T4 |

Document-level aggregation = mean chunk probability + flagged-chunk share.

### 7.4 Artifacts and reproducibility

Seed 42; pinned training stack (`transformers 4.47.1`, `tokenizers 0.21.0`,
`huggingface_hub 0.27.1`); checkpoints saved to Drive; fixed label mapping.
Plans live in `docs/plans/trainingPlanA.md` and
`docs/plans/trainingPlanB_colab.md`.

---

## 8. Inference and scoring logic (TypeScript)

### 8.1 Detector modules

- `detector/chunker.ts` — word-span chunking (`size`, `stride`, `minWords`).
- `detector/features.ts` — 22 stylometric features:
  `log_n_words`, `mean_sent_len`, `std_sent_len`, `cv_sent_len`,
  `max_sent_len`, `ttr`, `avg_word_len`, `comma_ratio`, `exclam_ratio`,
  `question_ratio`, `ellipsis_ratio`, `paren_ratio`, `upper_ratio`,
  `allcaps_word_ratio`, `digit_ratio`, `contraction_ratio`,
  `first_person_ratio`, `nonascii_ratio`, `repeated_bigram_ratio`,
  `sent_start_lower_ratio`, `ends_with_terminal`, `emdash_ratio`.
- `detector/stylometric.ts` — z-scored linear model → sigmoid.
- `detector/stacker.ts` — `sigmoid(w1·logit(p_bert) + w2·logit(p_feat) + b)`.
- `detector/score.ts` — batch transformer score; fuses with stylometric +
  stacker when both JSON files exist, otherwise returns raw `p_bert`.
- `detector/verdict.ts` — `p ≥ high → likely_ai`, `p < low → likely_human`,
  else `uncertain`; confidence from threshold margin, forced `low` under 40
  words.

### 8.2 Document aggregation

`avg(chunk probabilities)`, verdict from document thresholds, per-chunk
`flagged = p ≥ high`, `flaggedShare = flagged / chunks`. Evidence is computed
on the two highest-scoring chunks and offsets are shifted back to document
coordinates.

### 8.3 Evidence (occlusion)

`explain/evidence.ts`: split the text into sentence units (or clauses if one
unit), reconstruct the text with each unit removed, score all variants, and
rank units by `full − without`. Positive drops are returned as the top-k
phrases (review: 3, documents: 2 per top chunk, reviews report: 1 per flagged
review, max 5).

### 8.4 Prevalence (bulk reviews)

- Observed = flagged / analysed.
- Rogan–Gladen: `(observed + specificity − 1) / (sensitivity + specificity − 1)`
  when the denominator > 0.1, clamped to [0, 1].
- Interval: Wilson score interval (z = 1.96) on the observed share, passed
  through the same correction.
- Review model uses 0.5/0.5 (no correction); document metadata has
  0.985/0.980.

### 8.5 Group signals

`analyzers/groupSimilarity.ts`: stop-word skeleton + 4-word shingles + cosine
similarity, union-find clustering at 0.6, reports cluster count and reviews in
clusters. Labelled experimental.

### 8.6 Style cues

`explain/cues.ts`: six z-score rules against human means/stds
(even sentence lengths, no contractions, little personal voice, frequent em
dashes, no informal symbols, every sentence capitalised); shows up to three.

---

## 9. ML service (`ml/app.py`)

| Route | Purpose |
|---|---|
| `GET /health` | readiness + metadata for both models |
| `GET /meta` / `GET /meta/{name}` | metadata (includes a default for `review`) |
| `POST /score` | `{ texts: string[], model: "review" \| "document" }` → `{ probabilities, version, thresholds }` |

Behaviour: models loaded once at startup (`lifespan`), `torch.set_grad_enabled(False)`,
threads from `TORCH_THREADS`, per-model lock, batch loop (`INFER_BATCH_SIZE`),
`softmax(logits)[:, ai_index]`, fp32. `QUANTIZE=1` enables dynamic INT8 (not
recommended — see §10).

`src/backend/model/registry.ts` is the client: 60 s metadata cache,
90 s timeout, readiness checks, `scoreBatch`, `warmup`. If FastAPI is
unreachable → `503 model_unavailable`.

---

## 10. Quantization study (why fp32)

- **Review model — rejected.** Dynamic INT8 collapsed both classes into a
  narrow band around **0.73**; the fp32 separation (0.02–0.996) disappeared.
- **Document model — gated.** Acceptance rule: keep INT8 only if AUC drop
  ≤ 0.005 on 200 validation chunks. No `model_q8.pt` was shipped, so the
  deployed document model is fp32.
- **Decision:** both models run fp32; `QUANTIZE=0` by default. Calibration and
  separation beat the 4× memory saving.

Measured (8 vCPU): review two long texts 1.22 s; document two long texts
1.13 s; 16 long chunks 3.16 s (~197 ms/chunk); API short text 2.61 s; long
document 4.29 s; file upload 4.67 s; 6-review batch 1.09 s; cold start ~11 s.
A 100k-char document projects to ~27–30 s, under the 40 s target.

---

## 11. Limits, errors, privacy

| Control | Value |
|---|---|
| Max text | 100,000 characters |
| Max file | 10 MB |
| Max reviews / request | 150 |
| Min review length (bulk) | 15 words |
| Review/document boundary | 160 words |
| `short_text` warning | < 40 words |
| Rate limits (per IP) | text 30/min, file 10/min, reviews 20/min |
| Model timeout | 90 s |

Error shape: `{ error: { code, message } }` with codes `empty_text` (422),
`no_text_column` (422), `too_large` (413), `too_many` (413),
`unsupported_type` (415),
`scanned_pdf` (422), `rate_limited` (429), `bad_request` (400),
`model_unavailable` (503), `internal` (500).

Privacy: no DB, no body logging, in-memory processing, service binds to
`127.0.0.1`, uploaded text is not returned (only scores, offsets, phrases),
responses always carry `detector_not_proof`.

---

## 12. Frontend workflow (v3 "reading desk")

### 12.1 Design direction

Editorial paper sheet on a grainy desk. The sheet is clean; the only object on
it is a steel paperclip. Scrapbook stickers and pencil sketches live in the
viewport gutters, fixed while the sheet scrolls over them. One saffron accent
(`--spot: #F0A92E`) appears in at most four tiny places per viewport: hero
swipe, active-tab swipe, and up to two washi tapes on sketches.

### 12.2 Routes and components

- `src/app/layout.tsx` — fonts, `<Masthead />`, `{children}`, `<Footer />`, SVG
  `#rough` filter for the stamp.
- `PageShell` — `main.page-shell`, renders `<DeskLayer />` (server component,
  one image per desk item, `aria-hidden`, `alt=""`, lazy, fixed sizes) and
  `<DeskIntro />` (client, runs the GSAP intro scoped to `[data-page-shell]`).
- `PaperSheet` — `.sheet`, optional `clip="tr" | "tl"`; result sheets never
  clip.
- Detector: `ModeTabs` (sliding saffron `.tab-underline`), `TextComposer`,
  `FileDrop`, `SampleChips`, `ResultPanel` (`VerdictStamp`,
  `ProbabilityRule`, `ChunkStrip`, `EvidenceList`, `HighlightedText`,
  `CueList`, `Disclaimer`), `InkLoader`, `ErrorNote`, `EmptyState`.
- Reviews: `ReviewsInput`, `ReviewsReportView`, `PrevalenceFigure`,
  `ReviewRow`, `ClusterNote`.
- Hooks: `useDetect`, `useReviewsReport`, `useReducedMotion`.
- Lib: `api.ts` (typed fetch + error mapping), `format.ts` (percentages,
  verdict labels incl. uncertain→human display), `samples.ts`, `cn.ts`.

### 12.3 Desk art system

- Assets: `public/stickers/sticker-01..07.webp` (RGBA, ≤ 30 KB each),
  `public/sketches/{leaves,flower,circuit-leaf}.webp`. Total ≈ 164 KB
  (budget ≤ 250 KB). Sources documented in `public/stickers/SOURCES.md`.
- Config: `src/frontend/lib/desk-items.ts` — `id, src, kind, w, h, side, top
  (vh), tuck (px), rot (deg), tier ("m" | "l"), tape?`. Current set: 7
  stickers, 3 sketches; `tuck` 8–60 px (≤ 30% of width); rotation within ±9°;
  `tape` only on `sketch-leaves` and `sketch-circuit`.
- Placement: `.desk-item[data-side="l"|"r"]` uses
  `--sheet-half: calc(min(var(--sheet-w), 100vw - 48px) / 2)`, so items tuck
  under the sheet edge.
- Tiers: `≥1280px` full set; `1024–1279px` medium items only (butterfly, tag,
  button); `<1024px` no desk items. The paperclip and grain stay at all sizes.
- Layering: `.desk-layer` is `position: fixed; inset: 0; z-index: -1` so it sits
  above the body grain but below the sheet, the sheet's paper-edge `::before`,
  and masthead/footer text. This deviates from the plan's `z-index: 0` /
  `.sheet { z-index: 1 }` because a `z-index` on `.sheet` would make its
  negative-z paper-edge pseudo paint over the sheet background. `.page-shell`
  only needs `position: relative`.
- Paperclip: fixed `34 × 86` SVG (`26 × 66` under 768 px), `right/left: 48px`
  desktop, `24px` mobile, rotated ±6°, static shadow, hidden on result sheets
  and in print.
- Grain: `body` uses two radial gradients (lamp light + vignette) and two
  inline SVG turbulence layers (long fibres + fine grain); `.sheet` keeps a
  lighter version (alpha 0.10).

### 12.4 Motion

`src/frontend/animations/desk.ts` (GSAP, client only):

- `dropClip(clip)` — `y: -24 → 0`, opacity 0 → 1, 0.5 s `power3.out`, starts
  at 0.55 s (after the CSS `sheet-in` landing).
- `wipeSwipe(swipe)` — `scaleX: 0 → 1`, 0.5 s `power2.out`, starts at 0.45 s.
- `stickOn(layer, 0.5)` — desk items `opacity 0 → 1`, `scale 1.12 → 1`,
  `y: -10 → 0`, 0.45 s each, `power2.out`, stagger 0.09 s.
- `playIntro(scope)` wraps everything in `gsap.context` and returns
  `context.revert()` for cleanup.
- `prefers-reduced-motion: reduce` → no JS animation; everything stays in its
  final CSS state (tab underline transition also disabled in CSS).
- No idle motion, no parallax.

### 12.5 Styles

`globals.css` order: `tailwindcss` → `tokens.css` → `paper.css` → `art.css` →
`animations.css` → `print.css`.

- `tokens.css` — surfaces, ink, signal inks, art tokens (`--spot`,
  `--graphite`, `--clip`, `--clip-shadow`, `--sheet-half`), type scale,
  8px spacing, `--sheet-w: 880px`.
- `paper.css` — grainy `body`, `.sheet` (+ paper-edge `::before`), ruled
  textarea, `.hl` marker (lemon, distinct from saffron), `.stamp`,
  `.marginalia`, `.rule-draw`, buttons, mono labels.
- `animations.css` — CSS keyframes: sheet-in, fade-up, rule-draw, stamp-thump,
  sheet-bounce, highlight-sweep, count-pulse, ink loader, scroll reveal, with
  a reduced-motion block.
- `art.css` — desk layer, stickers/sketches, tape, tiers, clip, hero swipe,
  tab underline, print hiding.
- `print.css` — one-page clean report; hides desk, clip, swipes, nav, footer,
  inputs; keeps stamp/evidence/figures.

---

## 13. Dev workflow

### 13.1 First-time setup

```bash
pnpm install
pnpm ml:install                 # pip install -r ml/requirements.txt

# optional venv
python3 -m venv ml/.venv
source ml/.venv/bin/activate
pnpm ml:install
```

Copy the exported models into `ml/models/review/` and `ml/models/document/`
(see §6 for required files). Keep `ml/document-meta.json` tracked.

### 13.2 Run

```bash
pnpm dev:all      # FastAPI :8000 + Next.js :3000
pnpm dev:ml       # FastAPI only
pnpm dev          # Next.js only
pnpm build && pnpm start
```

### 13.3 Checks (run before calling work done)

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

### 13.4 Tests

| File | Covers |
|---|---|
| `tests/analyzers.test.ts` | prevalence / Wilson / specificity / grouping |
| `tests/api.test.ts` | route handlers, validation, error mapping |
| `tests/chunker.test.ts` | word-span chunking |
| `tests/evidence.test.ts` | occlusion evidence |
| `tests/extractors.test.ts` | txt/md/docx/pdf/csv/xlsx |
| `tests/features.test.ts` | 22-feature parity vs golden JSON |
| `tests/prevalence.test.ts` | Rogan–Gladen + intervals |
| `tests/rateLimit.test.ts` | per-IP limits |
| `tests/desk-art.test.ts` | DeskLayer/PaperClip markup, alt/aria, 34×86 |
| `tests/desk-items.test.ts` | 7/3 budget, tuck limits, valid tiers/sides, assets exist |
| `tests/golden.test.ts` | skipped unless `models/meta/golden.json` exists |

`vitest.config.mts` only includes `tests/**/*.test.ts` (component tests use
`createElement` + `renderToStaticMarkup`).

### 13.5 Adding / refreshing models

1. Train with the plans in `docs/plans/` (Colab T4, seed 42).
2. Export `model.safetensors` + config + tokenizer + `training_args.bin`.
3. Copy into `ml/models/<name>/`, add `threshold.json` (review) or
   `document-meta.json` (document), update `ml/document-meta.json` if the
   document calibration changed.
4. Restart FastAPI; confirm `GET /health` and `GET /meta/{model}`.
5. Re-run `pnpm test` (golden/feature fixtures) and a manual smoke test.
6. Optional: add `models/meta/stylometric.json` + `stacker.json` to re-enable
   the fused review score.

### 13.6 Visual QA

The design plans specify screenshots at 360, 1024 and 1280 px. Current art
rules to confirm: no desk items below 1024 px, medium-only between 1024–1279,
full set at ≥1280; at most 4 saffron areas; clip clean at 360/768/1280; print
preview has no desk/clip/swipe; reduced motion shows the final state.

---

## 14. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | FastAPI base URL |
| `ML_TIMEOUT_MS` | `90000` | Model request timeout |
| `MODELS_ROOT` | `ml/models` | FastAPI models root |
| `REVIEW_MODEL_DIR` | `ml/models/review` | Review model directory |
| `DOCUMENT_MODEL_DIR` | `ml/models/document` | Document model directory |
| `REVIEW_MODEL_VERSION` | `review-v2` | Version string in responses |
| `DOCUMENT_MODEL_VERSION` | `document-v1` | Version string in responses |
| `QUANTIZE` | `0` | Enable dynamic INT8 (not recommended) |
| `TORCH_THREADS` | CPU count | PyTorch CPU threads |
| `INFER_BATCH_SIZE` | `16` | FastAPI batch size |
| `MAX_TEXTS` | `1000` | Max texts per `/score` call |
| `MAX_CHARS` | `100000` | Max chars per text in `/score` |
| `THRESHOLD_LOW` / `THRESHOLD_HIGH` | `0.5` / `0.9` | Provisional review cutoffs |

---

## 15. Open items / known gaps

- `models/meta/stylometric.json` and `stacker.json` are absent → review scores
  are raw DeBERTa probabilities; dropping the files in enables fusion.
- `models/meta/golden.json` absent → `tests/golden.test.ts` skips.
- Model weights and archives are gitignored; they must be shared out of band.
- `src/frontend/lib/desk-assets.zip` is the delivered asset bundle and is still
  untracked; `public/` already contains the extracted files, so it can be
  removed.
- `docs/` was reorganised into `docs/plans/`; the deletion of the old paths is
  staged in the working tree.
- Git push to `https://github.com/Tkapat/txt.git` still needs a PAT (no
  credential helper, SSH rejected).
- Quantization remains rejected for the review model; a future attempt should
  gate on ECE + score distributions, or try ONNX Runtime static per-channel
  quantization.
- Full T1–T5 review benchmark is not stored with the exported checkpoint; the
  served model has only been sanity-checked on held-out-style examples.
