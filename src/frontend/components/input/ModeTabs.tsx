"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/frontend/lib/cn";

type Mode = "text" | "file";

interface ModeTabsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

const TABS: { value: Mode; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "file", label: "File" },
];

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const button of list.querySelectorAll("button")) {
      observer.observe(button);
    }

    return () => observer.disconnect();
  }, [mode]);

  return (
    <div
      ref={listRef}
      className="mode-tabs relative flex gap-2 border-b border-[var(--rule)]"
      role="tablist"
      data-print-hide
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={mode === tab.value}
          onClick={() => onModeChange(tab.value)}
          className={cn(
            "mono-label px-4 py-2 bg-transparent cursor-pointer transition-colors",
            mode === tab.value
              ? "text-[var(--ink)] font-medium"
              : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)]",
          )}
        >
          {tab.label}
        </button>
      ))}
      <span
        className="tab-underline"
        aria-hidden="true"
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: indicator.width,
        }}
      />
    </div>
  );
}
