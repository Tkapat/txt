"""Part A/B inference service (PyTorch).

Loads the fine-tuned checkpoints from ``ml/models/<name>`` and exposes a tiny
HTTP API used by the Next.js backend:

    GET  /health        -> per-model readiness + metadata
    GET  /meta/<name>   -> metadata for one model (thresholds, version, chunking)
    POST /score         -> { model, texts } -> { probabilities }

Both models are raw ``model.safetensors`` exports, so no ONNX conversion is
needed. Runs in fp32 by default; set ``QUANTIZE=1`` to try int8 (dynamic int8
can degrade these checkpoints, so fp32 is the safe default).
"""

from __future__ import annotations

import json
import logging
import os
import threading
from contextlib import asynccontextmanager
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoConfig, AutoModelForSequenceClassification, AutoTokenizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("txt.ml")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_ROOT = os.environ.get("MODELS_ROOT", os.path.join(BASE_DIR, "models"))

MAX_TEXTS = int(os.environ.get("MAX_TEXTS", "1000"))
MAX_CHARS = int(os.environ.get("MAX_CHARS", "100000"))
BATCH_SIZE = int(os.environ.get("INFER_BATCH_SIZE", "16"))
QUANTIZE = os.environ.get("QUANTIZE", "0").lower() not in {"0", "false", "no"}
REVIEW_VERSION = os.environ.get("REVIEW_MODEL_VERSION", "review-v2")
DOCUMENT_VERSION = os.environ.get("DOCUMENT_MODEL_VERSION", "document-v1")

DEFAULT_MAX_LEN = 256
DEFAULT_CHUNK = {"words": 160, "stride": 120, "min_words": 60}
# Provisional review verdict cutoffs. The supplied margin_threshold (7.05) maps
# to P(ai) ~= 0.9991, which this checkpoint essentially never reaches, so it
# cannot be used as a verdict line. Override with THRESHOLD_LOW / THRESHOLD_HIGH.
DEFAULT_LOW = float(os.environ.get("THRESHOLD_LOW", "0.5"))
DEFAULT_HIGH = float(os.environ.get("THRESHOLD_HIGH", "0.9"))

MODEL_SPECS: dict[str, dict] = {
    "review": {
        "dir": os.environ.get("REVIEW_MODEL_DIR", os.path.join(MODELS_ROOT, "review")),
        "meta_file": "threshold.json",
        "version": REVIEW_VERSION,
    },
    "document": {
        "dir": os.environ.get(
            "DOCUMENT_MODEL_DIR", os.path.join(MODELS_ROOT, "document")
        ),
        "meta_file": "document-meta.json",
        "version": DOCUMENT_VERSION,
    },
}

_state: dict[str, dict] = {
    name: {
        "ready": False,
        "error": None,
        "tokenizer": None,
        "model": None,
        "ai_index": 1,
        "max_len": DEFAULT_MAX_LEN,
        "meta": {},
    }
    for name in MODEL_SPECS
}
_locks = {name: threading.Lock() for name in MODEL_SPECS}


def _default_meta(name: str) -> dict:
    if name == "review":
        return {
            "version": REVIEW_VERSION,
            "max_tokens": DEFAULT_MAX_LEN,
            "chunk": DEFAULT_CHUNK,
            "thresholds": {"low": DEFAULT_LOW, "high": DEFAULT_HIGH},
            "sensitivity_unseen": 0.5,
            "specificity": 0.5,
            "calibrated": False,
            "margin_threshold": None,
        }
    return {
        "version": DOCUMENT_VERSION,
        "max_tokens": DEFAULT_MAX_LEN,
        "chunk": DEFAULT_CHUNK,
        "thresholds": {"low": 0.5, "high": 0.5},
        "sensitivity_unseen": 0.5,
        "specificity": 0.5,
        "calibrated": False,
        "margin_threshold": None,
    }


def _load_meta(name: str) -> dict:
    meta = _default_meta(name)
    spec = MODEL_SPECS[name]
    path = os.path.join(spec["dir"], spec["meta_file"])
    if not os.path.exists(path) and name == "document":
        # Keep a tracked copy in ml/ so the calibration survives a fresh model
        # extraction (ml/models/ is gitignored).
        path = os.path.join(BASE_DIR, spec["meta_file"])
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception:
        return meta

    if name == "review":
        if isinstance(data.get("max_len"), int) and data["max_len"] > 0:
            meta["max_tokens"] = data["max_len"]
        margin = data.get("margin_threshold")
        if isinstance(margin, (int, float)):
            meta["margin_threshold"] = float(margin)
        if isinstance(data.get("thresholds"), dict):
            meta["thresholds"] = data["thresholds"]
            meta["calibrated"] = True
        for key in ("version", "sensitivity_unseen", "specificity"):
            if key in data:
                meta[key] = data[key]
    else:
        for key in (
            "version",
            "max_tokens",
            "chunk",
            "thresholds",
            "sensitivity_unseen",
            "specificity",
        ):
            if key in data:
                meta[key] = data[key]
        meta["calibrated"] = isinstance(data.get("thresholds"), dict)
    return meta


def load_runtime(name: str) -> None:
    spec = MODEL_SPECS[name]
    meta = _load_meta(name)
    _state[name]["meta"] = meta
    try:
        config = AutoConfig.from_pretrained(spec["dir"])
        tokenizer = AutoTokenizer.from_pretrained(spec["dir"])
        model = AutoModelForSequenceClassification.from_pretrained(spec["dir"])
        model.eval()

        if QUANTIZE:
            try:
                model = torch.ao.quantization.quantize_dynamic(
                    model, {torch.nn.Linear}, dtype=torch.qint8
                )
            except Exception as exc:  # pragma: no cover - fall back to fp32
                logger.warning("%s: int8 quantization failed, using fp32: %s", name, exc)

        _state[name].update(
            ready=True,
            error=None,
            tokenizer=tokenizer,
            model=model,
            ai_index=int(config.label2id.get("ai", 1)),
            max_len=int(meta["max_tokens"]),
        )
        logger.info(
            "Loaded %s %s from %s (quantized=%s, max_len=%d, high=%.4f)",
            name,
            meta["version"],
            spec["dir"],
            QUANTIZE,
            _state[name]["max_len"],
            float(meta["thresholds"]["high"]),
        )
    except Exception as exc:  # pragma: no cover - surfaced through /health
        _state[name].update(ready=False, error=str(exc))
        logger.exception("Failed to load %s model from %s", name, spec["dir"])


def _score_texts(name: str, texts: list[str]) -> list[float]:
    state = _state[name]
    tokenizer = state["tokenizer"]
    model = state["model"]
    ai_index = state["ai_index"]
    max_len = state["max_len"]

    probabilities: list[float] = []
    with _locks[name]:
        for start in range(0, len(texts), BATCH_SIZE):
            batch = texts[start : start + BATCH_SIZE]
            encoded = tokenizer(
                batch,
                truncation=True,
                max_length=max_len,
                padding=True,
                return_tensors="pt",
            )
            with torch.inference_mode():
                logits = model(**encoded).logits
            probs = torch.softmax(logits.float(), dim=-1)[:, ai_index].tolist()
            probabilities.extend(float(value) for value in probs)
    return probabilities


def _meta_response(name: str) -> dict:
    state = _state[name]
    return {
        "ok": True,
        "model": name,
        "ready": bool(state["ready"]),
        **state["meta"],
        "quantized": QUANTIZE,
        "device": "cpu",
    }


@asynccontextmanager
async def lifespan(_app: FastAPI):
    torch.set_grad_enabled(False)
    torch.set_num_threads(int(os.environ.get("TORCH_THREADS") or os.cpu_count() or 4))
    for name in MODEL_SPECS:
        load_runtime(name)
    yield


app = FastAPI(title="txt detectors", version=REVIEW_VERSION, lifespan=lifespan)


class ScoreIn(BaseModel):
    texts: list[str] = Field(default_factory=list)
    model: Literal["review", "document"] = "review"


@app.get("/health")
def health() -> dict:
    return {"ok": True, "models": {name: _meta_response(name) for name in MODEL_SPECS}}


@app.get("/meta")
def meta_review() -> dict:
    return _meta_response("review")


@app.get("/meta/{name}")
def meta(name: str) -> dict:
    if name not in MODEL_SPECS:
        raise HTTPException(status_code=404, detail="unknown_model")
    return _meta_response(name)


@app.post("/score")
def score(payload: ScoreIn) -> dict:
    state = _state[payload.model]
    if not state["ready"]:
        raise HTTPException(status_code=503, detail="model_unavailable")
    if len(payload.texts) > MAX_TEXTS:
        raise HTTPException(status_code=413, detail="too_many_texts")
    if any(len(text) > MAX_CHARS for text in payload.texts):
        raise HTTPException(status_code=413, detail="too_large")
    if not payload.texts:
        return {
            "probabilities": [],
            "version": state["meta"]["version"],
            "thresholds": state["meta"]["thresholds"],
        }
    try:
        probabilities = _score_texts(payload.model, payload.texts)
    except Exception:
        logger.exception("%s inference failed", payload.model)
        raise HTTPException(status_code=500, detail="internal") from None
    return {
        "probabilities": probabilities,
        "version": state["meta"]["version"],
        "thresholds": state["meta"]["thresholds"],
    }


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000)
