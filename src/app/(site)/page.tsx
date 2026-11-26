"use client";

import { useEffect, useState } from "react";
import { useDetect } from "@/frontend/hooks/useDetect";
import { PageShell } from "@/frontend/components/layout/PageShell";
import { PaperSheet } from "@/frontend/components/paper/PaperSheet";
import { RuleLine } from "@/frontend/components/paper/RuleLine";
import { ModeTabs } from "@/frontend/components/input/ModeTabs";
import { TextComposer } from "@/frontend/components/input/TextComposer";
import { FileDrop } from "@/frontend/components/input/FileDrop";
import { SampleChips } from "@/frontend/components/input/SampleChips";
import { ResultPanel } from "@/frontend/components/result/ResultPanel";
import { InkLoader } from "@/frontend/components/feedback/InkLoader";
import { ErrorNote } from "@/frontend/components/feedback/ErrorNote";

export default function WorkbenchPage() {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const { state, run, reset } = useDetect();
  const isLoading = state.status === "loading";

  // Clear results on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        reset();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reset]);

  function handleTextSubmit(value: string) {
    run(value);
  }

  function handleFileSubmit(file: File) {
    run(file);
  }

  function handleSample(sample: string) {
    setText(sample);
    setMode("text");
  }

  function handleReset() {
    reset();
    setText("");
  }

  return (
    <PageShell>
      <PaperSheet clip="tr">
        {/* Hero */}
        <div className="mb-6 animate-fade-up">
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-hero)",
              fontWeight: 300,
              color: "var(--ink)",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Read between the{" "}
            <em className="hero-key" style={{ fontStyle: "italic" }}>
              lines.
              <span className="swipe" aria-hidden="true" />
            </em>
          </h1>
        </div>

        <RuleLine className="mb-6" />

        {/* Mode tabs */}
        <div className="mb-4 animate-fade-up delay-2">
          <ModeTabs mode={mode} onModeChange={setMode} />
        </div>

        {/* Input */}
        {mode === "text" ? (
          <TextComposer
            value={text}
            onChange={setText}
            onSubmit={handleTextSubmit}
            disabled={isLoading}
          />
        ) : (
          <FileDrop onFile={handleFileSubmit} disabled={isLoading} />
        )}

        {/* Sample chips */}
        {mode === "text" && state.status === "idle" && (
          <div className="mt-3 animate-fade-up delay-4">
            <SampleChips onSelect={handleSample} disabled={isLoading} />
          </div>
        )}
      </PaperSheet>

      {/* Results */}
      {state.status === "loading" && <InkLoader />}

      {state.status === "error" && (
        <div className="mt-6 mx-auto" style={{ maxWidth: "var(--sheet-w)" }}>
          <ErrorNote
            message={state.message}
            code={state.code}
            onRetry={handleReset}
          />
        </div>
      )}

      {state.status === "success" && (
        <ResultPanel result={state.result} inputText={state.input} />
      )}
    </PageShell>
  );
}
