import type { ReactNode } from "react";
import { cn } from "@/frontend/lib/cn";

interface PaperSheetProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}

export function PaperSheet({
  children,
  className,
  animate = true,
}: PaperSheetProps) {
  return (
    <div
      className={cn(
        "sheet",
        animate && "animate-sheet-in",
        className,
      )}
    >
      {children}
    </div>
  );
}
