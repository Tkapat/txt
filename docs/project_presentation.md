<!--
Format: Markdown slides (Marp / Reveal.js / Slidev compatible).
Use "---" as the slide separator. 16:9. Maximum 10 slides.
Speaker notes are in HTML comments and do not render on the slide.
-->

# txt

## AI-Writing Detection for Reviews and Long Documents

**3rd Year Innovative Project**

_<Team member names>_ · _<Guide>_ · _<Institution>_

November 2026

<!-- Notes: Introduce the project in one sentence: a local-first tool that estimates whether a piece of text was written by a machine, for short reviews and long documents. -->

---

# The Problem

- Generative models produce fluent **reviews and long documents** at near-zero cost.
- Platforms and readers cannot manually keep up.
- "Fake" and "AI-written" are **not the same thing**:
  - a review can be AI-written and truthful;
  - a human can write a deceptive review.
- Existing detectors report high accuracy on **one dataset**, but:
  - short text only,
  - one generator (often ChatGPT),
  - random splits that leak products/documents,
  - no calibration, no product.

<!-- Notes: Emphasise the distinction between intent (fake) and authorship (AI-written). This framing drives the whole project. -->

---

# The Gap We Cover

1. **Authorship vs. intent** — we detect AI authorship, not "fakeness".
2. **Unseen generators & domains** — grouped splits, held-out LLMs (`gpt4`, `cohere-chat`, `mpt-chat`), held-out domain (`recipes`).
3. **Long-form text** — a second model with chunking and chunk-level evidence, up to 100k characters.
4. **Calibration** — thresholds from human validation, FPR control, error-corrected prevalence.
5. **A usable, private tool** — local CPU inference, no database, no body logging, evidence and warnings.
6. **Quantization trade-offs** — documented INT8 failure and an AUC-gated acceptance rule.

**Why it matters:** consumers get a second opinion; moderators get bulk triage; researchers get a reproducible baseline; user text never leaves the machine.

<!-- Notes: Spend the most time here. This is contribution #1. Mention the survey papers that list these open problems (Yang et al.; Shete & Gosavi; Recent State-of-the-Art). -->

---

# What We Built

**One app, three workflows:**

| Workflow | Input | Output |
|---|---|---|
| Check text | pasted text | verdict, probability, evidence, cues |
| Check document | `.txt` `.md` `.docx` `.pdf` | chunk strip, flagged share, evidence |
| Check reviews | pasted list or CSV | per-review scores, flagged count, prevalence |

**Routing:** ≤160 words → review model; >160 words → document model.

**Stack:** Next.js 16 UI → typed API → FastAPI → PyTorch fp32.

> **[DEMO / SCREENSHOT HERE]** Landing page + one result panel.

<!-- Notes: Show the live demo if possible: paste a sample, upload a text PDF, then a 6-review batch. Point out the "estimate, not proof" disclaimer. -->

---

# Data: What We Trained On

**Review model (Part A)**
- Human: **Amazon Reviews 2023** — `All_Beauty`, `Health_and_Household`, `Amazon_Fashion`; `Appliances` held out.
- Pre-2022 only, 15–160 words, ASCII-dominant, deduplicated.
- AI: synthetic reviews from **multiple open-weight LLM families** via Ollama; 4 prompt modes (scratch, rephrase, casual, short); held-out generators for testing.
- Target: ≈12k human + ≈12k AI.

**Document model (Part B)**
- **HC3** — 5 domains, human vs. ChatGPT.
- **RAID** — multi-generator, multi-domain; up to 60k docs.
- Held out: generators `gpt4`, `cohere-chat`, `mpt-chat`; domain `recipes`.
- Chunks: 160 words, stride 120, min 60; split by `doc_id`; ≈35.9k balanced chunks/epoch.

**Leakage control:** split humans by `parent_asin`, documents by `doc_id`; length-only and first-3-words AUC must stay ≤0.85.

<!-- Notes: Stress that the held-out generators/domain are the point. Random splits would overstate performance. -->

---

# Part A — Short-Review Model

**Base:** `microsoft/deberta-v3-base` · 12 layers · 768 hidden · 128,100 vocab · 184.4M params.

| Setting | Value |
|---|---|
| Epochs | 2 |
| Learning rate | 1e-5 |
| Batch | 16 × grad-accum 2 = 32 effective |
| Precision | fp16 (Colab T4) |
| Max length | 256 tokens |
| Selection | best AUROC |
| Seed | 42 |

**Calibration:** `tau_high` = 98th percentile of human validation scores; `tau_low` = 60th percentile. `margin_threshold = 7.05` is stored but unusable in practice (≈P=0.9991).

**Status:** fp32 checkpoint verified end-to-end; full T1–T5 unseen-generator table is the next deliverable.

<!-- Notes: Be honest: the exported artifact is the transformer head, and the provisional 0.5/0.9 cutoffs are a deployment simplification. The optional stylometric stacker was not exported. -->

---

# Part B — Long-Document Model

**Base:** `Hello-SimpleAI/chatgpt-detector-roberta` fine-tuned on HC3 + RAID · 124.7M params.

| Setting | Value |
|---|---|
| Epochs | 2 |
| Learning rate | 1e-5 |
| Batch | 16 (eval 64) |
| Warmup / WD | 0.06 / 0.01 |
| Max length | 256 tokens |
| Precision | fp16 (T4) |
| Best checkpoint | 4492 |

**Validation metrics**

| Epoch | Loss | Accuracy | AUC | F1 |
|---|---|---|---|---|
| 1 | 0.0976 | 0.9828 | 0.9814 | 0.9864 |
| 2 | **0.0854** | **0.9838** | **0.9977** | **0.9872** |

**Deployment metadata:** `high = 0.9962` (≈2% human FPR), `low = 0.000199`, unseen-generator sensitivity **0.985**, specificity **0.980**.

<!-- Notes: Explain why AUC jumps while accuracy barely moves: the model already classified most chunks correctly; epoch 2 improved ranking of the ambiguous ones. Document-level aggregation uses mean probability and flagged share. -->

---

# Quantization: Concept and Our Result

**Dynamic INT8:** weights → int8 offline; activations quantized per batch; dequantize the output.

```text
q = round(x / S) + Z        x_hat = S * (q - Z)
```

- ~4× smaller weights; faster integer kernels; no retraining.
- Implemented with `torch.ao.quantization.quantize_dynamic(..., dtype=torch.qint8)`.
- Service flag `QUANTIZE=0` by default.

**What happened**

- **Review model: rejected.** Both classes collapsed to ≈**0.73**; AI/human separation was destroyed.
- **Document model: gated.** Keep INT8 only if **AUC drop ≤ 0.005**; otherwise ship fp32.
- **Shipped:** both models **fp32** — calibration and separation matter more than memory here.
- **Future:** ONNX Runtime static INT8 + ECE check, then QAT if needed.

<!-- Notes: This is a key engineering finding: a model can keep AUC and still lose the calibrated probabilities the UI depends on. Always check ECE and score distributions, not just accuracy. -->

---

# Tech Stack, Results, and Privacy

**Stack:** Next.js 16.4.6 · React 19 · TypeScript · Tailwind 4 · Zod · Vitest · FastAPI · PyTorch · Transformers · unpdf / mammoth / papaparse · Amazon Reviews 2023 · HC3 · RAID.

**Measured on an 8-vCPU machine**

| Path | Latency |
|---|---|
| Short text (review) | 2.6 s |
| Long document (document) | 4.3 s |
| File upload | 4.7 s |
| 6-review batch | 1.1 s |
| Document chunk | ≈197 ms |

**Checks:** typecheck, lint, 46 tests (2 skipped), production build — all pass.

**Privacy:** local models, no database, no request-body logging; text processed in memory; `127.0.0.1` service.

<!-- Notes: Mention limits: 100k chars, 10 MB file, 150 reviews, 30/10/20 requests per minute. Scanned PDFs are rejected (no OCR). -->

---

# Limitations, Future Work, and References

**Limitations**
- Authorship ≠ intent; "AI-written" is not "fake".
- English-dominant training; domain and dialect shift.
- Generator drift requires re-training.
- Short text is unreliable (<40 words).
- Review thresholds are provisional; full calibration is pending.
- INT8 is not safe for these models today.

**Future work**
- Export the review T1–T5 benchmark; fit the full stylometric + stacker calibration.
- ONNX static INT8 with ECE; QAT fallback.
- More generators/languages; document-level aggregation research; user studies.

**Key references**
- Wani et al., *Computers* 13(10):264, 2024.
- AlQadi et al., *Big Data Cogn. Comput.* 9(8):205, 2025.
- Yang et al., survey on fake review detection (PLMs → LLMs).
- He et al., DeBERTaV3, ICLR 2023; Liu et al., RoBERTa, 2019.
- HC3 (Guo et al., 2023); RAID (Dugan et al., 2024); Amazon Reviews 2023.
- Full list: `docs/project_report.md` → References.

**Thank you — questions?**

<!-- Notes: End with the honest framing: the tool is evidence, not proof, and the next milestone is the full unseen-generator benchmark for the review model. -->
