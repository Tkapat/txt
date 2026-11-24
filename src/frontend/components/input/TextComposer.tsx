"use client";

import { useRef, type KeyboardEvent, type ChangeEvent } from "react";
import { countWords, countChars } from "@/frontend/lib/format";
import { MAX_TEXT_CHARS, MIN_WORDS_WARN } from "@/shared/constants";

interface TextComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function TextComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: TextComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const words = countWords(value);
  const chars = countChars(value);
  const isEmpty = value.trim().length === 0;
  const isOverLimit = chars > MAX_TEXT_CHARS;
  const isShort = words > 0 && words < MIN_WORDS_WARN;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isEmpty && !isOverLimit && !disabled) {
        onSubmit(value);
      }
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
  }

  return (
    <div className="flex flex-col gap-2 animate-fade-up delay-3">
      <textarea
        ref={textareaRef}
        className="ruled min-h-[192px]"
        placeholder="Paste a review, an essay or any text. Around 40 words or more works best."
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label="Text to analyse"
        rows={6}
      />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="mono-label"
            aria-live="polite"
          >
            {words} {words === 1 ? "word" : "words"}
          </span>
          {isShort && (
            <span
              className="text-xs"
              style={{ color: "var(--stamp-amber)", fontFamily: "var(--font-mono)" }}
            >
              Short text is less reliable
            </span>
          )}
          {isOverLimit && (
            <span
              className="text-xs"
              style={{ color: "var(--stamp-red)", fontFamily: "var(--font-mono)" }}
            >
              Over {MAX_TEXT_CHARS.toLocaleString()} character limit
            </span>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={() => onSubmit(value)}
          disabled={isEmpty || isOverLimit || disabled}
        >
          Analyse
          <kbd
            className="text-xs opacity-60 ml-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ⌘↵
          </kbd>
        </button>
      </div>
    </div>
  );
}
