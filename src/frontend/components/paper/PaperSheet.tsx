import type { ReactNode } from "react";
import { cn } from "@/frontend/lib/cn";
import { PaperClip } from "@/frontend/components/art/PaperClip";

interface PaperSheetProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  clip?: "tr" | "tl" | false;
}

export function PaperSheet({
  children,
  className,
  animate = true,
  clip = false,
}: PaperSheetProps) {
  return (
    <div
      className={cn(
        "sheet",
        animate && "animate-sheet-in",
        className,
      )}
    >
      {clip && <PaperClip corner={clip} />}
      {children}
    </div>
  );
}
