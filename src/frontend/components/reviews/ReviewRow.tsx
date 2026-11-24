"use client";

import { useState } from "react";
import type { ReviewScore } from "@/shared/types";
import { pct, stampText } from "@/frontend/lib/format";

interface ReviewRowProps {
  review: ReviewScore;
}

export function ReviewRow({ review }: ReviewRowProps) {
  const [expanded, setExpanded] = useState(false);
  const pctValue = Math.round(review.aiProbability * 100);

  return (
    <div
      className="rounded-sm transition-colors"
      style={{
        background: expanded ? "var(--paper-edge)" : "transparent",
        border: "1px solid var(--rule)",
      }}
    >
      <button
        className="flex items-center gap-3 w-full px-3 py-2 text-left bg-transparent border-0 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{ minHeight: "44px" }}
      >
        {/* ID */}
        <span
          className="shrink-0"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-label)",
            color: "var(--ink-faint)",
            width: "2.5em",
          }}
        >
          #{review.id}
        </span>

        {/* Mini probability bar */}
        <div className="flex-1 max-w-[120px]">
          <div
            className="h-1.5 rounded-full"
            style={{
              background: "var(--rule)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${pctValue}%`,
                background:
                  review.verdict === "likely_ai"
                    ? "var(--stamp-red)"
                    : review.verdict === "uncertain"
                      ? "var(--stamp-amber)"
                      : "var(--stamp-green)",
              }}
            />
          </div>
        </div>

        {/* Percentage */}
        <span
          className="shrink-0"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-label)",
            color: "var(--ink-soft)",
            width: "3em",
            textAlign: "right",
          }}
        >
          {pct(review.aiProbability)}
        </span>

        {/* Verdict */}
        <span
          className="shrink-0"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-label)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color:
              review.verdict === "likely_ai"
                ? "var(--stamp-red)"
                : review.verdict === "uncertain"
                  ? "var(--stamp-amber)"
                  : "var(--stamp-green)",
          }}
        >
          {stampText(review.verdict)}
        </span>

        {/* Words */}
        <span
          className="shrink-0 hidden sm:inline"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-label)",
            color: "var(--ink-faint)",
          }}
        >
          {review.wordCount}w
        </span>

        {/* Expand indicator */}
        <span
          className="shrink-0"
          style={{
            color: "var(--ink-faint)",
            fontSize: "12px",
            transition: "transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 animate-fade-in"
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--fs-small)",
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}
        >
          <p className="m-0">
            Review #{review.id} · {review.wordCount} words ·{" "}
            {pct(review.aiProbability)} AI probability ·{" "}
            {stampText(review.verdict)}
          </p>
        </div>
      )}
    </div>
  );
}
