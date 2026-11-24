"use client";

import { useEffect, useRef, useState } from "react";
import { pctNum } from "@/frontend/lib/format";
import { useReducedMotion } from "@/frontend/hooks/useReducedMotion";

interface ProbabilityRuleProps {
  probability: number;
}

export function ProbabilityRule({ probability }: ProbabilityRuleProps) {
  const pctValue = pctNum(probability);
  const reduced = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) return;

    const duration = 1100;
    const start = performance.now();
    const from = 0;
    const to = pctValue;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pctValue, reduced]);

  const valueToDisplay = reduced ? pctValue : displayed;

  return (
    <div
      className="flex flex-col gap-2 w-full max-w-xs animate-fade-in delay-2"
      aria-label={`AI probability: ${pctValue}%`}
    >
      {/* Number */}
      <div className="flex items-baseline gap-2">
        <span
          className="pct tabular-nums"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 1.5rem + 2vw, 3rem)",
            fontWeight: 300,
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          {valueToDisplay}%
        </span>
        <span className="mono-label">AI probability</span>
      </div>

      {/* Ruler */}
      <div className="relative h-6 w-full">
        {/* Track */}
        <div
          className="absolute top-3 left-0 right-0 h-px"
          style={{ background: "var(--ink)" }}
        />
        {/* Tick marks every 25% */}
        {[0, 25, 50, 75, 100].map((tick) => (
          <div
            key={tick}
            className="absolute top-1.5"
            style={{
              left: `${tick}%`,
              width: "1px",
              height: "10px",
              background: "var(--ink-faint)",
            }}
          >
            <span
              className="absolute top-3 -translate-x-1/2"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--ink-faint)",
              }}
            >
              {tick}
            </span>
          </div>
        ))}
        {/* Marker */}
        <div
          className="absolute top-0.5 -translate-x-1/2 transition-[left] duration-1000 ease-out"
          style={{ left: `${pctValue}%` }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "8px solid var(--ink)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
