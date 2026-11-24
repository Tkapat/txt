import type { Verdict } from "@/shared/types";
import { stampText } from "@/frontend/lib/format";

interface StampProps {
  verdict: Verdict;
  animate?: boolean;
}

export function Stamp({ verdict, animate = true }: StampProps) {
  return (
    <span
      className={`stamp ${animate ? "animate-stamp-thump" : ""}`}
      data-verdict={verdict}
      role="status"
      aria-label={stampText(verdict)}
    >
      {stampText(verdict)}
    </span>
  );
}
