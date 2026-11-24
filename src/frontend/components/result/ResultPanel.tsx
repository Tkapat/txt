"use client";

import type { TextResult, DocumentResult } from "@/shared/types";
import { VerdictStamp } from "./VerdictStamp";
import { ProbabilityRule } from "./ProbabilityRule";
import { HighlightedText } from "./HighlightedText";
import { EvidenceList } from "./EvidenceList";
import { CueList } from "./CueList";
import { ChunkStrip } from "./ChunkStrip";
import { Disclaimer } from "./Disclaimer";
import { PaperSheet } from "@/frontend/components/paper/PaperSheet";
import { RuleLine } from "@/frontend/components/paper/RuleLine";
import { warningMessage, stampText, confidenceLabel } from "@/frontend/lib/format";
import { useState } from "react";

interface ResultPanelProps {
  result: TextResult | DocumentResult;
  inputText: string;
}

function isDocumentResult(r: TextResult | DocumentResult): r is DocumentResult {
  return "chunks" in r;
}

export function ResultPanel({ result, inputText }: ResultPanelProps) {
  const [activeEvidence, setActiveEvidence] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const isDoc = isDocumentResult(result);
  const warnings = result.warnings
    .map(warningMessage)
    .filter((w): w is string => w !== null);

  const handleCopySummary = async () => {
    const summary = `txt: ${Math.round(result.aiProbability * 100)}% ${stampText(result.verdict).toLowerCase()} (${confidenceLabel(result.confidence)}). Estimate, not proof.`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  };

  return (
    <PaperSheet className="mt-8 result-panel animate-sheet-bounce">
      {/* Verdict + Probability + Actions */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between mb-6">
        <div className="flex flex-col gap-3 items-start">
          <VerdictStamp
            verdict={result.verdict}
            confidence={result.confidence}
          />
          <button
            onClick={handleCopySummary}
            className="btn-secondary text-xs flex items-center gap-1.5 p-0"
            aria-label="Copy summary to clipboard"
            data-print-hide
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            <span>{copied ? "Copied summary!" : "Copy summary"}</span>
          </button>
        </div>
        <ProbabilityRule probability={result.aiProbability} />
      </div>

      <RuleLine />

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-4 mb-2 flex flex-col gap-1">
          {warnings.map((w, i) => (
            <p
              key={i}
              className="m-0 text-xs"
              style={{
                color: "var(--stamp-amber)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Text + Evidence (responsive 1-column on mobile, 2-column on lg) */}
      <div className={`mt-6 grid grid-cols-1 ${inputText ? "lg:grid-cols-[1fr_minmax(200px,280px)]" : ""} gap-6`}>
        {/* Left: Highlighted text or Chunk strip */}
        <div className="min-w-0">
          {inputText && result.evidence.length > 0 ? (
            <HighlightedText
              text={inputText}
              evidence={result.evidence}
              activeIndex={activeEvidence}
              onHover={setActiveEvidence}
            />
          ) : isDoc ? (
            <ChunkStrip
              chunks={result.chunks}
              flaggedShare={result.flaggedShare}
              source={result.source}
            />
          ) : null}
        </div>

        {/* Right: Evidence + Cues (margin notes stacked on mobile, sidebar on desktop) */}
        {(result.evidence.length > 0 || result.cues.length > 0) && (
          <aside className="flex flex-col gap-4 border-t pt-4 lg:border-t-0 lg:pt-0" style={{ borderColor: "var(--rule)" }}>
            {result.evidence.length > 0 && (
              <EvidenceList
                evidence={result.evidence}
                activeIndex={activeEvidence}
                onHover={setActiveEvidence}
              />
            )}
            {result.cues.length > 0 && <CueList cues={result.cues} />}
          </aside>
        )}
      </div>

      {/* Chunk strip for documents with text */}
      {isDoc && inputText && (
        <div className="mt-6">
          <ChunkStrip
            chunks={result.chunks}
            flaggedShare={result.flaggedShare}
            source={result.source}
          />
        </div>
      )}

      <div className="mt-8">
        <Disclaimer />
      </div>
    </PaperSheet>
  );
}
