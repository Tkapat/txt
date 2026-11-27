# txt: Document Detector Training Plan (Part B, Google Colab)

> Audience: Team member B (ML, long-document detector). Follow the steps in order.
> This plan is self-contained. Part A (short-review detector) is a separate plan for a second team member.
> Output: `models/document/` plus `models/meta/document-meta.json` that the Next.js backend loads. `golden.json` and all review-model files are Part A deliverables.

## 0. What we are building

| Artifact | Purpose | Owner |
|---|---|---|
| `models/document/` | Detects AI-written **long text** (PDF/DOCX/TXT) | **This plan (Part B)** |
| `models/meta/document-meta.json` | Thresholds, error rates, chunk settings | This plan |
| `models/review/` + review meta/golden | Short-review detector | **Part A (separate plan)** |

Research claim: **how well detectors hold up on AI generators they never saw**, plus an honest evaluation protocol.

Scope: this plan trains only the document model. Do not train or export the review model here.

## 1. Critical rules (do not skip)

1. **Label order is fixed:** `0 = human`, `1 = ai`. Verify the pretrained model's `id2label` before overriding it. Set `id2label = {0:"human", 1:"ai"}` and `label2id = {"human":0, "ai":1}` in every model config. The backend looks for the label named `ai`.
2. **Split by generator and domain, not randomly.** Hold out generators `gpt4`, `cohere-chat`, `mpt-chat` and domain `recipes` for testing. Never use them in training.
3. **Split by `doc_id`** so chunks of one document never cross train/validation/test.
4. **Never train on test data.** Fit thresholds on validation chunks only and report final numbers on test sets only.
5. **ONNX parity check** (B6): compare PyTorch and ONNX outputs before exporting.
6. Set seeds (`SEED = 42`), save checkpoints to Google Drive (Colab disconnects), and never train on test data.
7. Use the generated or downloaded text only for detector research. Do not publish generation scripts as a "fake text tool".
8. English only. Detection is chunk-level with document-level aggregation; "AI-written" is not the same as "fake".

Part A's Amazon human cutoff and `parent_asin` split rules do not apply to this plan.

## 2. Colab setup

Runtime: GPU (T4). Folder layout on Google Drive: `MyDrive/txt/{data/raw, data/processed, models, exports, reports}`.

```python
from google.colab import drive
drive.mount('/content/drive')
ROOT = "/content/drive/MyDrive/txt"
import os
for d in ["data/raw","data/processed","models","exports/models/meta","reports"]:
    os.makedirs(f"{ROOT}/{d}", exist_ok=True)

!pip -q install "transformers>=4.44" datasets accelerate scikit-learn pandas numpy requests tqdm "optimum[onnxruntime]" onnxruntime scipy

import random, numpy as np, torch
SEED = 42
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED); torch.cuda.manual_seed_all(SEED)
```

## Part B: Modify a pretrained model for large text files

## B1. Candidates

| Model / tool | Link | Use |
|---|---|---|
| `Hello-SimpleAI/chatgpt-detector-roberta` (roberta-base trained on HC3 answers) | https://huggingface.co/Hello-SimpleAI/chatgpt-detector-roberta | **Main starting point.** Weights are a pickle `.bin`: load only from the official repo, then re-save (writes safetensors). |
| `roberta-base` | https://huggingface.co/FacebookAI/roberta-base | Fallback base. |
| HC3 dataset + paper | https://huggingface.co/datasets/Hello-SimpleAI/HC3, https://arxiv.org/abs/2301.07597 | Training data (Q&A style, ChatGPT only). |
| RAID dataset | https://huggingface.co/datasets/liamdugan/raid | Multi-generator, multi-domain data and benchmark (`pip install raid-bench`). Leaderboard: https://raid-bench.xyz |
| Binoculars (zero-shot, optional) | https://github.com/ahans30/Binoculars, https://arxiv.org/abs/2401.12070 | Optional baseline. Default thresholds use Falcon-7B models, so it needs a big GPU. English-focused. Authors warn against use without human review. |

## B2. Baseline: evaluate the model unmodified

```python
from transformers import pipeline
det = pipeline("text-classification", model="Hello-SimpleAI/chatgpt-detector-roberta",
               truncation=True, max_length=512, top_k=None, device=0)
print(det.model.config.id2label)   # CHECK which label means ChatGPT; verify on 5 known human + 5 known AI texts
```
Score all long-text test chunks (B3) and record AUC, TPR@1%FPR, FPR. This is the "off-the-shelf" row in the paper.

## B3. Build the long-text dataset

```python
from datasets import load_dataset
rows = []
hc3 = load_dataset("Hello-SimpleAI/HC3", "all", split="train")   # if a script error appears: download the jsonl files from the repo's Files tab
for i, ex in enumerate(hc3):
    for t in ex["human_answers"]:   rows.append(dict(text=t, label=0, generator="human",   source="hc3_"+ex["source"], doc_id=f"hc3_{i}_h"))
    for t in ex["chatgpt_answers"]: rows.append(dict(text=t, label=1, generator="chatgpt", source="hc3_"+ex["source"], doc_id=f"hc3_{i}_c"))

DOMAINS = {"abstracts","books","news","reddit","wiki","recipes"}
raid = (load_dataset("liamdugan/raid", "raid", split="train", streaming=True)
        .shuffle(seed=SEED, buffer_size=50_000)
        .filter(lambda ex: ex["attack"]=="none" and ex["domain"] in DOMAINS))
for ex in raid.take(60_000):
    rows.append(dict(text=ex["generation"], label=0 if ex["model"]=="human" else 1,    # verify how human rows are named
                     generator=ex["model"], source="raid_"+ex["domain"], doc_id=ex["id"]))
```

Hold out for testing: generators `gpt4`, `cohere-chat`, `mpt-chat` and domain `recipes`. Train on the rest. Split by `doc_id` so chunks of one document never cross splits.

```python
def chunk_words(text, size=160, stride=120, min_words=60):
    w = text.split(); out = []
    for s in range(0, max(1, len(w)), stride):
        c = w[s:s+size]
        if len(c) >= min_words or (s == 0 and len(c) >= 30): out.append(" ".join(c))
        if s + size >= len(w): break
    return out
```
Expand each document into chunks (inherit label, generator, `doc_id`). Balance classes. Cap per generator and domain so ChatGPT/HC3 does not dominate.

## B4. Fine-tune

Run the imports from Appendix A7 first. The appendix also includes `from sklearn.metrics import roc_auc_score`, which `compute_metrics` needs.

```python
BASE = "Hello-SimpleAI/chatgpt-detector-roberta"
model = AutoModelForSequenceClassification.from_pretrained(BASE)
print(model.config.id2label)
# ONLY if label 0 = human and label 1 = ChatGPT (verified!):
model.config.id2label = {0:"human", 1:"ai"}; model.config.label2id = {"human":0, "ai":1}
tok = AutoTokenizer.from_pretrained(BASE)
```
Reuse the shared `Trainer` setup in the appendix (A7) with these changes: `learning_rate=1e-5`, `num_train_epochs=2`, `per_device_train_batch_size=16`, `MAXLEN=256`, output `models/document-roberta`. A lower learning rate keeps what the model already knows and adapts it to the new generators and domains.

Evaluate on: held-out chunks, held-out generators, held-out domain, and (document level) the share of flagged chunks per document. Compare against the B2 baseline.

Results table to fill for the report:

| Model | Held-out chunks AUC / TPR@1%FPR | Unseen generators | Unseen domain | Human FPR |
|---|---|---|---|---|
| Off-the-shelf (B2) | | | | |
| Fine-tuned (B4) | | | | |
| Binoculars (optional, B7) | | | | |

## B5. Document-level logic (implemented in the backend, tuned here)

Document score = mean of chunk probabilities. Also report `flaggedShare` = fraction of chunks above `tau_high`. Choose `tau_high` on validation chunks (FPR ≤ 2%). Compute `sensitivity_unseen` and `specificity` with the appendix A8 helpers and save `document-meta.json` with the same schema as `review-meta.json` (no stacker, no stylometric part).

`document-meta.json` must contain the same fields as the review meta file, with no stacker and no stylometric part:

| Field | Value |
|---|---|
| `version` | `"document-v1"` |
| `max_tokens` | `MAXLEN` (256) |
| `chunk` | `{"words": 160, "stride": 120, "min_words": 60}` |
| `thresholds.low` | `tau_low` from validation human chunks |
| `thresholds.high` | `tau_high` from validation human chunks (FPR <= 2%) |
| `sensitivity_unseen` | TPR on the held-out-generator test set |
| `specificity` | 1 - FPR on the human test set |

Use the exact A8 threshold and evaluation helpers in the appendix. Set `pv` to the document model's probabilities on validation chunks before applying the threshold lines.

## B6. Export

Use the same export and `build_model_dir(...)` code as the appendix A9 block, output `exports/models/document/`. Run the parity check there too.

Use the exact A9 export and parity block in the appendix with these substitutions:

| A9 review value | B6 document value |
|---|---|
| `{ROOT}/models/review-distilbert` | `{ROOT}/models/document-roberta` |
| `{ROOT}/exports/review-onnx` | `{ROOT}/exports/document-onnx` |
| `{ROOT}/exports/review-onnx-q8` | `{ROOT}/exports/document-onnx-q8` |
| `{ROOT}/exports/models/review` | `{ROOT}/exports/models/document` |
| review validation texts | document validation chunks |

The parity check uses `val_df.sample(200, random_state=SEED).text.tolist()`. For this plan, `val_df` is the document validation-chunk table and `predict_proba` is the document model helper.

## B7. Optional: Binoculars baseline
Run only if a high-memory GPU is available. Score 500 chunks from each test set and add a row to the results table. Do not put it in the app.

## 3. Deliverables checklist (hand off to backend team)

```
exports/models/
├── document/        # HF layout + onnx/model.onnx + onnx/model_quantized.onnx
└── meta/
    └── document-meta.json
```

- [ ] Held-out generator and domain test sets created (B3)
- [ ] Thresholds fitted on validation chunks only (B5)
- [ ] ONNX parity check passed for the document model (B6)
- [ ] `document-meta.json` written with `sensitivity_unseen` and `specificity`
- [ ] Document-level `flaggedShare` reported
- [ ] Results table complete for held-out chunks, generators, and domain
- [ ] Notebook(s) committed to `ml/notebooks/`, with the seed and library versions printed in the first cell
- [ ] Known limitations written up: English only, chunk-level detection, possible bias against non-native writers, "AI-written" is not the same as "fake"
- [ ] Handoff note: `models/review/`, `review-meta.json`, `stylometric.json`, `stacker.json`, and `golden.json` are Part A deliverables and are not produced here.

## 4. Link status

Checked in the Amazon Reviews 2023, HC3, RAID and Binoculars pages while planning. Verify the rest (Yelp, OpSpam, Optimum docs) yourself before relying on them. Check dataset and model licenses before redistributing anything.

## Appendix: Shared code from Part A (reference)

> These blocks are copied unchanged from Part A. Do not run the DistilBERT-specific values as-is. Copy the imports, `to_ds`, `compute_metrics`, `Trainer`, and `predict_proba`; keep the `model` and `tok` loaded in B4. For B4, change `output_dir` to `.../ckpt-document`, `num_train_epochs` to 2, `learning_rate` to 1e-5, `per_device_train_batch_size` to 16, and save to `.../document-roberta`. Apply the B5/B6 substitutions listed above.

### A7 Trainer setup (reference)

The A7 block needs the AUC import from A4 as well:

```python
from sklearn.metrics import roc_auc_score
```

```python
from datasets import Dataset
from transformers import (AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments,
                          Trainer, DataCollatorWithPadding)
from sklearn.metrics import f1_score, accuracy_score
import scipy.special as sp
BASE_MODEL, MAXLEN = "distilbert-base-uncased", 256       # https://huggingface.co/distilbert/distilbert-base-uncased
id2label = {0:"human", 1:"ai"}; label2id = {"human":0, "ai":1}   # CRITICAL
tok = AutoTokenizer.from_pretrained(BASE_MODEL)
model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL, num_labels=2, id2label=id2label, label2id=label2id)

def to_ds(df):
    ds = Dataset.from_pandas(df[["text","label"]].reset_index(drop=True))
    return ds.map(lambda b: tok(b["text"], truncation=True, max_length=MAXLEN), batched=True, remove_columns=["text"])

def compute_metrics(p):
    logits, y = p; prob = sp.softmax(logits, axis=-1)[:,1]
    return {"auc": roc_auc_score(y, prob), "f1": f1_score(y, prob>0.5), "acc": accuracy_score(y, prob>0.5)}

args = TrainingArguments(output_dir=f"{ROOT}/models/ckpt-review", num_train_epochs=3, learning_rate=2e-5,
    per_device_train_batch_size=32, per_device_eval_batch_size=64, weight_decay=0.01, warmup_ratio=0.06,
    eval_strategy="epoch", save_strategy="epoch", load_best_model_at_end=True, metric_for_best_model="auc",
    fp16=True, seed=SEED, report_to="none", save_total_limit=2)
# older transformers: use evaluation_strategy=; newer: pass processing_class=tok instead of tokenizer=
trainer = Trainer(model=model, args=args, train_dataset=to_ds(train_df), eval_dataset=to_ds(val_df),
                  tokenizer=tok, data_collator=DataCollatorWithPadding(tok), compute_metrics=compute_metrics)
trainer.train()
trainer.save_model(f"{ROOT}/models/review-distilbert"); tok.save_pretrained(f"{ROOT}/models/review-distilbert")  # writes model.safetensors
```

Probability helper (reuse everywhere):

```python
def predict_proba(texts, batch=64):
    model.eval(); out = []
    for i in range(0, len(texts), batch):
        enc = tok(texts[i:i+batch], truncation=True, max_length=MAXLEN, padding=True, return_tensors="pt").to(model.device)
        with torch.no_grad(): out.append(torch.softmax(model(**enc).logits, -1)[:,1].cpu().numpy())
    return np.concatenate(out)
```

### A8 threshold and evaluation helpers (reference)

After setting `pv` to the document model's probabilities on validation chunks:

```python
hv = pv[val_df.label.values==0]
tau_high = float(np.quantile(hv, 0.98))     # at most 2% of human val reviews flagged
tau_low  = float(np.quantile(hv, 0.60))     # below this = "likely human" (tune by inspecting val)
```

```python
def eval_set(df, p, tau):
    y = df.label.values; thr1 = np.quantile(p[y==0], 0.99)
    return {"n": len(df), "auc": roc_auc_score(y,p), "f1": f1_score(y, p>=tau), "acc": accuracy_score(y, p>=tau),
            "fpr": float((p[y==0]>=tau).mean()), "tpr": float((p[y==1]>=tau).mean()), "tpr@1%fpr": float((p[y==1]>thr1).mean())}
```

### A9 export and parity (reference)

Apply the B6 substitutions to this block:

```python
!optimum-cli export onnx --model "{ROOT}/models/review-distilbert" --task text-classification "{ROOT}/exports/review-onnx"
from optimum.onnxruntime import ORTQuantizer, ORTModelForSequenceClassification
from optimum.onnxruntime.configuration import AutoQuantizationConfig
ORTQuantizer.from_pretrained(f"{ROOT}/exports/review-onnx").quantize(
    save_dir=f"{ROOT}/exports/review-onnx-q8",
    quantization_config=AutoQuantizationConfig.avx2(is_static=False, per_channel=False))

import shutil, pathlib
def build_model_dir(src_fp32, src_q8, dst):
    dst = pathlib.Path(dst); (dst/"onnx").mkdir(parents=True, exist_ok=True)
    for p in pathlib.Path(src_fp32).iterdir():
        if p.is_file() and p.suffix not in (".onnx",".data"): shutil.copy(p, dst/p.name)   # config + tokenizer files
    shutil.copy(f"{src_fp32}/model.onnx", dst/"onnx/model.onnx")
    shutil.copy(f"{src_q8}/model_quantized.onnx", dst/"onnx/model_quantized.onnx")
build_model_dir(f"{ROOT}/exports/review-onnx", f"{ROOT}/exports/review-onnx-q8", f"{ROOT}/exports/models/review")

# PARITY CHECK (must pass): ONNX q8 vs PyTorch on 200 validation texts
ort = ORTModelForSequenceClassification.from_pretrained(f"{ROOT}/exports/review-onnx-q8", file_name="model_quantized.onnx")
def ort_proba(texts):
    enc = tok(texts, truncation=True, max_length=MAXLEN, padding=True, return_tensors="pt")
    return sp.softmax(ort(**enc).logits.numpy(), -1)[:,1]
s = val_df.sample(200, random_state=SEED).text.tolist()
print("max abs diff:", np.abs(ort_proba(s) - predict_proba(s)).max())   # expect < 0.03 for q8; AUC drop < 0.5 pt
```
