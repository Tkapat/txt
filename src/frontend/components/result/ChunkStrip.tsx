import type { ChunkResult } from "@/shared/types";
import { pct } from "@/frontend/lib/format";

interface ChunkStripProps {
  chunks: ChunkResult[];
  flaggedShare: number;
  source?: { fileName: string; chars: number };
}

export function ChunkStrip({ chunks, flaggedShare, source }: ChunkStripProps) {
  return (
    <div className="animate-fade-in delay-4">
      {source && (
        <p
          className="m-0 mb-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-small)",
            color: "var(--ink-soft)",
          }}
        >
          {source.fileName} · {source.chars.toLocaleString()} characters
        </p>
      )}

      <h3 className="mono-label mb-2">
        Document chunks · {pct(flaggedShare)} flagged
      </h3>

      <div className="flex gap-0.5 h-6 w-full" role="img" aria-label={`${chunks.length} chunks, ${pct(flaggedShare)} flagged`}>
        {chunks.map((chunk) => (
          <div
            key={chunk.index}
            className="flex-1 rounded-sm transition-opacity"
            style={{
              background: chunk.flagged
                ? `color-mix(in srgb, var(--stamp-red) ${Math.round(chunk.aiProbability * 100)}%, var(--paper-edge))`
                : `color-mix(in srgb, var(--stamp-green) ${Math.round((1 - chunk.aiProbability) * 60)}%, var(--paper-edge))`,
              opacity: 0.8,
            }}
            title={`Chunk ${chunk.index + 1}: ${Math.round(chunk.aiProbability * 100)}% AI`}
          />
        ))}
      </div>

      <div className="flex justify-between mt-1">
        <span className="mono-label" style={{ fontSize: "9px" }}>
          Start
        </span>
        <span className="mono-label" style={{ fontSize: "9px" }}>
          End
        </span>
      </div>
    </div>
  );
}
