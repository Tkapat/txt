# txt

AI-writing detection for text, documents, and product reviews. The app is a Next.js UI and API layer backed by a small local **FastAPI + PyTorch** service that runs two fine-tuned transformers on CPU.

- **Review model** — `review-v2`, DeBERTa-v3-base. Short reviews (15–160 words).
- **Document model** — `document-v1`, RoBERTa-base. Long text up to 100,000 characters, scored in overlapping chunks.

Both models run in **fp32** by default. Dynamic INT8 is available with `QUANTIZE=1` but is not recommended; see [`docs/project_report.md`](docs/project_report.md#4-quantization).

## Architecture

```text
Browser (Next.js / React)
  └─ /api/detect/* and /api/health  (validation, extraction, rate limits)
       └─ http://127.0.0.1:8000     (ML_SERVICE_URL)
            └─ FastAPI (ml/app.py)
                 ├─ DeBERTa-v3  review
                 └─ RoBERTa     document
```

## Requirements

- Node.js 24 or newer (`unpdf` requires Node 24)
- pnpm 10
- Python 3.10+ with `venv`/`pip` (tested with 3.14)
- ~2 GB free RAM for both fp32 models

## Setup

```bash
pnpm install
pnpm ml:install        # pip install -r ml/requirements.txt
```

Optionally use a virtual environment:

```bash
python3 -m venv ml/.venv
source ml/.venv/bin/activate
pnpm ml:install
```

Copy the exported models into `ml/models/`. The directory is git-ignored and must be shared out of band (Drive or a Release). Required files:

```text
ml/models/
├── review/
│   ├── config.json
│   ├── model.safetensors
│   ├── tokenizer.json
│   ├── tokenizer_config.json
│   ├── training_args.bin      # optional
│   └── threshold.json         # optional calibration metadata
├── document/
│   ├── config.json
│   ├── model.safetensors
│   ├── tokenizer.json
│   ├── tokenizer_config.json
│   ├── vocab.json
│   ├── merges.txt
│   ├── special_tokens_map.json
│   └── document-meta.json     # optional; falls back to ml/document-meta.json
└── ...
```

`ml/document-meta.json` is tracked so the document thresholds and error rates survive a fresh model extraction. If the models are missing, `/api/health` reports `ready: { review: false, document: false }` and detection routes return `503 model_unavailable`; validation, extraction, limits, and analytics still work.

## Run

```bash
pnpm dev:all     # FastAPI on :8000 + Next.js on :3000
```

Or run the services separately:

```bash
pnpm dev:ml      # FastAPI model service
pnpm dev         # Next.js app
```

Production:

```bash
pnpm build
pnpm start
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm dev:ml` | FastAPI service on `127.0.0.1:8000` |
| `pnpm dev:all` | Both services in one command |
| `pnpm ml:install` | Install Python dependencies |
| `pnpm build` | Production build |
| `pnpm start` | Production Next.js server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm test:watch` | Vitest watch mode |

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`tests/golden.test.ts` is skipped unless the legacy golden fixture (`models/meta/golden.json`) is present. Feature-parity tests run against `tests/fixtures/features-golden.json`.

## API

| Method + path | Body | Returns |
|---|---|---|
| `POST /api/detect/text` | `{ text: string, model?: "review" \| "document" }` | `TextResult` or `DocumentResult` |
| `POST /api/detect/file` | multipart `file` (`.txt`, `.md`, `.docx`, `.pdf`) | `DocumentResult` with `source` |
| `POST /api/detect/reviews` | JSON `{ reviews: ReviewInput[] }` or multipart CSV `file` | `ReviewsReport` |
| `GET /api/health` | none | `{ ok, models, available, ready }` |

Text routes automatically: **≤160 words → review**, **>160 words → document**. `POST /api/detect/file` always uses the document model.

Errors use `{ error: { code, message } }` with codes such as `empty_text` (422), `too_large` (413), `unsupported_type` (415), `scanned_pdf` (422), `rate_limited` (429), `bad_request` (400), `model_unavailable` (503), and `internal` (500).

Limits: **100,000 characters** per text, **10 MB** per file, **150 reviews** per request, **15 words** minimum for bulk review analysis, and per-IP rate limits (text 30/min, file 10/min, reviews 20/min).

PDF support requires selectable text. Scanned/image-only PDFs are rejected with `scanned_pdf` because OCR is not implemented.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | FastAPI base URL |
| `ML_TIMEOUT_MS` | `90000` | Model request timeout |
| `REVIEW_MODEL_DIR` | `ml/models/review` | Review model directory |
| `DOCUMENT_MODEL_DIR` | `ml/models/document` | Document model directory |
| `QUANTIZE` | `0` | Enable dynamic INT8 (not recommended) |
| `TORCH_THREADS` | CPU count | PyTorch CPU threads |
| `THRESHOLD_LOW` / `THRESHOLD_HIGH` | `0.5` / `0.9` | Provisional review cutoffs |

## Privacy

No database and no request-body logging. User text is processed in memory and discarded. Models run locally; the service binds to `127.0.0.1` by default. API responses include a `detector_not_proof` warning because the output is evidence, not proof.

## Deployment

Run both processes on the same machine or container: a Node 24 host for Next.js and a Python host for FastAPI. The Python service needs the model files and about 2 GB of RAM. Avoid serverless functions with small bundle or memory limits; a VM, Docker, or a small dedicated server is the right fit.

## Documentation

- [`docs/project_report.md`](docs/project_report.md) — full project report (gap, training, quantization, results)
- [`docs/project_presentation.md`](docs/project_presentation.md) — 10-slide presentation
- [`docs/backendPlan.md`](docs/backendPlan.md) — backend design
- [`docs/frontendPlan.md`](docs/frontendPlan.md) — frontend design
- [`docs/trainingPlanA.md`](docs/trainingPlanA.md) — review model training plan
- [`docs/trainingPlanB_colab.md`](docs/trainingPlanB_colab.md) — document model Colab notebook
