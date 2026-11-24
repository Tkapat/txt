"use client";

import type { Prevalence } from "@/shared/types";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/frontend/hooks/useReducedMotion";

interface PrevalenceFigureProps {
  prevalence: Prevalence;
  analyzed: number;
  flaggedCount: number;
  skippedShort: number;
  total: number;
}

export function PrevalenceFigure({
  prevalence,
  analyzed,
  flaggedCount,
  skippedShort,
  total,
}: PrevalenceFigureProps) {
  const target = Math.round(prevalence.estimated * 100);
  const low = Math.round(prevalence.low * 100);
  const high = Math.round(prevalence.high * 100);
  const reduced = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) return;

    const duration = 1200;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setDisplayed(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, reduced]);

  const valueToDisplay = reduced ? target : displayed;

  return (
    <div aria-live="polite">
      <div className="flex items-baseline gap-2 mb-2">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 2rem + 3vw, 4.5rem)",
            fontWeight: 300,
            fontVariantNumeric: "tabular-nums",
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          ~{valueToDisplay}%
        </span>
      </div>

      <p
        className="m-0 mb-1 animate-fade-in delay-3"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-small)",
          color: "var(--ink-soft)",
        }}
      >
        range {low}–{high}%
      </p>

      <p
        className="m-0 animate-fade-in delay-4"
        style={{
          fontFamily: "var(--font-text)",
          fontSize: "var(--fs-body)",
          color: "var(--ink-soft)",
        }}
      >
        {flaggedCount} of {analyzed} analysed reviews flagged
        {skippedShort > 0 && (
          <> · {skippedShort} skipped (too short)</>
        )}
        {total !== analyzed + skippedShort && (
          <> · {total} total</>
        )}
      </p>
    </div>
  );
}
