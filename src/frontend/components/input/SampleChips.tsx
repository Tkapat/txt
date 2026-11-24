"use client";

import { SAMPLE_HUMAN, SAMPLE_AI } from "@/frontend/lib/samples";

interface SampleChipsProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function SampleChips({ onSelect, disabled }: SampleChipsProps) {
  return (
    <div
      className="sample-chips flex items-center gap-2 flex-wrap"
      data-print-hide
    >
      <span className="mono-label">Try a sample:</span>
      <button
        className="btn-secondary"
        onClick={() => onSelect(SAMPLE_HUMAN)}
        disabled={disabled}
        style={{ color: "var(--stamp-green)" }}
      >
        Human text
      </button>
      <button
        className="btn-secondary"
        onClick={() => onSelect(SAMPLE_AI)}
        disabled={disabled}
        style={{ color: "var(--stamp-red)" }}
      >
        AI text
      </button>
    </div>
  );
}
