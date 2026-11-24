import type { Verdict, Confidence } from "@/shared/types";
import { Stamp } from "@/frontend/components/paper/Stamp";
import { confidenceLabel } from "@/frontend/lib/format";

interface VerdictStampProps {
  verdict: Verdict;
  confidence: Confidence;
}

export function VerdictStamp({ verdict, confidence }: VerdictStampProps) {
  return (
    <div className="flex flex-col items-start gap-2" aria-live="polite">
      <Stamp verdict={verdict} />
      <span className="mono-label animate-fade-in delay-3">
        {confidenceLabel(confidence)}
      </span>
    </div>
  );
}
