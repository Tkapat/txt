"use client";

import { useCallback, useReducer, useRef } from "react";
import { api, ApiClientError } from "@/frontend/lib/api";
import type { DocumentResult, TextResult } from "@/shared/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: TextResult | DocumentResult; input: string }
  | { status: "error"; message: string; code: string };

type Action =
  | { type: "start" }
  | { type: "ok"; result: TextResult | DocumentResult; input: string }
  | { type: "fail"; message: string; code: string }
  | { type: "reset" };

function reducer(_s: State, a: Action): State {
  switch (a.type) {
    case "start":
      return { status: "loading" };
    case "ok":
      return { status: "success", result: a.result, input: a.input };
    case "fail":
      return { status: "error", message: a.message, code: a.code };
    case "reset":
      return { status: "idle" };
  }
}

export function useDetect() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" } as State);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(async (input: string | File) => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    dispatch({ type: "start" });
    try {
      const result =
        typeof input === "string"
          ? await api.detectText(input, ctrl.current.signal)
          : await api.detectFile(input, ctrl.current.signal);
      dispatch({
        type: "ok",
        result,
        input: typeof input === "string" ? input : "",
      });
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

  return { state, run, reset };
}
