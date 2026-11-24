import type { PhraseEvidence } from "@/shared/types";

type Seg = { text: string; evidenceIndex: number | null };

export function toSegments(text: string, ev: PhraseEvidence[]): Seg[] {
  const sorted = ev
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => a.start - b.start);
  const segs: Seg[] = [];
  let cursor = 0;
  for (const e of sorted) {
    if (e.start < cursor || e.end > text.length) continue; // skip overlaps and bad offsets
    if (e.start > cursor)
      segs.push({ text: text.slice(cursor, e.start), evidenceIndex: null });
    segs.push({ text: text.slice(e.start, e.end), evidenceIndex: e.i });
    cursor = e.end;
  }
  if (cursor < text.length)
    segs.push({ text: text.slice(cursor), evidenceIndex: null });
  return segs;
}

interface HighlightedTextProps {
  text: string;
  evidence: PhraseEvidence[];
  activeIndex: number | null;
  onHover: (i: number | null) => void;
}

export function HighlightedText({
  text,
  evidence,
  activeIndex,
  onHover,
}: HighlightedTextProps) {
  return (
    <p
      className="reading-text m-0 leading-relaxed"
      style={{
        fontFamily: "var(--font-text)",
        fontSize: "var(--fs-body)",
        maxWidth: "68ch",
      }}
      data-testid="highlighted-text"
    >
      {toSegments(text, evidence).map((s, k) =>
        s.evidenceIndex === null ? (
          <span key={k}>{s.text}</span>
        ) : (
          <mark
            key={k}
            className="hl animate-highlight-sweep"
            style={{ animationDelay: `${0.4 + s.evidenceIndex * 0.25}s` }}
            data-active={activeIndex === s.evidenceIndex}
            data-ev={s.evidenceIndex}
            onMouseEnter={() => onHover(s.evidenceIndex)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(s.evidenceIndex)}
            onBlur={() => onHover(null)}
            tabIndex={0}
            role="button"
            aria-label={`Evidence ${(s.evidenceIndex ?? 0) + 1}: ${s.text}`}
          >
            {s.text}
          </mark>
        ),
      )}
    </p>
  );
}
