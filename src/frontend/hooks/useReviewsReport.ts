"use client";

import { useCallback, useReducer, useRef } from "react";
import { api, ApiClientError } from "@/frontend/lib/api";
import type { ReviewInput, ReviewsReport } from "@/shared/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; report: ReviewsReport }
  | { status: "error"; message: string; code: string };

type Action =
  | { type: "start" }
  | { type: "ok"; report: ReviewsReport }
  | { type: "fail"; message: string; code: string }
  | { type: "reset" };

function reducer(_s: State, a: Action): State {
  switch (a.type) {
    case "start":
      return { status: "loading" };
    case "ok":
      return { status: "success", report: a.report };
    case "fail":
      return { status: "error", message: a.message, code: a.code };
    case "reset":
      return { status: "idle" };
  }
}

export function useReviewsReport() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" } as State);
  const ctrl = useRef<AbortController | null>(null);

  const runJson = useCallback(async (reviews: ReviewInput[]) => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    dispatch({ type: "start" });
    try {
      const report = await api.detectReviews(reviews, ctrl.current.signal);
      dispatch({ type: "ok", report });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const err = e as ApiClientError;
      dispatch({
        type: "fail",
        message: err.message,
        code: err.code ?? "unknown",
      });
    }
  }, []);

  const runCsv = useCallback(async (file: File) => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    dispatch({ type: "start" });
    try {
      const report = await api.detectReviewsCsv(file, ctrl.current.signal);
      dispatch({ type: "ok", report });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const err = e as ApiClientError;
      dispatch({
        type: "fail",
        message: err.message,
        code: err.code ?? "unknown",
      });
    }
  }, []);

  const reset = useCallback(() => {
    ctrl.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, runJson, runCsv, reset };
}
