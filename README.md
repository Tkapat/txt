# txt

AI-writing detection for text, documents and product reviews. The app is a single Next.js project: a thin App Router HTTP layer over a typed TypeScript backend that runs the trained ONNX models locally.

The backend design is documented in [`docs/backendPlan.md`](docs/backendPlan.md).

## Requirements

- Node.js 24 or newer (`unpdf` requires Node 24)
- pnpm 10

## Setup

```bash
pnpm install
```

Copy the exported models from Team A into the project root. The directory is git-ignored and must be shared out of band (Drive or a Release):

```text
models/
├── review/
│   ├── config.json
│   ├── tokenizer.json
│   ├── tokenizer_config.json
│   └── onnx/model_quantized.onnx
├── document/
│   └── ... same layout ...
└── meta/
    ├── review-meta.json
    ├── document-meta.json
    ├── stylometric.json
    ├── stacker.json
    └── golden.json
```

Until the models are present, `/api/health` returns `available: false` and the detection routes return `503 model_unavailable`. Everything else (validation, limits, extractors, analytics) works.

## Run

```bash
pnpm dev       # development server on http://localhost:3000
pnpm build     # production build
pnpm start     # production server
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`tests/golden.test.ts` runs automatically once `models/meta/golden.json` exists. The feature-parity tests also run against the checked-in Python reference vectors in `tests/fixtures/features-golden.json`.

## API

| Method + path | Body | Returns |
|---|---|---|
| `POST /api/detect/text` | `{ text: string, model?: "review" \| "document" }` | `TextResult` or `DocumentResult` |
| `POST /api/detect/file` | multipart `file` (`.txt`, `.md`, `.docx`, `.pdf`) | `DocumentResult` with `source` |
| `POST /api/detect/reviews` | JSON `{ reviews: ReviewInput[] }` or multipart CSV `file` | `ReviewsReport` |
| `GET /api/health` | none | `{ ok, models, available }` |

Errors use `{ error: { code, message } }` with codes such as `empty_text` (422), `too_large` (413), `unsupported_type` (415), `scanned_pdf` (422), `rate_limited` (429), `bad_request` (400), `model_unavailable` (503) and `internal` (500).

Limits: 100,000 characters per text, 10 MB per file, 500 reviews per request, and per-IP request rate limits.

## Privacy

No database and no request-body logging. User text is processed in memory and discarded. The API responses include a `detector_not_proof` warning because the model output is evidence, not proof.

## Deployment

`onnxruntime-node` is large. Run this on a Node server or in Docker (VPS, Railway, Render, a Hugging Face Space) rather than a serverless function with a small bundle limit.

API route handlers run on the Node.js runtime by default. Cache Components is enabled, so the project does not export the deprecated `runtime` route segment config.
