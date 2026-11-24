"use client";

import { cn } from "@/frontend/lib/cn";

type Mode = "text" | "file";

interface ModeTabsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className="mode-tabs flex gap-0" role="tablist" data-print-hide>
      <button
        role="tab"
        aria-selected={mode === "text"}
        onClick={() => onModeChange("text")}
        className={cn(
          "mono-label px-4 py-2 border-b-2 transition-colors bg-transparent cursor-pointer",
          mode === "text"
            ? "border-[var(--ink)] text-[var(--ink)] font-medium"
            : "border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-soft)]",
        )}
      >
        Text
      </button>
      <button
        role="tab"
        aria-selected={mode === "file"}
        onClick={() => onModeChange("file")}
        className={cn(
          "mono-label px-4 py-2 border-b-2 transition-colors bg-transparent cursor-pointer",
          mode === "file"
            ? "border-[var(--ink)] text-[var(--ink)] font-medium"
            : "border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-soft)]",
        )}
      >
        File
      </button>
    </div>
  );
}
