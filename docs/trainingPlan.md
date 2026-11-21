# txt: Model Training Plan (Google Colab)

> Audience: Team A (ML) and any AI coding agent. Follow the steps in order.
> Output of this plan: two ONNX models + small JSON files that the Next.js backend loads (see `02_BACKEND_PLAN.md`).

## 0. What we are building

| Artifact | Purpose | Trained how |
|---|---|---|
| `models/review/` | Detects AI-written **short reviews** (15-160 words) | Part A: our own data, DistilBERT + stylometric features + stacker |
| `models/document/` | Detects AI-written **long text** (PDF/DOCX/TXT) | Part B: pretrained RoBERTa detector, fine-tuned further |
| `models/meta/*.json` | Weights, thresholds, error rates, golden test vectors | Exported from Colab |

Research claim: **how well detectors hold up on AI generators they never saw**, plus an honest evaluation protocol.

## 1. Critical rules (do not skip)

1. **Human = reviews dated before 2022-01-01** (before ChatGPT). Never use newer reviews as "human".
2. **Split by generator, not randomly.** Test on generators and categories never used in training.
3. **Split human reviews by product** (`parent_asin`) so the same product never appears in train and test.
4. **Clean AI preambles** ("Here is a review:", "Sure!", "As an AI..."). Otherwise the model learns the preamble, not the writing.
5. **Leakage check** (section A4): length alone or first-3-words alone must NOT separate the classes (AUC > 0.85 means fix the data).
6. **Label order is fixed:** `0 = human`, `1 = ai`. Set `id2label = {0:"human", 1:"ai"}` in every model config. The backend looks for the label named `ai`.
7. **Stacker and thresholds are fitted on the validation set**, never on training data. Report final numbers on test sets only.
8. **Feature parity:** the Python feature code in A5 and the TypeScript version in the backend plan must produce identical numbers. We verify with `golden.json`.
9. **ONNX parity check** (A9): compare PyTorch and ONNX outputs before exporting.
10. Set seeds (`SEED = 42`), save checkpoints to Google Drive (Colab disconnects), and never train on test data.
11. Use the generated reviews only for detector research. Do not publish the generation scripts as a "fake review tool".

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

---

# PART A: Our own AI review detector

## A1. Data sources

| Role | Source | Link | Notes |
|---|---|---|---|
| Human reviews (main) | Amazon Reviews 2023 (McAuley Lab) | https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023 and https://amazon-reviews-2023.github.io/ | Download category files directly (the HF loading script is no longer supported by `datasets`). Fields: `rating, title, text, parent_asin, verified_purchase, timestamp`. |
| Human reviews (extra) | Yelp Open Dataset | https://www.yelp.com/dataset | Optional. Check terms. |
| Human + spam reviews | OpSpam (Ott et al.) | https://myleott.com/op-spam.html | Optional external test. |
| AI reviews (ours) | Generated with several LLMs | Ollama: https://ollama.com (API: https://github.com/ollama/ollama/blob/main/docs/api.md) | Main AI data. |
| AI reviews (extra baseline) | Salminen et al. "Fake Reviews Dataset" (GPT-2 generated) | Search Kaggle for "Fake Reviews Dataset" | Old generator. Use only as an extra test set. |
| External generalization | RAID | https://huggingface.co/datasets/liamdugan/raid, https://github.com/liamdugan/raid | Has a reviews domain (verify). Use as extra test. |

Direct file pattern: `https://datarepo.eng.ucsd.edu/mcauley_group/data/amazon_2023/raw/review_categories/<Category>.jsonl.gz`
Files are large. **Stream the first N lines instead of downloading everything.**

## A2. Build the human set

```python
import gzip, json, itertools, datetime as dt, requests, pandas as pd, re
BASE = "https://datarepo.eng.ucsd.edu/mcauley_group/data/amazon_2023/raw/review_categories/"
CUTOFF_MS = int(dt.datetime(2022,1,1,tzinfo=dt.timezone.utc).timestamp()*1000)  # CRITICAL: human cutoff
TRAIN_CATS = ["All_Beauty","Health_and_Household","Amazon_Fashion"]
UNSEEN_CAT = "Appliances"        # held out for the cross-category test
WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*")
wc = lambda s: len(WORD_RE.findall(s))

def load_human(cat, want=8000, scan=400_000):
    rows = []
    with requests.get(f"{BASE}{cat}.jsonl.gz", stream=True, timeout=120) as r:
        r.raise_for_status()
        with gzip.GzipFile(fileobj=r.raw) as gz:     # if this fails, wget the file to Drive instead
            for line in itertools.islice(gz, scan):
                j = json.loads(line)
                t = (j.get("text") or "").replace("\u2019","'").strip()
                if not t or j.get("timestamp", 1e18) >= CUTOFF_MS: continue
                if not (15 <= wc(t) <= 160): continue
                if sum(c.isascii() for c in t)/len(t) < 0.95: continue
                rows.append(dict(text=t, rating=j["rating"], category=cat, parent_asin=j["parent_asin"],
                                 label=0, generator="human"))
                if len(rows) >= want: break
    return pd.DataFrame(rows)

human = pd.concat([load_human(c) for c in TRAIN_CATS + [UNSEEN_CAT]], ignore_index=True)
human = human.drop_duplicates("text")
human.to_parquet(f"{ROOT}/data/processed/human.parquet")
```

## A3. Generate the AI set

Use **at least 4 different generators** from different model families (e.g. two Llama/Mistral-type models for training, two others held out). If someone has API access to a commercial model, use ~500 samples from it as an extra unseen test only.

| Slot | Use | Example (use whatever `ollama list` shows) |
|---|---|---|
| G1, G2 | Training generators | llama-family 8B, mistral-family 7B |
| G3, G4 | Unseen test generators | qwen-family, gemma-family |
| G5 (optional) | Commercial API model, test only | any available |

Four modes per generator (equal share), so the model learns more than one style:

```python
OLLAMA = "http://localhost:11434/api/generate"   # run `ollama serve` locally or on Colab
TEMPLATES = {
 "scratch":  "Write a {rating}-star customer review for a product in the '{category}' category on an online store. Output only the review text.",
 "rephrase": "Rewrite this customer review in your own words. Keep the meaning and sentiment. Output only the rewritten review.\n\nReview: {text}",
 "casual":   "Write a {rating}-star review of a {category} product the way a real shopper types on a phone: casual, imperfect, maybe one small typo, no formal phrases. Output only the review text.",
 "short":    "Write a very short (between 15 and 25 words) {rating}-star customer review for a {category} product. Output only the review text.",
}
def gen(model, prompt, temperature=0.9):
    r = requests.post(OLLAMA, json={"model":model,"prompt":prompt,"stream":False,
        "options":{"temperature":temperature,"top_p":0.95}}, timeout=300)
    r.raise_for_status(); return r.json()["response"].strip()

BAD_START = re.compile(r"^(sure|here('| i)s|okay|certainly|of course)\b", re.I)
def clean_ai(t):
    t = t.strip().strip('"\u201c\u201d').strip()
    return re.sub(r"^(review|here is.*?):\s*", "", t, flags=re.I)
def keep_ai(t):
    return (not BAD_START.match(t)) and not re.search(r"\bas an ai\b|\bi cannot\b|\bi can't help\b", t, re.I) and 15 <= wc(t) <= 160
```

Loop: sample a human row (for category, rating, and `text` in rephrase mode), call `gen`, clean, keep, append to `ai_<generator>.jsonl` on Drive every 200 rows (checkpoint). Target about 3,000 per generator. Split generators between team members. Columns: `text, label=1, generator, mode, category, rating`.

Size plan: ~12k human + ~12k AI for training/validation/testing; unseen generators are test only.

## A4. Clean and split

```python
from sklearn.model_selection import GroupShuffleSplit
def group_split(df, groups, test_size, seed=SEED):
    a, b = next(GroupShuffleSplit(1, test_size=test_size, random_state=seed).split(df, groups=df[groups]))
    return df.iloc[a], df.iloc[b]

h_seen = human[human.category.isin(TRAIN_CATS)]
h_rest, h_test = group_split(h_seen, "parent_asin", 0.15)
h_train, h_val = group_split(h_rest, "parent_asin", 0.15/0.85)
h_unseen_cat = human[human.category == UNSEEN_CAT]
```

AI split: for G1/G2 split rows 70/15/15 into train/val/test_id. G3/G4 (and G5) are entirely test.

Evaluation sets:

| Set | Human part | AI part |
|---|---|---|
| T1 in-distribution | `h_test` | G1/G2 `test_id` |
| T2 **unseen generator** | `h_test` | G3/G4/G5, all modes |
| T3 adversarial | `h_test` | `casual` mode from all generators |
| T4 **unseen category** | `h_unseen_cat` | AI generated for `UNSEEN_CAT` |
| T5 external (optional) | RAID reviews / OpSpam human | RAID reviews AI |

Cleaning rules: drop duplicates (exact and lowercase-stripped), 15-160 words, ASCII-dominant English, drop failed generations.

Leakage check (must pass):

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
def leak_aucs(tr, te):
    res = {}
    res["length_only"] = roc_auc_score(te.label, LogisticRegression().fit(tr.text.map(wc).values.reshape(-1,1), tr.label).predict_proba(te.text.map(wc).values.reshape(-1,1))[:,1])
    f3 = lambda d: d.text.str.lower().str.split().str[:3].str.join(" ")
    v = TfidfVectorizer(ngram_range=(1,3)); Xtr = v.fit_transform(f3(tr)); Xte = v.transform(f3(te))
    res["first3_words"] = roc_auc_score(te.label, LogisticRegression(max_iter=500).fit(Xtr, tr.label).predict_proba(Xte)[:,1])
    return res
# any value > 0.85 -> fix: length-match human and AI per 10-word bin, strip preambles/emojis/quotes
```

## A5. Stylometric features (the spec; TS must match exactly)

Rules for parity: every regex is ASCII-only; population std (ddof=0); characters counted as Unicode code points; text first normalised with `replace("\u2019","'")`.

```python
import re, math
WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*", re.ASCII)
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+", re.ASCII)
CONTR = re.compile(r"^[a-z]+'(?:s|t|re|ve|ll|d|m)$", re.ASCII)
FIRST_PERSON = {"i","me","my","mine","myself","we","our","us"}
FEATURE_NAMES = ["log_n_words","mean_sent_len","std_sent_len","cv_sent_len","max_sent_len","ttr","avg_word_len",
  "comma_ratio","exclam_ratio","question_ratio","ellipsis_ratio","paren_ratio","upper_ratio","allcaps_word_ratio",
  "digit_ratio","contraction_ratio","first_person_ratio","nonascii_ratio","repeated_bigram_ratio",
  "sent_start_lower_ratio","ends_with_terminal","emdash_ratio"]   # 22 features, ORDER MATTERS

def _div(a,b): return a/b if b else 0.0

def extract_features(text):
    text = text.replace("\u2019","'")
    words = WORD_RE.findall(text); n = len(words)
    if n == 0: return [0.0]*len(FEATURE_NAMES)
    low = [w.lower() for w in words]
    sents = [s for s in SENT_SPLIT.split(text.strip()) if WORD_RE.search(s)]
    sl = [len(WORD_RE.findall(s)) for s in sents] or [n]
    mean = sum(sl)/len(sl); std = math.sqrt(sum((x-mean)**2 for x in sl)/len(sl))
    nchar = len(text)                                    # code points
    letters = sum(c.isascii() and c.isalpha() for c in text)
    upper = sum('A' <= c <= 'Z' for c in text)
    bigrams = [f"{a} {b}" for a,b in zip(low, low[1:])]
    from collections import Counter
    bc = Counter(bigrams); rep = sum(v for v in bc.values() if v > 1)
    starts = [re.search(r"[A-Za-z]", s) for s in sents]
    st_low = [m.group(0).islower() for m in starts if m]
    stripped = text.strip()
    return [
      math.log1p(n), mean, std, _div(std, mean), float(max(sl)), len(set(low))/n, sum(map(len, words))/n,
      text.count(",")/n, text.count("!")/n, text.count("?")/n, text.count("...")/n, text.count("(")/n,
      _div(upper, letters), sum(1 for w in words if len(w) >= 2 and w == w.upper())/n,
      sum('0' <= c <= '9' for c in text)/nchar, sum(1 for w in low if CONTR.match(w))/n,
      sum(1 for w in low if w in FIRST_PERSON)/n, sum(ord(c) > 127 for c in text)/nchar,
      _div(rep, len(bigrams)), _div(sum(st_low), len(st_low)),
      1.0 if stripped and stripped[-1] in ".!?" else 0.0, text.count("\u2014")/n,
    ]
```

## A6. Train the feature model and export JSON

```python
from sklearn.preprocessing import StandardScaler
import numpy as np, json
Xtr = np.array([extract_features(t) for t in train_df.text]); ytr = train_df.label.values
sc = StandardScaler().fit(Xtr)
lr = LogisticRegression(max_iter=2000, class_weight="balanced").fit(sc.transform(Xtr), ytr)
hum = Xtr[ytr==0]
json.dump({"feature_names": FEATURE_NAMES, "mean": sc.mean_.tolist(), "scale": sc.scale_.tolist(),
           "coef": lr.coef_[0].tolist(), "intercept": float(lr.intercept_[0]),
           "human_mean": hum.mean(0).tolist(), "human_std": hum.std(0).tolist()},
          open(f"{ROOT}/exports/models/meta/stylometric.json","w"))
```
Also train XGBoost / Random Forest on the same features for the paper's comparison table (not exported to the app).

## A7. Fine-tune DistilBERT

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

## A8. Stacker, thresholds, error rates

```python
logit = lambda p: np.log(np.clip(p,1e-6,1-1e-6)/(1-np.clip(p,1e-6,1-1e-6)))
def feat_prob(df): 
    X = sc.transform(np.array([extract_features(t) for t in df.text])); return lr.predict_proba(X)[:,1]
Zv = np.c_[logit(predict_proba(val_df.text.tolist())), logit(feat_prob(val_df))]
stk = LogisticRegression().fit(Zv, val_df.label)               # fitted on VALIDATION only
pv = stk.predict_proba(Zv)[:,1]; hv = pv[val_df.label.values==0]
tau_high = float(np.quantile(hv, 0.98))     # at most 2% of human val reviews flagged
tau_low  = float(np.quantile(hv, 0.60))     # below this = "likely human" (tune by inspecting val)

def final_prob(df):
    Z = np.c_[logit(predict_proba(df.text.tolist())), logit(feat_prob(df))]; return stk.predict_proba(Z)[:,1]

def eval_set(df, p, tau):
    y = df.label.values; thr1 = np.quantile(p[y==0], 0.99)
    return {"n": len(df), "auc": roc_auc_score(y,p), "f1": f1_score(y, p>=tau), "acc": accuracy_score(y, p>=tau),
            "fpr": float((p[y==0]>=tau).mean()), "tpr": float((p[y==1]>=tau).mean()), "tpr@1%fpr": float((p[y==1]>thr1).mean())}
```

Run `eval_set` on T1-T4 (+T5), and report recall per generator and per mode (`groupby`).

Save `review-meta.json`: **`sensitivity_unseen` = TPR on T2 (unseen generators)** and **`specificity` = 1 - FPR on human test**. The backend uses them to correct the "% AI" estimate, so the conservative unseen-generator number matters.

```python
json.dump({"stacker": {"coef": stk.coef_[0].tolist(), "intercept": float(stk.intercept_[0])}},
          open(f"{ROOT}/exports/models/meta/stacker.json","w"))
json.dump({"version": "review-v1", "max_tokens": MAXLEN, "min_words": 15,
           "chunk": {"words": 160, "stride": 120, "min_words": 60},
           "thresholds": {"low": tau_low, "high": tau_high},
           "sensitivity_unseen": SENS_T2, "specificity": SPEC_TEST},
          open(f"{ROOT}/exports/models/meta/review-meta.json","w"))
```

Results table to fill for the report (also check human FPR on informal or non-native-style reviews and mention bias in limitations):

| Model | T1 AUC / TPR@1%FPR | T2 unseen gen | T3 adversarial | T4 unseen category | Human FPR |
|---|---|---|---|---|---|
| Features + LogReg | | | | | |
| Features + XGBoost | | | | | |
| DistilBERT | | | | | |
| Stacked (final) | | | | | |
| HC3 RoBERTa (baseline, Part B) | | | | | |

## A9. Export to ONNX and verify

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

Golden test file for the backend (include edge cases: emoji, curly quotes, ALL CAPS, one-word text, empty-ish text, very long sentence):

```python
EDGE = ["Love it \U0001F60D\U0001F60D!!!", "It\u2019s fine... I guess (not great).", "GREAT PRODUCT. HIGHLY RECOMMEND.",
        "ok", "   ", "word " * 150]
sample = val_df.sample(30, random_state=SEED).text.tolist() + EDGE
json.dump({"texts": sample, "features": [extract_features(t) for t in sample],
           "p_bert_q8": ort_proba(sample).tolist()}, open(f"{ROOT}/exports/models/meta/golden.json","w"))
```

---

# PART B: Modify a pretrained model for large text files

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

```python
BASE = "Hello-SimpleAI/chatgpt-detector-roberta"
model = AutoModelForSequenceClassification.from_pretrained(BASE)
print(model.config.id2label)
# ONLY if label 0 = human and label 1 = ChatGPT (verified!):
model.config.id2label = {0:"human", 1:"ai"}; model.config.label2id = {"human":0, "ai":1}
tok = AutoTokenizer.from_pretrained(BASE)
```
Reuse the A7 `Trainer` setup with these changes: `learning_rate=1e-5`, `num_train_epochs=2`, `per_device_train_batch_size=16`, `MAXLEN=256`, output `models/document-roberta`. A lower learning rate keeps what the model already knows and adapts it to the new generators and domains.

Evaluate on: held-out chunks, held-out generators, held-out domain, and (document level) the share of flagged chunks per document. Compare against the B2 baseline.

## B5. Document-level logic (implemented in the backend, tuned here)

Document score = mean of chunk probabilities. Also report `flaggedShare` = fraction of chunks above `tau_high`. Choose `tau_high` on validation chunks (FPR ≤ 2%). Compute `sensitivity_unseen` and `specificity` as in A8 and save `document-meta.json` with the same schema as `review-meta.json` (no stacker, no stylometric part).

## B6. Export

Use the same export and `build_model_dir(...)` code as A9, output `exports/models/document/`. Run the parity check there too.

## B7. Optional: Binoculars baseline
Run only if a high-memory GPU is available. Score 500 chunks from each test set and add a row to the results table. Do not put it in the app.

---

## 3. Deliverables checklist (hand off to backend team)

```
exports/models/
├── review/          # HF layout + onnx/model.onnx + onnx/model_quantized.onnx
├── document/        # same layout
└── meta/
    ├── review-meta.json
    ├── document-meta.json
    ├── stylometric.json
    ├── stacker.json
    └── golden.json
```

- [ ] Leakage check passed (A4)
- [ ] ONNX parity check passed for both models
- [ ] `golden.json` generated from the final models
- [ ] Results tables (A8) complete with unseen-generator numbers
- [ ] Notebook(s) committed to `ml/notebooks/`, with the seed and library versions printed in the first cell
- [ ] Known limitations written up: English only, short text is unreliable, possible bias against non-native writers, "AI-written" is not the same as "fake"

## 4. Link status

Checked in the Amazon Reviews 2023, HC3, RAID and Binoculars pages while planning. Verify the rest (Yelp, OpSpam, Optimum docs) yourself before relying on them. Check dataset and model licenses before redistributing anything.
