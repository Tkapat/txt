# txt — System Explained

> A narrative companion to the codebase: what the product is, why it exists,
> how the backend, frontend and models work, and which trade-offs were made.
> The terse operational reference is [`curr_workflow.md`](./curr_workflow.md);
> the research write-up is [`project_report.md`](./project_report.md).
>
> Last reviewed: 2026-11-26.

---

## Contents

1. [Introduction, objective, and the gap](#1-introduction-objective-and-the-gap)
2. [Backend and tech stack](#2-backend-and-tech-stack)
3. [Frontend, UI/UX, and tech stack](#3-frontend-uiux-and-tech-stack)
4. [Model training and tech stack](#4-model-training-and-tech-stack)
5. [End-to-end walkthrough](#5-end-to-end-walkthrough)
6. [Design decisions and trade-offs](#6-design-decisions-and-trade-offs)
7. [Known limitations and next steps](#7-known-limitations-and-next-steps)
8. [Quick reference](#8-quick-reference)

---

## 1. Introduction, objective, and the gap

### 1.1 What txt is

`txt` is a local-first AI-authorship detector with three user flows:

- **Detector** — paste text or upload a document, get a probability that it
  reads as AI-written, a verdict, the phrases that drove the score, and style
  cues.
- **Reviews** — analyse a batch of product reviews (paste, CSV or XLSX) and
  estimate what share look AI-written, with an uncertainty range.
- **Method** — a plain-language explanation of accuracy, limits and privacy.

Two fine-tuned transformers do the work: a **review model** for short text and
a **document model** for long text. The Next.js app never loads the weights; it
orchestrates a small local FastAPI + PyTorch service.

The most important design decision is semantic, not technical:

> The models measure **authorship**, not **truthfulness**. The positive class
> means "AI-generated or AI-rephrased", not "fake", "deceptive" or "plagiarised".

Everything else follows from that. The API field is `aiProbability`, the UI says
"reads as likely AI-written", and every response carries a
`detector_not_proof` warning.

### 1.2 The objective

**Product objective.** Give a person a fast, understandable second opinion on a
piece of writing without sending it to a third-party AI API, and without
pretending the answer is certain.

**Technical objectives.**

1. **Two granularities, one routing rule.** Short text and long documents need
   different models, but the user should not have to choose.
2. **Honest uncertainty.** Show a probability, a verdict band, a confidence
   level, and an interval for bulk estimates.
3. **Evidence, not a black box.** Show which phrases raised the score and which
   style cues matched.
4. **Generalise beyond the training set.** Evaluate on unseen generators and an
   unseen domain, not only on a random split.
5. **Run on a normal CPU, locally.** No GPU at serving time, no database, no
   request-body logging.
6. **Be a product, not a notebook.** File extraction, typed API errors, rate
   limits, print output, mobile layout, accessibility.

**Non-goals.** txt does not detect plagiarism, intent, authorship of a specific
person, or whether a factual claim is true. It does not perform OCR. It is not a
moderation verdict system.

### 1.3 The gap in current solutions

The project is not "another classifier with a higher accuracy on one dataset".
It targets six connected gaps that show up when detection leaves the notebook.

#### Gap 1 — "AI-written" is treated as "fake"

Much of the fake-review literature labels reviews as genuine vs. deceptive,
often using human-written spam (OpSpam) or a single LLM. That conflates
**intent** with **authorship**. A person may use AI to fix grammar and still be
honest; a human may write a fake review with no AI at all.

**What txt does:** trains on authorship labels, names the output
`aiProbability`, uses "likely AI-written" wording, and always returns
`detector_not_proof`. The UI never uses the word "fake" for a model result.

#### Gap 2 — Generalisation is rarely measured

Random 80/20 splits let chunks of the same document, or reviews of the same
product, appear in both train and test. Reported accuracy is then optimistic.
Models also degrade when the generator changes, and generators change constantly.

**What txt does:** grouped splits by `parent_asin` (reviews) and `doc_id`
(documents); entire generators (`gpt4`, `cohere-chat`, `mpt-chat`) and an entire
domain (`recipes`, `Appliances`) are held out; leakage baselines check that
length or the first three words alone cannot separate the classes.

#### Gap 3 — Long-form text is under-served

Fake-review work focuses on short reviews. A marketplace also needs to inspect
listings, articles, reports and PDFs. A 256-token classifier cannot read a
20-page document directly.

**What txt does:** adds a second model and a document pipeline: overlapping
160-word chunks, per-chunk scores, a mean probability, a flagged share, and
evidence mapped back to document offsets.

#### Gap 4 — Calibration and honest uncertainty are missing

"0.5" is often an arbitrary line. A probability is not useful if nobody knows
what false-positive rate it implies, and a raw flagged share is a biased
estimate when the detector is imperfect.

**What txt does:** fits thresholds on **human validation text** (60th and 98th
percentiles), records sensitivity and specificity, and applies the
Rogan–Gladen correction plus a Wilson interval for bulk reviews.

#### Gap 5 — Research prototypes rarely become usable tools

Many papers stop at a notebook and a table. Deployment details — file parsing,
size limits, typed errors, rate limiting, evidence rendering, printing — are
where most of the real work lives.

**What txt does:** ships a complete browser product with PDF/DOCX/TXT/MD/CSV/XLSX
ingestion, batch reports, rate limits, responsive layout and a print stylesheet.

#### Gap 6 — CPU and quantization trade-offs are undocumented

Practitioners need to know whether INT8 is safe for a detector that emits
calibrated probabilities.

**What txt does:** documents a clear negative result (dynamic INT8 collapsed the
review model's scores to ~0.73), an AUC-gated acceptance test for the document
model, and ships fp32 for both.

### 1.4 Who it is for

- **Consumers** — a second opinion on a review or product description, with the
  exact phrases that pushed the score.
- **Moderators / platforms** — bulk triage of a review queue, sorted by AI
  probability, with a local tool that never sends user text to a third party.
- **Researchers** — a reproducible two-model baseline with grouped splits,
  held-out generators, calibration metadata and a quantization study.
- **Privacy-sensitive users** — in-memory processing, no database, no body logs.

### 1.5 Success criteria

| Criterion | Target / current status |
|---|---|
| Single-request latency | 40 s target; measured 4.3–4.7 s for a 223–284-word document, ~197 ms per long chunk, 1.2 s for two long review texts (8 vCPU) |
| Memory | ~2 GB free RAM for both fp32 models (737 MB + 499 MB of weights) |
| Privacy | No database, no request-body logging, service bound to `127.0.0.1` |
| Honesty | Every result includes warnings; uncertain is a first-class verdict |
| Reproducibility | Fixed labels, seed 42, pinned training stack, grouped splits |

---

## 2. Backend and tech stack

### 2.1 Architecture at a glance

```text
Browser (Next.js / React)
  │  fetch /api/*
  ▼
Next.js Route Handlers  ── validation, rate limits, extraction, orchestration
  │  JSON over HTTP (127.0.0.1:8000)
  ▼
FastAPI (ml/app.py)  ── batching, tokenisation, fp32 inference
  ├─ DeBERTa-v3   review model
  └─ RoBERTa      document model
```

There are three processes conceptually, but only two in development:

1. **Node/Next.js** — the public surface and all product logic that is not
   tensor arithmetic.
2. **Python/FastAPI** — a thin model server: tokenize, batch, softmax, return
   probabilities.
3. **Browser** — renders results; never sees model weights or raw other users'
   text.

### 2.2 Technology choices and why

| Layer | Choice | Why |
|---|---|---|
| API | Next.js Route Handlers | Same deployment as the UI; no separate API framework to maintain |
| Validation | Zod | One schema per route, typed errors, small runtime |
| Orchestration | TypeScript modules | Chunking, thresholds, evidence and statistics are easier to test and evolve than in Python |
| Model server | FastAPI + Uvicorn | Minimal HTTP surface for PyTorch; easy local start; no vendor lock-in |
| Inference | PyTorch + Transformers | Native `safetensors` checkpoints, full control over batching and quantization |
| Extraction | unpdf, mammoth, papaparse, read-excel-file | One focused library per format |
| Persistence | **None** | Privacy and simplicity; all state is per request |
| Rate limiting | In-memory map | No Redis dependency for a single-instance app |

The original design ran the models in Node with Transformers.js/ONNX. It was
replaced because the exported checkpoints are native PyTorch `safetensors`, and
the Python service gave better control over batching, thresholds and the
quantization experiment. Node still owns everything the user experiences.

### 2.3 The request lifecycle

Every API call follows the same skeleton (`src/backend/http/handler.ts`):

1. **Rate limit** by client IP (`rateLimit.ts`, in-memory).
2. **Parse and validate** the body with Zod (or multipart for files).
3. **Enforce size limits** (characters, file MB, number of reviews).
4. **Extract text** if a file was uploaded.
5. **Normalise** Unicode quotes/line endings and strip control characters.
6. **Choose a pipeline**: text, document, or reviews.
7. **Check model readiness** before doing expensive work.
8. **Score** through the model registry.
9. **Explain** (evidence, cues, prevalence, groups).
10. **Return typed JSON**; on failure return `{ error: { code, message } }`.

Errors never leak stack traces. The handler logs only the error's name; request
bodies are not logged.

### 2.4 API surface

| Method + path | Input | Output |
|---|---|---|
| `POST /api/detect/text` | `{ text, model? }` | `TextResult` or `DocumentResult` |
| `POST /api/detect/file` | multipart `file` (`.txt`, `.md`, `.docx`, `.pdf`) | `DocumentResult` + `source` |
| `POST /api/detect/reviews` | `{ reviews: [...] }` or multipart `.csv`/`.xlsx` | `ReviewsReport` |
| `GET /api/health` | — | `{ ok, models, available, ready }` |

`maxDuration` is 60 s per route. The text route routes automatically:
**≤160 words → review model**, **>160 words → document model**, unless `model`
is forced. The file route always uses the document model.

### 2.5 Text flow

`detectText` (`src/backend/pipeline/detectText.ts`):

1. Reject > 100,000 characters (`too_large`).
2. Normalise text and count words; reject 0 words (`empty_text`).
3. Add warnings: `detector_not_proof` always; `short_text` under 40 words.
4. Route by word count (or forced model).
5. Check readiness → `503 model_unavailable` if the model is missing.
6. **Review path**: score, verdict, confidence, evidence (only when the
   probability is at least the low threshold), style cues (only if the
   stylometric artifact exists).
7. **Document path**: chunk, batch-score, aggregate, evidence.

Verdict bands come from the model metadata:

```text
p ≥ high        → likely_ai
low ≤ p < high  → uncertain
p < low         → likely_human
```

Confidence is a separate signal: `low` under 40 words; otherwise based on the
margin from the nearest threshold (`>0.25 → high`, `>0.1 → medium`, else `low`).
This lets the UI say "likely AI, but low confidence" instead of pretending a
short text is conclusive.

### 2.6 Document flow

`scoreAsDocument` (`detectDocument.ts`):

1. Read chunk parameters from metadata (160 words, stride 120, min 60).
2. `chunkText` splits on word spans, keeping character offsets so evidence can
   be mapped back.
3. Send all chunk texts to the document model in batches.
4. Aggregate: `aiProbability = mean(chunk probabilities)`.
5. Per chunk: `flagged = p ≥ high`.
6. `flaggedShare = flagged / chunks`.
7. Evidence: take the two highest-scoring chunks, run occlusion on each, shift
   phrase offsets back to document coordinates.

Averaging is deliberate. A single extreme chunk should not decide a 20-page
document; the flagged share tells the user *how much* of the document looks
suspicious, which is a more useful signal than one maximum.

### 2.7 File extraction

`src/backend/extractors/` has one module per format and a registry.

| Format | Library | Behaviour |
|---|---|---|
| `.txt`, `.md` | Node | UTF-8, strips BOM |
| `.docx` | mammoth | Raw text from the OOXML package |
| `.pdf` | unpdf | Selectable text only; <200 non-space chars → `scanned_pdf` (no OCR) |
| `.csv` | papaparse | Header matching, BOM/UTF-16/`sep=` handling, single-column comma recovery |
| `.xlsx` | read-excel-file | First sheet with a recognised header, up to 10 preamble rows, optional `rating` |

CSV headers are matched case-insensitively against `review`, `text`, `body`,
`content`, `comment`, with prefix matching as a fallback. XLSX chooses the first
sheet that has such a header, so a workbook with a "Notes" sheet before the data
still works. Legacy `.xls` is rejected with a "save as .xlsx or CSV" message.

The extracted text is truncated to 100,000 characters for documents, and the
response adds a `truncated` warning when that happens. Uploaded text itself is
not returned to the browser.

### 2.8 Reviews flow

`detectReviews` (`detectReviews.ts`):

1. Enforce 150 reviews per request, 100,000 chars each.
2. Normalise; drop reviews under 15 words (counted with `wordCount`).
3. Batch-score the rest with the review model.
4. Per review: probability, verdict, `flagged = p ≥ high`.
5. Aggregate: flagged count, prevalence, top evidence, group signals.
6. Add warnings (`detector_not_proof`, and `short_text` when fewer than 20
   usable reviews).

**Prevalence.** The observed flagged share is not an unbiased AI share because
the detector has errors. The backend applies the Rogan–Gladen correction:

```text
p_hat = (observed + specificity − 1) / (sensitivity + specificity − 1)
```

It is clamped to `[0, 1]` and only applied when the denominator is > 0.1.
The interval is a 95% Wilson interval on the observed share, passed through the
same correction. The review model currently ships neutral 0.5/0.5 values, so the
estimate equals the observed share; the document model has real 0.985/0.980
metadata available.

**Group signals.** Reviews are reduced to a stop-word skeleton, shingled into
4-word windows, compared by cosine similarity, and clustered with union-find at
0.6. Clusters of at least 3 are reported as an experimental signal that many
reviews share the same sentence structure.

### 2.9 The model service

`ml/app.py` exposes:

| Route | Purpose |
|---|---|
| `GET /health` | Readiness + metadata for both models |
| `GET /meta` | Review metadata (backwards-compatible alias) |
| `GET /meta/{name}` | Metadata for one model |
| `POST /score` | `{ texts, model }` → `{ probabilities, version, thresholds }` |

Loading happens once in the FastAPI lifespan:

- `AutoConfig`, `AutoTokenizer`, `AutoModelForSequenceClassification`.
- `model.eval()`, gradients disabled, CPU threads set from `TORCH_THREADS`.
- One lock per model, so concurrent requests cannot interleave a model's state.
- Batching via `INFER_BATCH_SIZE` (default 16), `softmax(logits)[:, ai_index]`.
- Limits: 1,000 texts and 100,000 chars per text per `/score` call.

On the Node side, `src/backend/model/registry.ts` is the client:

- 60 s metadata cache (`/meta/*`).
- 90 s request timeout.
- Readiness check before scoring.
- Validates that the service returned one finite probability in `[0,1]` per
  input.
- Any transport/shape problem becomes `503 model_unavailable`, never a 500.

The optional **stylometric + stacker** layer lives entirely in Node and reads
`models/meta/stylometric.json` and `models/meta/stacker.json`. If both exist,
`score.ts` fuses the transformer logit with a 22-feature stylometric model:
`sigmoid(w1·logit(p_bert) + w2·logit(p_feat) + b)`. If they are missing — as in
this checkout — the transformer probability is returned unchanged, with no
error. The same artifacts power the style cues.

### 2.10 Explainability

**Evidence (occlusion).** `explain/evidence.ts` splits text into sentence units
(or clauses when there are fewer than two sentences), caps at 8 units, then
scores the full text and each "text minus one unit" variant. The drop in
probability is the unit's weight; positive drops are sorted and returned.

- Reviews: top 3 phrases.
- Document: top 2 phrases per top-2 chunk.
- Reviews report: 1 phrase per flagged review, max 5.

This is model-agnostic and cheap at this scale. It also explains *why* a
highlight exists: the phrase's removal measurably lowered the score.

**Style cues.** `explain/cues.ts` has six z-score rules (even sentence lengths,
no contractions, little personal voice, frequent em dashes, no informal symbols,
every sentence capitalised), triggered at ±1.2 standard deviations against human
means. Up to three are shown. They are descriptive, not causal.

### 2.11 Limits, errors, privacy

| Control | Value |
|---|---|
| Max text | 100,000 characters |
| Max upload | 10 MB |
| Max reviews | 150 per request |
| Min bulk review | 15 words |
| Short-text warning | < 40 words |
| Rate limits | text 30/min, file 10/min, reviews 20/min per IP |
| Model timeout | 90 s |

Error codes: `empty_text` (422), `no_text_column` (422), `too_large` (413),
`too_many` (413), `unsupported_type` (415), `scanned_pdf` (422), `rate_limited`
(429), `bad_request` (400), `model_unavailable` (503), `internal` (500).

Privacy properties:

- No database, no accounts, no persistence.
- Text is processed in memory and discarded.
- Request bodies are never logged; only an error name is logged on failure.
- FastAPI binds to `127.0.0.1`.
- Responses contain scores, offsets and phrases, not the uploaded text.

### 2.12 Backend trade-offs

- **TypeScript orchestration vs. all-Python.** Keeping chunking, thresholds and
  statistics in TS makes them unit-testable with the same tooling as the UI,
  and keeps the Python service minimal. The cost is an HTTP hop per batch.
- **No database.** Excellent for privacy and simplicity; the cost is that rate
  limits and caches are per-process and disappear on restart.
- **In-memory rate limiting.** Fine for a single instance; a multi-instance
  deployment would need a shared store. It also shares one counter per IP across
  routes, so mixed traffic is stricter than the per-route table suggests.
- **fp32.** Larger and slower than INT8, but preserves the probability
  separation the product depends on (see §4.5).

---

## 3. Frontend, UI/UX, and tech stack

### 3.1 Design concept: a reading desk

The product is about text, so the interface is built from the metaphors of
reading and editing:

- A warm **paper sheet** sits on a slightly darker **desk**.
- Content is ink: near-black for body, soft grey for secondary text, red for AI
  signals, green for human signals, amber for uncertainty.
- Handwriting (Caveat) appears only as margin notes.
- A single **saffron** accent is used sparingly, like a highlighter.
- A steel **paperclip** is the only object physically attached to the sheet.

The tone is calm and exact. The UI says "reads as likely AI-written", never
"fake" or "caught". "Uncertain" is a designed result, not an error state.

**Five principles** (from the design plan, implemented in the app):

1. **Paper first.** Content sits on warm paper, never on a flat white page.
2. **Ink hierarchy.** Colour carries meaning only alongside words.
3. **Evidence over drama.** Show why; motion supports understanding.
4. **Quiet by default.** One accent animation per moment.
5. **Honest uncertainty.** Ranges, warnings, and visible limits.

### 3.2 Page-by-page UX

**Detector `/`**

1. Hero: "Read between the *lines.*" with a saffron swipe under "lines".
2. Two mono tabs: **Text** and **File**; the active tab has a sliding underline.
3. Text mode: a ruled textarea, live word count, `⌘/Ctrl + Enter` to analyse,
   and two sample chips (human / AI) for a five-second demo.
4. File mode: a dashed drop tray; drag-over tilts the tray 1° and turns the
   border blue; accepts `.txt`, `.md`, `.docx`, `.pdf`, max 10 MB.
5. Loading: an ink line writes itself across the sheet with "Reading…".
6. Result sheet: stamp + probability ruler + warnings + highlighted input text
   + numbered evidence + handwritten cues + disclaimer. Document results also
   show a chunk strip and flagged share.
7. Actions: copy a one-line summary, `Esc` clears the result.

**Reviews `/reviews`**

1. Paste reviews separated by blank lines, or upload a CSV/XLSX.
2. Result: a huge Fraunces percentage ("About 32%"), the 95% interval, the
   analysed/flagged/skipped counts, up to five evidence phrases tagged with
   review IDs, an experimental cluster note, and a per-review table with a
   probability mini-rule and verdict.
3. The table shows 50 rows at a time, with a "show all" control.
4. A clearly labelled "Planned Feature" card mentions a browser extension and
   direct store links — intentionally marked as roadmap, not shipped.

**Method `/method`**

A long single sheet with numbered sections (What it measures, How it works, How
accurate it is, What it cannot do, Privacy, FAQ), separated by drawn rules. It
is a server component: no client JS is needed to read it.

### 3.3 Component and state architecture

- **Pages are thin.** They compose layout, input and result components.
- **No data fetching in components.** `useDetect` and `useReviewsReport` own the
  fetch, abort handling, and a small `useReducer` state machine
  (`idle → loading → success | error`).
- **Typed API client.** `lib/api.ts` wraps `fetch`, maps non-2xx bodies to
  `ApiClientError(code, message, status)`, and never throws raw JSON.
- **Server vs client.** `DeskLayer` is pure markup with no client hooks (no
  state, effects or handlers); `DeskIntro`, inputs, results and the tabs are
  client components. The method page is a server component.
- **Formatting is centralised.** `lib/format.ts` maps verdicts, warnings,
  confidence and percentages to display strings, so copy stays consistent.

### 3.4 Design system

**Tokens** (`styles/tokens.css`) define surfaces, ink, signal inks, art colours,
type, spacing and shape. Everything else consumes the variables.

| Token group | Examples | Purpose |
|---|---|---|
| Surfaces | `--desk #E8E0CF`, `--paper #F6F1E6`, `--paper-edge` | Desk and sheet |
| Ink | `--ink #1C1A17`, `--ink-soft`, `--ink-faint`, `--rule` | Text hierarchy and lines |
| Signals | `--stamp-red`, `--stamp-green`, `--stamp-amber`, `--marker` | AI / human / uncertain / highlight |
| Art | `--spot #F0A92E`, `--clip`, `--clip-shadow`, `--sheet-half` | Decoration only |
| Type | fluid `clamp()` scale | Responsive without breakpoint jumps |
| Space | 4/8/16/24/40/64 px | Consistent rhythm |

**Typography** uses four roles, each with a reason:

| Role | Font | Where |
|---|---|---|
| Display | Fraunces | Wordmark, hero, stamps, big numbers |
| Reading | Newsreader | Inputs, paragraphs, highlighted text |
| Data / labels | IBM Plex Mono | Tabs, buttons, metrics, small labels |
| Handwriting | Caveat | Margin notes only |

Fonts are loaded with `next/font` (self-hosted, `display: swap`), so there is no
third-party request and no layout shift from a webfont flash.

**Paper rendering** is CSS-only:

- `body` has a base desk colour, two radial gradients (lamp light + vignette),
  and two inline SVG turbulence layers: long fibres plus fine grain.
- `.sheet` has a paper colour, a soft multiple shadow, and a lighter grain.
- `.sheet::before` draws a 6 px "paper edge" behind the sheet, offset slightly.
- Ruled textareas use repeating linear gradients, not background images.

**Signal colours are never used alone.** A red stamp always contains the words
"likely AI-written"; a green stamp contains "likely human-written". This keeps
the result usable for colour-blind users and in black-and-white print.

### 3.5 The v3 desk layer (stickers and sketches)

The illustration set is not inline SVG anymore. It is a fixed layer of
transparent WebP assets in the viewport gutters (`public/stickers/`,
`public/sketches/`).

**Why a fixed layer.** The desk stays still while the sheet scrolls over it,
which reads as paper on a desk rather than a decorated page. The layer is
`position: fixed; inset: 0; z-index: -1; pointer-events: none`, so it sits above
the body grain but below the sheet, the sheet's paper edge, and masthead/footer
text.

**Why the specific z-index.** The design plan suggested `z-index: 0` plus
`.sheet { z-index: 1 }`. That breaks the paper edge: `.sheet::before` uses
`z-index: -1`, and a stacking context on `.sheet` would paint the edge over the
sheet background. Leaving the sheet unpositioned-in-z keeps the paint order
correct with no extra stacking contexts.

**Scatter config** (`lib/desk-items.ts`) stores, per item: `id`, `src`, kind
(sticker/sketch), display size, side (`l`/`r`), vertical position in `vh`, tuck
under the sheet in px, rotation in degrees, and a size tier. Ten items ship:
seven stickers and three sketches.

**Responsive tiers.**

| Viewport | What shows |
|---|---|
| `< 1024px` | No gutters: desk items hidden, grain and paperclip remain |
| `1024–1279px` | Medium items only (butterfly, tag, button) |
| `≥ 1280px` | Full set, tucked under the sheet edge via `--sheet-half` |

**Saffron budget.** The accent appears in at most four small places per
viewport: the hero swipe, the active tab underline, and washi tape on two
sketches. This keeps the accent meaningful.

**Assets.** Transparent WebP, ≤30 KB each, ~164 KB total (budget 250 KB).
Stickers get a drop shadow; sketches use `mix-blend-mode: multiply` at 0.8
opacity so they look pencilled onto the desk. The paperclip is the only SVG left
and is the only object on the sheet: 34×86 px, 26×66 px under 768 px, rotated
±6°, with a static shadow.

**Asset pipeline.** `scripts/slice_stickers.py` cuts a sticker sheet into
transparent pieces with OpenCV (near-white mask, connected components, hole
filling, soft edge, thumbnail, WebP). Sources and licences are recorded in
`public/stickers/SOURCES.md`.

### 3.6 Motion

Motion is deliberately small and functional.

- **Page intro (CSS):** the sheet slides up with a slight rotation; content
  fades up with staggered delays.
- **Paperclip (GSAP):** drops in from `y: -24`, opacity 0→1, 0.5 s `power3.out`,
  starting 0.55 s after load.
- **Hero swipe (GSAP):** scaleX 0→1, 0.5 s `power2.out`, starting 0.45 s.
- **Desk items (GSAP):** opacity 0→1, scale 1.12→1, `y: -10→0`, 0.45 s each,
  stagger 0.09 s, `power2.out`.
- **CSS keyframes** cover result entrance, stamp thump, highlight sweep,
  scrolling reveal and the ink loader.

Rules: GSAP stays inside `src/frontend/animations/desk.ts`; animation uses only
`transform` and `opacity`; `prefers-reduced-motion: reduce` skips all JS motion
and shows final states; the total intro stays under two seconds; and input is
never blocked while animating.

### 3.7 Responsive, accessibility, print

- Mobile first; below 768 px the sheet fills the width, evidence moves below the
  text, the stamp scales down.
- Body text meets AA contrast; `--ink-faint` is reserved for ornaments.
- Every control has a visible focus ring and a label; tap targets are 44 px.
- Results are announced politely (`aria-live`), and `lang="en"` is set.
- Colour is always paired with words.
- `print.css` produces a clean one-page report: it removes the desk, clip,
  buttons, nav, footer and inputs, keeps the stamp/figures/evidence, underlines
  highlights instead of using background colour, and avoids breaking a result
  panel across pages.

### 3.8 Frontend tech stack and why

| Choice | Why |
|---|---|
| Next.js 16 App Router | Server components, route handlers and static pages in one app |
| React 19 | Modern concurrent primitives; server/client split |
| TypeScript 5 | Shared types between API and UI (`src/shared/types.ts`) |
| Tailwind CSS 4 | Fast layout utilities; complex visuals live in CSS variables |
| Custom CSS (`styles/`) | Paper, grain, art and motion need more than utilities |
| GSAP 3.15 | Reliable timeline control for the few intro animations |
| `next/font` | Self-hosted fonts, no layout shift, no external request |
| `next/image` | Fixed-size desk assets, lazy loading, optimisation |
| Vitest | Same runner for backend logic and static component markup tests |

### 3.9 Performance budget

- Desk assets: ~164 KB total, each ≤30 KB, lazy and fixed-size.
- No client-side model or large JSON; results are small (scores, offsets,
  phrases).
- Server components for static content (method, desk layer) keep the JS bundle
  focused on interaction.
- Animations use `transform`/`opacity` only; no animated blur or box-shadow.
- Uploads are capped at 10 MB; documents are truncated at 100,000 characters.

### 3.10 UX honesty in practice

- `uncertain` is shown as a real verdict, not hidden.
- Confidence is displayed next to the verdict.
- Short-text and general warnings are always visible, in amber mono type.
- Reviews show the observed count, corrected estimate and interval together.
- The disclaimer is part of the result sheet, not a modal.
- Copy summary produces "txt: 72% likely AI-written (medium confidence).
  Estimate, not proof."

---

## 4. Model training and tech stack

### 4.1 Shared protocol

Both models use the same labels and evaluation rules.

```text
0 = human
1 = ai
id2label = {0: "human", 1: "ai"}
label2id = {"human": 0, "ai": 1}
```

Four rules govern both training runs:

1. **Human data must predate ChatGPT.** Amazon reviews are filtered to before
   2022-01-01, so the human class is not contaminated by post-ChatGPT text.
2. **Split by group, never randomly.** Reviews split by `parent_asin`; document
   chunks split by `doc_id`. A product or document never crosses splits.
3. **Hold out generators and domains.** Test sets contain LLMs and a domain
   never used in training.
4. **Fit thresholds on validation only.** Final metrics are reported on test
   sets; thresholds come from human validation scores.

Training stack: Google Colab with an NVIDIA T4, Hugging Face
`transformers`/`datasets`, scikit-learn metrics, pandas/pyarrow, PyTorch, and
Ollama for synthetic review generation. The pinned stack is
`transformers 4.47.1`, `tokenizers 0.21.0`, `huggingface_hub 0.27.1`; seed 42
everywhere.

### 4.2 Part A — the review detector

**Goal.** Classify 15–160-word product reviews as human or AI, including
AI-rephrased human reviews.

**Data.**

- Human: Amazon Reviews 2023, categories `All_Beauty`,
  `Health_and_Household`, `Amazon_Fashion`; 15–160 words, ≥95% ASCII, no
  duplicates, pre-2022. `Appliances` is held out as an unseen category.
- AI: synthetic reviews from at least four open-weight model families via
  Ollama. Two families train/validate/test; later families are test-only. Four
  equal modes: `scratch`, `rephrase`, `casual`, `short`. Temperature 0.9,
  top-p 0.95; preambles and refusals stripped. Target ≈12k human + ≈12k AI.

**Splits.** Human 70/15/15 by `parent_asin`; generators G1/G2 split 70/15/15;
G3/G4/G5 test-only. Five evaluation sets:

| Set | Composition | Question it answers |
|---|---|---|
| T1 | human test + seen-generator test | In-distribution accuracy |
| T2 | human test + unseen generators | Does it transfer to new LLMs? |
| T3 | human test + `casual` mode | Informal, phone-style AI text |
| T4 | `Appliances` | Does it transfer to a new category? |
| T5 | RAID/OpSpam | External sanity check |

**Leakage checks.** Logistic regression on length alone and on TF-IDF of the
first three words must stay at AUC ≤ 0.85; otherwise data is length-matched and
artefacts are stripped. This prevents "AI reviews are longer" from becoming the
learned signal.

**Fine-tuning.** Base `microsoft/deberta-v3-base`, 2 epochs, lr 1e-5, batch 16
with gradient accumulation 2 (effective 32), eval batch 64, weight decay 0.01,
linear schedule, max grad norm 1.0, fp16, max length 256, best metric AUROC,
seed 42. The best checkpoint is exported with tokenizer and `training_args.bin`.

**Shipped artifact.** 184.4M parameters, 737.7 MB fp32. The exported
`threshold.json` contains a logit margin of 7.05 (≈P(ai)=0.9991), which this
checkpoint effectively never reaches, so it is metadata only. The service uses
provisional probability cutoffs `low=0.5`, `high=0.9` (overridable) and neutral
sensitivity/specificity, because the optional stylometric stacker was not part
of the exported checkpoint.

**Observed behaviour** (sanity checks, not the full benchmark): obvious AI
reviews 0.92–0.996; casual human 0.50; negative human 0.36; long human paragraph
0.02. Separation is preserved; threshold placement remains conservative.

### 4.3 Part B — the document detector

**Goal.** Score long, mixed-topic documents and files without losing locality.

**Data.**

- HC3: human/ChatGPT answer pairs in `finance`, `medicine`, `open_qa`,
  `reddit_eli5`, `wiki_csai`.
- RAID: `attack = none`, domains `abstracts`, `books`, `news`, `reddit`,
  `wiki`, `recipes`, up to 60k documents streamed.
- Held out: generators `gpt4`, `cohere-chat`, `mpt-chat`; domain `recipes`.

**Chunking.** 160 words, stride 120 (40-word overlap), minimum 60 words, max 256
tokens. Chunks inherit the document's label, generator, source and `doc_id`.
Split by `doc_id` 70/15/15. Training chunks are capped at 20k per generator and
25k per source, then balanced 1:1 → ≈35,936 chunks per epoch (2,246 steps with
batch 16).

**Baseline.** The off-the-shelf `Hello-SimpleAI/chatgpt-detector-roberta` is
evaluated on T1/T2/T4 before fine-tuning (AUC, F1, accuracy, FPR, TPR,
TPR@1%FPR). This quantifies the value of fine-tuning instead of assuming it.

**Fine-tuning.** Starts from that HC3-trained checkpoint (not from scratch):
2 epochs, lr 1e-5, batch 16 / eval 64, weight decay 0.01, warmup 0.06, linear,
max grad norm 1.0, fp16, max length 256, best metric AUC, seed 42, T4.

**Results.**

| Epoch | Step | Eval loss | Accuracy | AUC | F1 |
|---|---|---|---|---|---|
| 1 | 2,246 | 0.09757 | 0.98284 | 0.98144 | 0.98644 |
| 2 | 4,492 | **0.08540** | **0.98377** | **0.99768** | **0.98716** |

AUC jumped while accuracy barely moved: most chunks were already classified
correctly after epoch 1, and epoch 2 mainly improved ranking of ambiguous
chunks. The shipped checkpoint is `checkpoint-4492`: 124.7M parameters, 498.6 MB
fp32.

**Thresholds and error rates** (fitted on human validation chunks):

| Metadata | Value | Meaning |
|---|---|---|
| `thresholds.low` | 0.0001991 | 60th percentile of human chunks (human-leaning band) |
| `thresholds.high` | 0.9962260 | 98th percentile of human chunks (≈2% human FPR) |
| `sensitivity_unseen` | 0.9851 | TPR on the unseen-generator test |
| `specificity` | 0.9800 | 1 − FPR on in-distribution human test |

The high threshold is intentionally conservative. Scores between `low` and
`high` are shown as uncertain/human-leaning rather than confidently AI.

**Aggregation.** Mean chunk probability plus flagged share, so one extreme
chunk cannot decide a document. Evidence is computed on the top two chunks and
mapped back to document offsets.

### 4.4 Training tech stack summary

| Component | Tool | Role |
|---|---|---|
| Compute | Google Colab, NVIDIA T4 | Fine-tuning |
| Framework | PyTorch + Hugging Face Transformers | Models, Trainer |
| Data | `datasets`, pandas, pyarrow | HC3, RAID, Amazon, synthetic corpora |
| Metrics | scikit-learn | ROC-AUC, F1, accuracy, FPR/TPR |
| Synthetic data | Ollama + open-weight LLMs | AI review generation |
| Splitting | `GroupShuffleSplit` | Product/document grouping |
| Export | `safetensors`, tokenizer files | Local PyTorch serving |
| Serving | FastAPI + Uvicorn | `/score`, `/health`, `/meta` |

### 4.5 Quantization study (why fp32)

Dynamic INT8 converts `nn.Linear` weights to 8-bit integers at inference,
theoretically ~4× less memory and faster CPU math. The catch is distribution
shift, which matters when the product displays calibrated probabilities.

- **Review model — rejected.** After dynamic INT8, both classes collapsed to a
  narrow band around **0.73**. The fp32 range (0.019–0.996) disappeared, and with
  it the thresholds and evidence.
- **Document model — gated.** Acceptance rule: keep INT8 only if AUC drops by
  ≤0.005 on 200 validation chunks. No INT8 weights were shipped, so the document
  model also runs fp32.
- **Conclusion.** An AUC-gated test is better than a maximum-difference test, but
  still not sufficient for calibrated probabilities. A future attempt should also
  check expected calibration error and the score distributions at the chosen
  thresholds.

### 4.6 From checkpoint to product

```text
ml/models/
├── review/    config.json, model.safetensors, tokenizer*, training_args.bin, threshold.json
└── document/  config.json, model.safetensors, tokenizer*, vocab.json, merges.txt, document-meta.json
```

- `ml/models/` and the zipped exports in `models/` are **git-ignored**; they are
  shared out of band.
- `ml/document-meta.json` is tracked so calibration survives a fresh extraction.
- FastAPI reads `ml/models/review/threshold.json` and
  `ml/models/document/document-meta.json` (falling back to the tracked copy).
- Node reads the thresholds from FastAPI, not from disk, with a 60 s cache.
- If models are absent, `/api/health` reports `ready: false` and detection routes
  return `503`, while validation, extraction and analytics still work.

### 4.7 What the numbers mean — and what they do not

- The Part A T1–T5 table was **not stored** with the exported checkpoint; the
  served review model has been sanity-checked on held-out-style examples, not
  re-benchmarked end to end.
- Document metrics in the report are **chunk-level validation** numbers. The
  unseen-generator and unseen-domain outcomes are summarised in metadata
  (`sensitivity_unseen`, `specificity`), not as a full per-set table here.
- Thresholds bound the human false-positive rate on validation, but the world
  drifts: new generators, new domains, editing tools.
- Human review text is inherently noisy: sarcasm, non-native English, heavy
  editing, and very short text all reduce reliability.

---

## 5. End-to-end walkthrough

### 5.1 A pasted essay (illustrative)

1. The browser posts 300 words to `/api/detect/text`.
2. The route rate-limits, validates with Zod, and checks the 100,000-char cap.
3. `detectText` normalises the text, counts 300 words, adds
   `detector_not_proof`, and routes to the **document** model.
4. `requireModel("document")` asks FastAPI `/health`; both models report ready.
5. The chunker produces overlapping 160-word windows with character offsets.
6. `scoreBatch("document", chunks)` → FastAPI tokenises, batches, runs fp32
   inference, returns one probability per chunk.
7. The pipeline averages them, flags chunks above 0.9962, computes the flagged
   share, and builds the chunk strip.
8. Evidence runs occlusion on the top two chunks; offsets are shifted back.
9. The response includes probability, verdict, confidence, chunks, flagged
   share, evidence and warnings.
10. The UI renders the stamp, ruler, chunk strip, highlights and disclaimer.

### 5.2 A single review

Same steps, but routed to the **review** model. The result also includes style
cues when `models/meta/stylometric.json` exists. Evidence is computed only if
the probability is at least the low threshold, so a clearly human text does not
get spurious highlights.

### 5.3 A bulk CSV/XLSX

1. The browser uploads a file to `/api/detect/reviews`.
2. The extractor finds the `review`-like column, maps `rating` if present, and
   returns up to 5,000 units.
3. `detectReviews` caps at 150, drops reviews under 15 words, and batch-scores
   the rest.
4. It aggregates flagged count, prevalence (observed, corrected, interval), up to
   five evidence phrases from flagged reviews, and group signals.
5. The UI shows the big estimate, counts, range, evidence, cluster note and the
   per-review table.

### 5.4 A document file

`/api/detect/file` extracts text by format, truncates at 100,000 characters,
forces the document model, and attaches `source: { fileName, chars }`. PDFs with
no selectable text are rejected (`scanned_pdf`) because OCR is out of scope.

---

## 6. Design decisions and trade-offs

| Decision | Reason | Cost |
|---|---|---|
| Two models + routing rule | Short reviews and long documents have different signal and context limits | Two artifacts, two thresholds |
| TS orchestration, Python inference | Testable product logic + native PyTorch checkpoints | One HTTP hop per batch |
| No database | Privacy, simplicity, no migrations | No history, in-memory rate limits |
| Local FastAPI | No text leaves the machine; no API cost | Manual model placement; CPU latency |
| fp32 | Preserves calibrated separation | ~1.2 GB of weights, slower |
| Grouped splits + held-out generators | Measures transfer, not memorisation | Harder training set, lower headline numbers |
| Thresholds from human validation | Bounds false positives; honest uncertainty | Review thresholds currently provisional |
| Evidence via occlusion | Model-agnostic, explainable phrases | Extra scoring passes |
| Paper/desk visual system | Memorable, trustworthy, fits the subject | More CSS and asset work than a dashboard |
| Decorative art hidden <1024 px | Keeps mobile clean and fast | Visual asymmetry across breakpoints |
| GSAP limited to one module | Predictable, small motion surface | No rich scroll choreography |
| Print stylesheet | Results are shareable offline | Extra CSS to maintain |

---

## 7. Known limitations and next steps

### 7.1 Current limitations

- **Review calibration is provisional.** The exported `margin_threshold` is not
  usable as a verdict line; `0.5/0.9` are deliberate operational defaults.
- **Stylometric + stacker artifacts are absent** from the checkout, so review
  scores are raw transformer probabilities and style cues are disabled. Adding
  `models/meta/stylometric.json` and `stacker.json` enables both with no code
  change.
- **The full T1–T5 review benchmark is not stored** with the checkpoint.
- **English-centric.** Tokenisation and word counting are Latin-script oriented;
  training data is English. Non-native writing can be misclassified.
- **No OCR.** Scanned PDFs are rejected.
- **Concept drift.** New LLMs and editing tools can move the distribution away
  from training.
- **Rate limiting is per-process and shared across routes.** A restart clears
  it; multiple instances would not share counters.
- **No authentication or abuse controls** beyond per-IP rate limits.
- **XLSX edge cases.** Merged/multi-row headers beyond the first 10 preamble
  rows and legacy `.xls` are not supported.
- **Method page copy is stale.** It still mentions "DistilBERT + stylometric
  features + stacker" for the review model; the shipped checkpoint is
  DeBERTa-v3-base. The pipeline description is otherwise accurate.
- **Models are out-of-band.** A fresh clone cannot run detection until
  `ml/models/` is populated.

### 7.2 Next steps

1. **Recalibrate the review model** on validation humans, store real
   sensitivity/specificity, and add expected-calibration-error checks.
2. **Ship the stylometric/stacker artifacts** (or remove the dangling code
   path), and fix the method-page copy.
3. **Expand unseen-generator evaluation** into a stored, versioned T1–T5 table
   and report it in the Method page.
4. **Multilingual support** with language-aware tokenisation and per-language
   thresholds.
5. **OCR** for scanned PDFs, ideally as an optional local component.
6. **Persistent/shared rate limiting** and request IDs for multi-instance
   deployments.
7. **Optional ONNX Runtime** export for lower CPU overhead, validated against
   the fp32 score distributions.
8. **Browser extension / store-link flow** (already surfaced as a planned
   feature in the Reviews UI).

---

## 8. Quick reference

### 8.1 Commands

```bash
pnpm install
pnpm ml:install
pnpm dev:all            # FastAPI :8000 + Next.js :3000
pnpm dev                # Next.js only
pnpm dev:ml             # FastAPI only
pnpm build && pnpm start
pnpm typecheck
pnpm lint
pnpm test
```

### 8.2 Environment variables

| Variable | Default | Used by |
|---|---|---|
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | Next.js |
| `ML_TIMEOUT_MS` | `90000` | Next.js |
| `MODELS_ROOT` | `ml/models` | FastAPI |
| `REVIEW_MODEL_DIR` / `DOCUMENT_MODEL_DIR` | under `MODELS_ROOT` | FastAPI |
| `REVIEW_MODEL_VERSION` / `DOCUMENT_MODEL_VERSION` | `review-v2` / `document-v1` | FastAPI |
| `QUANTIZE` | `0` | FastAPI (not recommended) |
| `TORCH_THREADS` | CPU count | FastAPI |
| `INFER_BATCH_SIZE` | `16` | FastAPI |
| `MAX_TEXTS` / `MAX_CHARS` | `1000` / `100000` | FastAPI `/score` |
| `THRESHOLD_LOW` / `THRESHOLD_HIGH` | `0.5` / `0.9` | FastAPI review defaults |

### 8.3 Key files

| Concern | File |
|---|---|
| API routes | `src/app/api/detect/*/route.ts`, `src/app/api/health/route.ts` |
| Pipelines | `src/backend/pipeline/` |
| Scoring / verdicts | `src/backend/detector/` |
| Evidence / cues | `src/backend/explain/` |
| Statistics | `src/backend/analyzers/` |
| Extraction | `src/backend/extractors/` |
| Model client | `src/backend/model/registry.ts` |
| Model service | `ml/app.py` |
| Pages | `src/app/(site)/` |
| Frontend components | `src/frontend/components/` |
| Hooks / API client | `src/frontend/hooks/`, `src/frontend/lib/api.ts` |
| Design tokens / CSS | `src/frontend/styles/` |
| Desk art | `src/frontend/lib/desk-items.ts`, `src/frontend/components/art/` |
| Motion | `src/frontend/animations/desk.ts` |
| Model metadata | `ml/document-meta.json`, `ml/models/*/threshold.json` |
| Training plans | `docs/plans/trainingPlanA.md`, `docs/plans/trainingPlanB_colab.md` |
| Full report | `docs/project_report.md` |
| Operational reference | `docs/curr_workflow.md` |
