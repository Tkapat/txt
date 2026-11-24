import type { Cue } from "@/shared/types";
import { Marginalia } from "@/frontend/components/paper/Marginalia";

interface CueListProps {
  cues: Cue[];
}

export function CueList({ cues }: CueListProps) {
  if (cues.length === 0) return null;

  return (
    <div className="animate-fade-in delay-6">
      <h3 className="mono-label mb-2">Style cues</h3>
      <ul className="list-none m-0 p-0 flex flex-col gap-2">
        {cues.map((cue, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              style={{
                fontSize: "12px",
                color:
                  cue.direction === "toward_ai"
                    ? "var(--stamp-red)"
                    : "var(--stamp-green)",
              }}
            >
              {cue.direction === "toward_ai" ? "→ AI" : "→ Human"}
            </span>
            <Marginalia>{cue.label}</Marginalia>
          </li>
        ))}
      </ul>
    </div>
  );
}
