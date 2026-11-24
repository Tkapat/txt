# Plan B Colab Code (copy/paste cells)

Run the cells in order. Cell 0 is only needed if your `transformers` install is broken or mixed. Select the T4 GPU before running Cell 0, and do not change the runtime type afterward.

> [!IMPORTANT]
> **Compatibility baseline (November 2026 Colab):**
> `transformers==4.47.1` · `tokenizers==0.21.0` · `huggingface_hub==0.27.1`
> `optimum[onnxruntime]==1.24.0` (pulls in `onnx` + `onnxruntime` automatically) · `scikit-learn==1.6.1`
>
> **Never pin `onnx` or `onnxruntime` explicitly** — Colab can't build them from source. Let `optimum[onnxruntime]` resolve the right versions.
>
> **Key API changes from older plan code:**
> - `TrainingArguments`: use `eval_strategy=` (not `evaluation_strategy=`, removed in 4.46+)
> - `Trainer`: use `processing_class=tok` (not `tokenizer=tok`, deprecated)
> - ONNX export of RoBERTa: use `optimum-cli` or add `token_type_ids` workaround in torch.onnx.export
> - `onnxruntime.quantization.quantize_dynamic` works fine with ort ≥ 1.18; `optimum` ORTQuantizer is an alternative
> - `fsspec` must be pinned below 2024.x to prevent datasets streaming breakage on Colab

---

## Cell 0 — clean install (run once, then restart session)

> [!IMPORTANT]
> **Strategy:** Only uninstall packages with breaking API changes (`transformers`, `tokenizers`, `huggingface_hub`) and the ML extras we're adding fresh (`optimum`, `onnx`, `onnxruntime`, `accelerate`, `safetensors`).
> **Do NOT touch** `pyarrow`, `pandas`, `datasets`, `fsspec` — Colab ships them pre-compiled and downgrading causes build-from-source failures.

```python
import glob, os, shutil, sys

# ── 1. Uninstall ONLY transformers + tokenizers (the packages with breaking API changes)
# Leave huggingface_hub, datasets, pandas, pyarrow, fsspec, scikit-learn UNTOUCHED.
# Colab's newer pre-installed versions of those are fine and can't be downgraded
# without triggering source-build failures.
!pip uninstall -y transformers tokenizers optimum optimum-onnx onnx onnxruntime onnxruntime-gpu

# ── 2. Remove tilde-prefixed garbage from any previous failed pip run ────────
pyver = f"{sys.version_info.major}.{sys.version_info.minor}"
site_pkgs = f"/usr/local/lib/python{pyver}/dist-packages"
for pattern in ["transformers*", "tokenizers*", "optimum*", "onnx*", "onnxruntime*", "~*"]:
    for p in glob.glob(f"{site_pkgs}/{pattern}"):
        (shutil.rmtree if os.path.isdir(p) else os.remove)(p)

# ── 3. Install only what we actually need ────────────────────────────────────
# - transformers 4.47.1  : last stable 4.x; has eval_strategy + processing_class
# - tokenizers 0.21.0    : matched to transformers 4.47.x
# - optimum[onnxruntime] : resolves its own compatible onnx + onnxruntime versions
#                          (never pin onnx/onnxruntime separately — Colab can't build from source)
# - huggingface_hub      : NOT pinned; let the resolver keep whatever Colab has
# - accelerate/safetensors: add if not already present, no strict pin needed
!pip install -q --no-cache-dir \
    "transformers==4.47.1" \
    "tokenizers==0.21.0" \
    "accelerate" \
    "safetensors" \
    "scikit-learn" \
    "requests" "tqdm" "scipy" \
    "optimum[onnxruntime]"
```

After this cell: `Runtime` → `Restart session`, then continue with Cell 1.

---

## Cell 1 — mount Drive, create folders, check GPU

```python
from google.colab import drive
drive.mount('/content/drive')

import os, glob, shutil, sys

# Clean any leftover tilde-prefixed garbage from pip
pyver = f"{sys.version_info.major}.{sys.version_info.minor}"
for p in glob.glob(f'/usr/local/lib/python{pyver}/dist-packages/~*'):
    (shutil.rmtree if os.path.isdir(p) else os.remove)(p)

ROOT = "/content/drive/MyDrive/txt"
for d in ["data/raw", "data/processed", "models", "exports/models/meta", "reports"]:
    os.makedirs(os.path.join(ROOT, d), exist_ok=True)

import torch
print("torch:", torch.__version__)
print("cuda:", torch.cuda.is_available())
print("gpu:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "NO GPU")
assert torch.cuda.is_available(), "Switch Runtime -> Change runtime type -> T4 GPU, then rerun this cell."
```

---

## Cell 2 — imports, config, seed, verify transformers

```python
import os, re, json, random, subprocess, shutil, pathlib
import numpy as np
import pandas as pd
import torch
import scipy.special as sp
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score
from datasets import load_dataset, Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding,
    pipeline,
)

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)

ROOT = "/content/drive/MyDrive/txt"
DATA    = os.path.join(ROOT, "data/processed")
MODELS  = os.path.join(ROOT, "models")
EXPORTS = os.path.join(ROOT, "exports")
REPORTS = os.path.join(ROOT, "reports")
for d in [DATA, MODELS, EXPORTS, REPORTS, os.path.join(EXPORTS, "models/meta")]:
    os.makedirs(d, exist_ok=True)

BASE   = "Hello-SimpleAI/chatgpt-detector-roberta"
MAXLEN = 256
CHUNK  = {"words": 160, "stride": 120, "min_words": 60}
UNSEEN_GENERATORS = {"gpt4", "cohere-chat", "mpt-chat"}
UNSEEN_DOMAIN     = "recipes"

import transformers
print("transformers:", transformers.__version__)   # expect 4.47.x
print("transformers file:", transformers.__file__)
print("pipeline import OK")
```

---

## Cell 3 — build the long-text dataset (B3)

```python
rows = []

# ── HC3 ──────────────────────────────────────────────────────────────────────
# datasets 4.x removed Python loading-script support → load_dataset("HC3") crashes.
# Some domain files also have an extra "index" column that breaks schema unification
# when you pass all files at once to load_dataset("json", ...).
# Fix: download each JSONL with hf_hub_download and parse with plain json — no datasets involved.
import json as _json
from huggingface_hub import hf_hub_download

HC3_DOMAINS = ["finance", "medicine", "open_qa", "reddit_eli5", "wiki_csai"]
for domain in HC3_DOMAINS:
    try:
        path = hf_hub_download(
            repo_id="Hello-SimpleAI/HC3",
            filename=f"{domain}.jsonl",
            repo_type="dataset",
        )
    except Exception as e:
        print(f"  skipping {domain}: {e}")
        continue
    with open(path) as f:
        for line_num, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            ex = _json.loads(line)
            doc_base = f"hc3_{domain}_{line_num}"
            for t in (ex.get("human_answers") or []):
                rows.append(dict(text=t, label=0, generator="human",
                                 source=f"hc3_{domain}", doc_id=f"{doc_base}_h"))
            for t in (ex.get("chatgpt_answers") or []):
                rows.append(dict(text=t, label=1, generator="chatgpt",
                                 source=f"hc3_{domain}", doc_id=f"{doc_base}_c"))

print(f"HC3 rows so far: {len(rows)}")

DOMAINS = {"abstracts", "books", "news", "reddit", "wiki", "recipes"}
raid = (
    load_dataset("liamdugan/raid", "raid", split="train", streaming=True)
    .shuffle(seed=SEED, buffer_size=50_000)
    .filter(lambda ex: ex["attack"] == "none" and ex["domain"] in DOMAINS)
)

for ex in raid.take(60_000):
    rows.append(dict(
        text=ex["generation"],
        label=0 if ex["model"] == "human" else 1,
        generator=ex["model"],
        source="raid_" + ex["domain"],
        doc_id=ex["id"],
    ))

df = pd.DataFrame(rows)
df = df.dropna(subset=["text"]).drop_duplicates("text").reset_index(drop=True)
print("raw docs:", df.shape)
print(df.groupby(["label", "generator"]).size().sort_values(ascending=False).head(20))

df.to_parquet(os.path.join(DATA, "document_raw.parquet"))
```

---

## Cell 4 — split by `doc_id`, chunk, balance, save

```python
def group_split(frame, test_size, seed=SEED):
    groups = frame["doc_id"].astype(str)
    a, b = next(
        GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
        .split(frame, groups=groups)
    )
    return frame.iloc[a].copy(), frame.iloc[b].copy()

seen_mask = (~df["generator"].isin(UNSEEN_GENERATORS)) & (df["source"] != "raid_" + UNSEEN_DOMAIN)
seen = df[seen_mask].copy()
unseen_gen = df[
    df["generator"].isin(UNSEEN_GENERATORS) & (df["source"] != "raid_" + UNSEEN_DOMAIN)
].copy()
unseen_domain = df[
    (df["source"] == "raid_" + UNSEEN_DOMAIN) & (~df["generator"].isin(UNSEEN_GENERATORS))
].copy()

train_val, test_id = group_split(seen, 0.15)
train, val = group_split(train_val, 0.15 / 0.85)

print("docs:",
      "train", len(train), "val", len(val), "test_id", len(test_id),
      "unseen_gen", len(unseen_gen), "unseen_domain", len(unseen_domain))

def chunk_words(text, size=CHUNK["words"], stride=CHUNK["stride"], min_words=CHUNK["min_words"]):
    w = text.split()
    out = []
    for s in range(0, max(1, len(w)), stride):
        c = w[s:s + size]
        if len(c) >= min_words or (s == 0 and len(c) >= 30):
            out.append(" ".join(c))
        if s + size >= len(w):
            break
    return out

def expand(frame, name):
    out = []
    for row in frame.itertuples(index=False):
        for c in chunk_words(row.text):
            out.append(dict(
                text=c,
                label=int(row.label),
                generator=row.generator,
                source=row.source,
                doc_id=str(row.doc_id),
            ))
    result = pd.DataFrame(out)
    print(name, result.shape)
    return result

train_c         = expand(train,        "train")
val_c           = expand(val,          "val")
test_id_c       = expand(test_id,      "test_id")
unseen_gen_c    = expand(unseen_gen,   "unseen_gen")
unseen_domain_c = expand(unseen_domain,"unseen_domain")

PER_GEN_CAP    = 20_000
PER_SOURCE_CAP = 25_000

def cap_groups(frame, col, cap):
    parts = []
    for _, g in frame.groupby(col):
        parts.append(g.sample(n=min(len(g), cap), random_state=SEED))
    return pd.concat(parts, ignore_index=True)

train_bal = cap_groups(train_c, "generator", PER_GEN_CAP)
train_bal = cap_groups(train_bal, "source",  PER_SOURCE_CAP)

ai    = train_bal[train_bal.label == 1]
human = train_bal[train_bal.label == 0]
n     = min(len(ai), len(human))
if n == 0:
    raise ValueError("No training chunks after balancing")

train_bal = pd.concat([
    ai.sample(n=n, random_state=SEED),
    human.sample(n=n, random_state=SEED),
], ignore_index=True).sample(frac=1, random_state=SEED).reset_index(drop=True)

print("balanced train:", train_bal.shape, train_bal.label.value_counts().to_dict())

human_test = test_id_c[test_id_c.label == 0].copy()
t1 = test_id_c.copy()
t2 = pd.concat([unseen_gen_c,    human_test], ignore_index=True)
t4 = pd.concat([unseen_domain_c, human_test], ignore_index=True)

for name, frame in [
    ("train",         train_bal),
    ("val",           val_c),
    ("test_id",       t1),
    ("unseen_gen",    t2),
    ("unseen_domain", t4),
]:
    frame.to_parquet(os.path.join(DATA, f"document_{name}.parquet"))
    print(name, frame.shape, frame.label.value_counts().to_dict())
```

---

## Cell 5 — baseline evaluation (B2)

```python
det = pipeline(
    "text-classification",
    model=BASE,
    truncation=True,
    max_length=512,
    top_k=None,
    device=0,
    batch_size=32,
)
print("labels:", det.model.config.id2label)

ai_idx = None
for i, name in det.model.config.id2label.items():
    if str(name).lower() in {"chatgpt", "ai", "machine", "fake", "gpt"}:
        ai_idx = i
        break
if ai_idx is None:
    raise ValueError(f"Could not find AI label in {det.model.config.id2label}")

def baseline_proba(texts, batch_size=32):
    out = []
    for i in range(0, len(texts), batch_size):
        preds = det(texts[i:i + batch_size], truncation=True, max_length=512)
        for p in preds:
            scores = {x["label"]: x["score"] for x in p}
            out.append(float(scores.get(det.model.config.id2label[ai_idx], 0.0)))
    return np.array(out)

def eval_set(frame, p, tau):
    y = frame.label.values
    thr1 = np.quantile(p[y == 0], 0.99)
    return {
        "n":        len(frame),
        "auc":      roc_auc_score(y, p),
        "f1":       f1_score(y, p >= tau),
        "acc":      accuracy_score(y, p >= tau),
        "fpr":      float((p[y == 0] >= tau).mean()),
        "tpr":      float((p[y == 1] >= tau).mean()),
        "tpr@1%fpr": float((p[y == 1] > thr1).mean()),
    }

baseline_results = {}
for name, frame in [("T1_id", t1), ("T2_unseen_gen", t2), ("T4_unseen_domain", t4)]:
    p = baseline_proba(frame.text.tolist())
    baseline_results[name] = eval_set(frame, p, 0.5)
    print(name, baseline_results[name])
```

---

## Cell 6 — fine-tune the document model (B4)

```python
id2label = {0: "human", 1: "ai"}
label2id = {"human": 0, "ai": 1}

tok = AutoTokenizer.from_pretrained(BASE)
# RoBERTa has no token_type_ids — tell the tokenizer explicitly so ONNX export is clean later
tok.model_input_names = ["input_ids", "attention_mask"]

model = AutoModelForSequenceClassification.from_pretrained(BASE)
print("original labels:", model.config.id2label)

model.config.id2label = id2label
model.config.label2id = label2id

def to_ds(frame):
    ds = Dataset.from_pandas(frame[["text", "label"]].reset_index(drop=True))
    return ds.map(
        lambda b: tok(b["text"], truncation=True, max_length=MAXLEN),
        batched=True,
        remove_columns=["text"],
    )

def compute_metrics(p):
    logits, y = p
    prob = sp.softmax(logits, axis=-1)[:, 1]
    return {
        "auc": roc_auc_score(y, prob),
        "f1":  f1_score(y, prob > 0.5),
        "acc": accuracy_score(y, prob > 0.5),
    }

args = TrainingArguments(
    output_dir=os.path.join(MODELS, "ckpt-document"),
    num_train_epochs=2,
    learning_rate=1e-5,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=64,
    weight_decay=0.01,
    warmup_ratio=0.06,
    # ✅ FIX: eval_strategy (not evaluation_strategy, removed in transformers 4.46+)
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="auc",
    fp16=True,
    seed=SEED,
    report_to="none",
    save_total_limit=2,
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=to_ds(train_bal),
    eval_dataset=to_ds(val_c),
    # ✅ FIX: processing_class (not tokenizer=, deprecated/removed in 4.46+)
    processing_class=tok,
    data_collator=DataCollatorWithPadding(tok),
    compute_metrics=compute_metrics,
)

trainer.train()
trainer.save_model(os.path.join(MODELS, "document-roberta"))
tok.save_pretrained(os.path.join(MODELS, "document-roberta"))
```

---

## Cell 7 — evaluate, thresholds, save `document-meta.json` (B5)

```python
model = trainer.model
model.eval()

def predict_proba(texts, batch=64):
    out = []
    for i in range(0, len(texts), batch):
        enc = tok(
            texts[i:i + batch],
            truncation=True,
            max_length=MAXLEN,
            padding=True,
            return_tensors="pt",
        ).to(model.device)
        with torch.no_grad():
            out.append(torch.softmax(model(**enc).logits, -1)[:, 1].cpu().numpy())
    return np.concatenate(out)

p_val = predict_proba(val_c.text.tolist())
p_t1  = predict_proba(t1.text.tolist())
p_t2  = predict_proba(t2.text.tolist())
p_t4  = predict_proba(t4.text.tolist())

hv       = p_val[val_c.label.values == 0]
tau_high = float(np.quantile(hv, 0.98))
tau_low  = float(np.quantile(hv, 0.60))

results = {}
for name, frame, p in [
    ("T1_id",           t1, p_t1),
    ("T2_unseen_gen",   t2, p_t2),
    ("T4_unseen_domain",t4, p_t4),
]:
    results[name] = eval_set(frame, p, tau_high)
    print(name, results[name])

sensitivity_unseen = results["T2_unseen_gen"]["tpr"]
specificity        = 1.0 - results["T1_id"]["fpr"]

def doc_level(frame, p, tau):
    tmp = frame[["doc_id", "label"]].copy()
    tmp["p"]       = p
    tmp["flagged"] = p >= tau
    return (
        tmp.groupby("doc_id")
        .agg(p=("p", "mean"), flaggedShare=("flagged", "mean"), label=("label", "first"))
        .reset_index()
    )

for name, frame, p in [
    ("T1_id",           t1, p_t1),
    ("T2_unseen_gen",   t2, p_t2),
    ("T4_unseen_domain",t4, p_t4),
]:
    g = doc_level(frame, p, tau_high)
    print(name, "doc mean p:", float(g.p.mean()), "mean flaggedShare:", float(g.flaggedShare.mean()))

meta = {
    "version":            "document-v1",
    "max_tokens":          MAXLEN,
    "chunk":               CHUNK,
    "thresholds":         {"low": tau_low, "high": tau_high},
    "sensitivity_unseen": float(sensitivity_unseen),
    "specificity":         float(specificity),
}
with open(os.path.join(EXPORTS, "models/meta/document-meta.json"), "w") as f:
    json.dump(meta, f, indent=2)

with open(os.path.join(REPORTS, "document-results.json"), "w") as f:
    json.dump({"baseline": baseline_results, "final": results, "meta": meta}, f, indent=2)

print("meta:", meta)
```

---

## Cell 8 — export ONNX, quantize, build app folder, parity check (B6)

> [!NOTE]
> We use `optimum-cli export onnx` instead of raw `torch.onnx.export`.
> RoBERTa has no `token_type_ids` and the torch tracer can silently mis-handle it,
> causing shape errors or wrong dynamic axes. Optimum handles this correctly.

```python
import onnxruntime as ort_rt
from onnxruntime.quantization import quantize_dynamic, QuantType

# ── Step 1: Save fine-tuned model to disk (if not already saved) ─────────────
model_dir = os.path.join(MODELS, "document-roberta")
# (already saved at end of Cell 6; ensure config has correct labels)
model.config.save_pretrained(model_dir)
tok.save_pretrained(model_dir)

# ── Step 2: Export to ONNX via optimum-cli ───────────────────────────────────
# This correctly handles RoBERTa's (input_ids, attention_mask) signature
onnx_fp32 = os.path.join(EXPORTS, "document-onnx")
os.makedirs(onnx_fp32, exist_ok=True)

import subprocess
result = subprocess.run(
    [
        "optimum-cli", "export", "onnx",
        "--model", model_dir,
        "--task", "text-classification",
        "--opset", "17",
        onnx_fp32,
    ],
    capture_output=True, text=True,
)
print(result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr[-2000:])
    raise RuntimeError("optimum-cli export failed")

# ── Step 3: Dynamic INT8 quantization ────────────────────────────────────────
onnx_q8 = os.path.join(EXPORTS, "document-onnx-q8")
os.makedirs(onnx_q8, exist_ok=True)

quantize_dynamic(
    model_input=os.path.join(onnx_fp32, "model.onnx"),
    model_output=os.path.join(onnx_q8, "model_quantized.onnx"),
    weight_type=QuantType.QInt8,
)

# ── Step 4: Build the app-folder layout ──────────────────────────────────────
dst = pathlib.Path(os.path.join(EXPORTS, "models/document"))
(dst / "onnx").mkdir(parents=True, exist_ok=True)

model.cpu().config.save_pretrained(dst)
tok.save_pretrained(dst)
shutil.copy(os.path.join(onnx_fp32, "model.onnx"),           dst / "onnx/model.onnx")
shutil.copy(os.path.join(onnx_q8,   "model_quantized.onnx"), dst / "onnx/model_quantized.onnx")

# ── Step 5: Parity check — ONNX q8 vs PyTorch ────────────────────────────────
sess = ort_rt.InferenceSession(
    str(dst / "onnx/model_quantized.onnx"),
    providers=["CPUExecutionProvider"],
)

def ort_proba(texts):
    # return_tensors="np" avoids a pt→np copy on CPU
    enc = tok(texts, truncation=True, max_length=MAXLEN, padding=True, return_tensors="np")
    logits = sess.run(
        ["logits"],
        {"input_ids": enc["input_ids"], "attention_mask": enc["attention_mask"]},
    )[0]
    e = np.exp(logits - logits.max(axis=-1, keepdims=True))
    return (e / e.sum(axis=-1, keepdims=True))[:, 1]

model.to("cuda")
s    = val_c.sample(min(200, len(val_c)), random_state=SEED).text.tolist()
diff = float(np.abs(ort_proba(s) - predict_proba(s)).max())
print("max abs diff:", diff)
assert diff < 0.03, f"ONNX parity failed (diff={diff:.4f})"

# ── Step 6: Sanity-check output files ────────────────────────────────────────
for rel in ["config.json", "tokenizer.json", "onnx/model.onnx", "onnx/model_quantized.onnx"]:
    p = os.path.join(EXPORTS, "models/document", rel)
    print(rel, os.path.exists(p), os.path.getsize(p) if os.path.exists(p) else 0)
```

---

## Cell 9 — final handoff check

```python
print("model dir:", os.path.join(EXPORTS, "models/document"))
print("meta file:", os.path.join(EXPORTS, "models/meta/document-meta.json"))
print("meta contents:", json.load(open(os.path.join(EXPORTS, "models/meta/document-meta.json"))))
```

---

> B7 (Binoculars) is optional and needs a much larger GPU; it is not included here.

---

## Compatibility change log

| Issue | Old (broken) code | Fixed code |
|---|---|---|
| Wrong `eval_strategy` kwarg | `evaluation_strategy="epoch"` | `eval_strategy="epoch"` |
| Deprecated `tokenizer=` in Trainer | `tokenizer=tok` | `processing_class=tok` |
| `torch.onnx.export` RoBERTa token_type_ids crash | `torch.onnx.export(model, (input_ids, attn_mask), ...)` | `optimum-cli export onnx` via subprocess |
| Hardcoded Python 3.13 path in Cell 0 | `/usr/local/lib/python3.13/dist-packages/` | Dynamically detected via `sys.version_info` |
| `fsspec` version pinned too far in future | `fsspec==2025.12.0` (not released/unstable) | Colab pre-installs a working version — leave untouched |
| Overly new `transformers==5.22.1` | Many internal API renames, unstable on Colab | `transformers==4.47.1` (last stable 4.x) |
| `optimum` import split | `from optimum.onnxruntime import ORTQuantizer` (needs separate install) | `onnxruntime.quantization.quantize_dynamic` direct + `optimum-cli` for export |
| Downgrading `pyarrow` to `<18` | Colab has 23.x pre-compiled; pip falls back to building from source → crash | Don't touch `pyarrow`, `pandas`, `datasets`, `fsspec` at all in Cell 0 |
