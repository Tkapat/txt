# txt: Frontend Plan (Next.js, App Router, TypeScript)

> Audience: Team C and any AI coding agent. The visual design is defined in `04_UIUX_DESIGN_PLAN.md`; build the structure here, then apply the design system.
> Backend contract: `02_BACKEND_PLAN.md`, section 11. Types come from `@/shared/types`.

## 1. Principles

1. **Thin routes, fat feature folders.** Files in `src/app/**` only compose components.
2. **One place for each concern:** API calls in `lib/api.ts`, state in hooks, animation in `animations/`, styling tokens in `styles/`.
3. **Every screen has four states:** empty, loading, result, error. None is optional.
4. **No login, no storage.** Nothing is saved in the browser except optional UI preferences.
5. **Accessible by default:** keyboard operable, visible focus, screen-reader labels, reduced-motion support.
6. Wording is calm and non-accusatory: "reads as likely AI-written", never "fake".

## 2. Pages

| Route | Purpose |
|---|---|
| `/` | **Workbench:** paste text or upload a file, see the verdict, highlighted evidence and confidence. |
| `/reviews` | **Review analyzer:** paste reviews or upload CSV, see the percentage with range, counts, 3+ evidence phrases, similarity note. A "link / browser extension" card marks the future feature. |
| `/method` | How it works, accuracy and limits, privacy, FAQ. Honest limitations are part of the product. |

## 3. Folder structure (frontend part)

```
src/
├── app/
│   ├── layout.tsx                      # fonts, <html>, Masthead, Footer
│   └── (site)/
│       ├── page.tsx                    # Workbench
│       ├── reviews/page.tsx
│       └── method/page.tsx
├── frontend/
│   ├── components/
│   │   ├── layout/    Masthead.tsx  Footer.tsx  PageShell.tsx
│   │   ├── paper/     PaperSheet.tsx  Stamp.tsx  Marginalia.tsx  RuleLine.tsx
│   │   ├── input/     ModeTabs.tsx  TextComposer.tsx  FileDrop.tsx  SampleChips.tsx
│   │   ├── result/    ResultPanel.tsx  VerdictStamp.tsx  ProbabilityRule.tsx  HighlightedText.tsx
│   │   │              EvidenceList.tsx  CueList.tsx  ChunkStrip.tsx  Disclaimer.tsx
│   │   ├── reviews/   ReviewsInput.tsx  ReviewsReportView.tsx  PrevalenceFigure.tsx  ReviewRow.tsx  ClusterNote.tsx
│   │   └── feedback/  InkLoader.tsx  ErrorNote.tsx  EmptyState.tsx
│   ├── hooks/         useDetect.ts  useReviewsReport.ts  useReducedMotion.ts
│   ├── animations/    intro.ts  stamp.ts  highlights.ts  counter.ts  scrollReveal.ts   # GSAP only here
│   ├── lib/           api.ts  format.ts  samples.ts  cn.ts
│   └── styles/        tokens.css  paper.css  print.css  globals.css
└── shared/            types.ts  constants.ts     # shared with the backend
```

Rule: components never call `fetch` directly (use the hooks), and GSAP code lives in `animations/` (called from components through `useGSAP`).

## 2b. Data flow

```
Input component ──▶ hook (useDetect / useReviewsReport) ──▶ lib/api.ts ──▶ /api/detect/*
        ▲                         │ state: idle | loading | success | error
        └──── ResultPanel / ReviewsReportView read the state ◀──┘
```

## 4. API client

```ts
// src/frontend/lib/api.ts
import type { ApiErrorBody, DocumentResult, ReviewInput, ReviewsReport, TextResult } from "@/shared/types";

export class ApiClientError extends Error { constructor(public code: string, message: string, public status: number) { super(message); } }

async function request<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try { res = await fetch(url, { ...init, signal }); }
  catch (e) { if ((e as Error).name === "AbortError") throw e; throw new ApiClientError("network", "Could not reach the server. Check your connection.", 0); }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(body?.error.code ?? "unknown", body?.error.message ?? "Something went wrong.", res.status);
  }
  return res.json() as Promise<T>;
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const form = (file: File): RequestInit => { const f = new FormData(); f.append("file", file); return { method: "POST", body: f }; };

export const api = {
  detectText: (text: string, s?: AbortSignal) => request<TextResult | DocumentResult>("/api/detect/text", json({ text }), s),
  detectFile: (file: File, s?: AbortSignal) => request<DocumentResult>("/api/detect/file", form(file), s),
  detectReviews: (reviews: ReviewInput[], s?: AbortSignal) => request<ReviewsReport>("/api/detect/reviews", json({ reviews }), s),
  detectReviewsCsv: (file: File, s?: AbortSignal) => request<ReviewsReport>("/api/detect/reviews", form(file), s),
};
```

## 5. State hook (one pattern for all pages)

```ts
// src/frontend/hooks/useDetect.ts
"use client";
import { useCallback, useReducer, useRef } from "react";
import { api, ApiClientError } from "@/frontend/lib/api";
import type { DocumentResult, TextResult } from "@/shared/types";

type State = { status: "idle" } | { status: "loading" } | { status: "success"; result: TextResult | DocumentResult; input: string }
           | { status: "error"; message: string; code: string };
type Action = { type: "start" } | { type: "ok"; result: TextResult | DocumentResult; input: string } | { type: "fail"; message: string; code: string } | { type: "reset" };
const reducer = (s: State, a: Action): State =>
  a.type === "start" ? { status: "loading" } : a.type === "ok" ? { status: "success", result: a.result, input: a.input }
  : a.type === "fail" ? { status: "error", message: a.message, code: a.code } : { status: "idle" };

export function useDetect() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" } as State);
  const ctrl = useRef<AbortController | null>(null);
  const run = useCallback(async (input: string | File) => {
    ctrl.current?.abort(); ctrl.current = new AbortController(); dispatch({ type: "start" });
    try {
      const result = typeof input === "string" ? await api.detectText(input, ctrl.current.signal) : await api.detectFile(input, ctrl.current.signal);
      dispatch({ type: "ok", result, input: typeof input === "string" ? input : "" });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const err = e as ApiClientError; dispatch({ type: "fail", message: err.message, code: err.code ?? "unknown" });
    }
  }, []);
  return { state, run, reset: () => dispatch({ type: "reset" }) };
}
```
`useReviewsReport` has the same shape but calls `api.detectReviews` or `api.detectReviewsCsv`.

## 6. Key components

### 6.1 `TextComposer` (paste area)
Props: `onSubmit(text)`, `disabled`. Behaviour: shows live word count, warns under 40 words ("Short text is less reliable"), disables the button when empty or over `MAX_TEXT_CHARS`, submit with `Ctrl/Cmd + Enter`, `SampleChips` fill in a sample human and a sample AI text.

### 6.2 `FileDrop`
Validates **before upload**, using the same constants as the backend.

```tsx
// src/frontend/components/input/FileDrop.tsx (core logic)
const OK_EXT = /\.(txt|md|docx|pdf)$/i;
export function validateFile(f: File): string | null {
  if (!OK_EXT.test(f.name)) return "Please choose a .txt, .md, .docx or .pdf file.";
  if (f.size > MAX_FILE_MB * 1024 * 1024) return `File is larger than ${MAX_FILE_MB} MB.`;
  return null;
}
```
Supports drag and drop plus a keyboard-accessible "Choose file" button, shows file name and size, and a clear "Remove" action.

### 6.3 `HighlightedText` (shows the evidence in the original text)
Input: `text`, `evidence[]`, `chunks?[]`, `activeId`. It builds non-overlapping segments from `start/end` offsets so every highlight is exactly the evidence the API returned.

```tsx
// src/frontend/components/result/HighlightedText.tsx
import type { ChunkResult, PhraseEvidence } from "@/shared/types";
type Seg = { text: string; evidenceIndex: number | null };

export function toSegments(text: string, ev: PhraseEvidence[]): Seg[] {
  const sorted = ev.map((e, i) => ({ ...e, i })).sort((a, b) => a.start - b.start);
  const segs: Seg[] = []; let cursor = 0;
  for (const e of sorted) {
    if (e.start < cursor || e.end > text.length) continue;                 // skip overlaps and bad offsets
    if (e.start > cursor) segs.push({ text: text.slice(cursor, e.start), evidenceIndex: null });
    segs.push({ text: text.slice(e.start, e.end), evidenceIndex: e.i }); cursor = e.end;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor), evidenceIndex: null });
  return segs;
}

export function HighlightedText({ text, evidence, activeIndex, onHover }: {
  text: string; evidence: PhraseEvidence[]; activeIndex: number | null; onHover: (i: number | null) => void }) {
  return (
    <p className="reading-text" data-testid="highlighted-text">
      {toSegments(text, evidence).map((s, k) => s.evidenceIndex === null ? <span key={k}>{s.text}</span> : (
        <mark key={k} className="hl" data-active={activeIndex === s.evidenceIndex} data-ev={s.evidenceIndex}
              onMouseEnter={() => onHover(s.evidenceIndex)} onMouseLeave={() => onHover(null)}>{s.text}</mark>))}
    </p>
  );
}
```
For uploaded files the original text is not returned (privacy and size). Show the `ChunkStrip` instead: a row of small blocks coloured by chunk probability, and list the top evidence phrases with their text.

### 6.4 Other result components

| Component | Shows |
|---|---|
| `VerdictStamp` | A stamp: "Likely AI-written", "Uncertain" or "Likely human-written", plus the confidence word. |
| `ProbabilityRule` | A ruler-style bar from 0 to 100 with a marker at `aiProbability`, and tick marks at the low and high thresholds. |
| `EvidenceList` | 3 quoted phrases with weight, numbered to match the highlights. Hover or focus links to the highlight. |
| `CueList` | Style cues as short margin notes. |
| `ChunkStrip` | Document chunks as a strip, with `flaggedShare` text. |
| `Disclaimer` | One fixed paragraph: probabilities, not proof; may be wrong; AI-assisted does not mean fake. |

### 6.5 Reviews components

| Component | Shows |
|---|---|
| `ReviewsInput` | Textarea (one review per blank-line-separated block) and CSV upload, count preview, limit hint (500). |
| `PrevalenceFigure` | Large "about 32% (range 24-41%)", "x of y analysed reviews flagged", count of skipped short reviews. Count-up animation. |
| `ReviewsReportView` | Prevalence, **3+ evidence quotes with review IDs**, cluster note, sortable review table. |
| `ReviewRow` | Truncated text, probability mini-rule, verdict word. Expands on click. |
| `ClusterNote` | "N reviews share the same sentence structure" with an "experimental" tag. |

## 7. Edge cases the UI must handle

- Empty input, whitespace only, over the length limit
- Short text (`short_text` warning), non-English text (`english_only` hint)
- Scanned PDF (`scanned_pdf` code) with a clear message
- Network failure and 429 ("Too many requests, wait a minute")
- Slow response: after 3 seconds show "First request may take longer while the model loads"
- Cancel on a new submission (`AbortController`), no stale results
- Very large report tables: render the first 50 rows, then "Show more"

## 8. Accessibility and responsive rules

- All controls reachable by Tab, visible focus ring, `aria-live="polite"` for the result summary and errors.
- Highlights use both colour **and** underline style (not colour alone). Contrast at least 4.5:1 for body text.
- `prefers-reduced-motion`: skip movement, keep fades (see the UI/UX plan).
- Breakpoints: below 768px single column and the evidence list moves under the text; 768-1024px narrow margin column; above 1024px two-column layout (text and margin notes).
- Touch targets at least 44px.

## 9. Performance

- Server Components by default. Mark only interactive components with `"use client"`.
- Dynamic-import heavy visual parts (`ReviewsReportView`, GSAP ScrollTrigger on `/method`).
- Fonts through `next/font` (no layout shift). No images except the SVG logo and the paper-texture data URI.

## 10. Testing

- Unit: `toSegments` (overlaps, bad offsets), `validateFile`, `format` helpers.
- Component: result states with mock API responses (store JSON fixtures in `src/frontend/lib/fixtures/`).
- Manual: keyboard-only pass, mobile width 360px, reduced-motion on, offline error.

## 11. Task checklist for agents

- [ ] Layout, fonts, tokens, `PageShell`, `Masthead`, `Footer`
- [ ] `lib/api.ts` and hooks
- [ ] Workbench page: `ModeTabs`, `TextComposer`, `FileDrop`, `SampleChips`
- [ ] Result components: `VerdictStamp`, `ProbabilityRule`, `HighlightedText`, `EvidenceList`, `CueList`, `ChunkStrip`, `Disclaimer`
- [ ] Reviews page and report components
- [ ] Method page with limitations and privacy text
- [ ] Loading, empty and error states
- [ ] Animations from the UI/UX plan, with the reduced-motion fallback
- [ ] Accessibility pass, mobile pass, print stylesheet