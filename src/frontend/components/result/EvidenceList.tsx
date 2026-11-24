import type { PhraseEvidence } from "@/shared/types";

interface EvidenceListProps {
  evidence: PhraseEvidence[];
  activeIndex: number | null;
  onHover: (i: number | null) => void;
}

export function EvidenceList({
  evidence,
  activeIndex,
  onHover,
}: EvidenceListProps) {
  return (
    <div className="animate-fade-in delay-5">
      <h3 className="mono-label mb-2">Evidence</h3>
      <ol className="list-none m-0 p-0 flex flex-col gap-3">
        {evidence.map((ev, i) => (
          <li
            key={i}
            className="flex items-start gap-2 cursor-pointer transition-opacity"
            style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.4 : 1 }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(i)}
            onBlur={() => onHover(null)}
            tabIndex={0}
            role="button"
            aria-label={`Evidence phrase ${i + 1}`}
          >
            <span
              className="shrink-0 mt-0.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-label)",
                color: "var(--ink-faint)",
                width: "1.2em",
              }}
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <span
                className="italic leading-snug"
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "var(--fs-small)",
                  color: "var(--ink)",
                }}
              >
                &ldquo;{ev.text}&rdquo;
              </span>
              {/* Weight bar */}
              <div className="flex items-center gap-2">
                <div
                  className="h-1 rounded-full"
                  style={{
                    background: "var(--marker)",
                    width: `${Math.min(ev.weight * 100, 100)}%`,
                    minWidth: "8px",
                    maxWidth: "80px",
                  }}
                />
                <span className="mono-label" style={{ fontSize: "10px" }}>
                  {ev.weight.toFixed(3)}
                </span>
              </div>
              {ev.reviewId && (
                <span
                  className="marginalia text-xs"
                  style={{ transform: "none" }}
                >
                  Review #{ev.reviewId}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
