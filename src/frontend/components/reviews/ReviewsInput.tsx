"use client";

import { useRef, useState, type KeyboardEvent, type DragEvent } from "react";
import { MAX_REVIEWS, MAX_FILE_MB } from "@/shared/constants";
import type { ReviewInput } from "@/shared/types";
import { formatSize } from "@/frontend/lib/format";

interface ReviewsInputProps {
  onSubmitText: (reviews: ReviewInput[]) => void;
  onSubmitFile: (file: File) => void;
  disabled?: boolean;
}

function parseReviewsText(raw: string): ReviewInput[] {
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((text, i) => ({ id: String(i + 1), text }));
}

export function ReviewsInput({
  onSubmitText,
  onSubmitFile,
  disabled = false,
}: ReviewsInputProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reviews = parseReviewsText(text);
  const count = reviews.length;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (count > 0 && count <= MAX_REVIEWS && !disabled) {
        onSubmitText(reviews);
      }
    }
  }

  function handleFileSelect(selected: File) {
    if (!/\.(csv|xlsx)$/i.test(selected.name)) {
      setFileError("Please choose a .csv or .xlsx file.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File is larger than ${MAX_FILE_MB} MB.`);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(selected);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Text input */}
      <div className="flex flex-col gap-2">
        <label
          className="mono-label"
          htmlFor="reviews-textarea"
        >
          Paste reviews (separate with blank lines)
        </label>
        <textarea
          id="reviews-textarea"
          className="ruled min-h-[160px]"
          placeholder={"First review text goes here.\n\nSecond review text goes here.\n\nThird review..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={6}
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="mono-label">
              {count} {count === 1 ? "review" : "reviews"}
            </span>
            {count > MAX_REVIEWS && (
              <span
                className="text-xs"
                style={{
                  color: "var(--stamp-red)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Max {MAX_REVIEWS} reviews per request
              </span>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={() => onSubmitText(reviews)}
            disabled={count === 0 || count > MAX_REVIEWS || disabled}
          >
            Analyse reviews
          </button>
        </div>
      </div>

      {/* OR divider */}
      <div
        className="flex items-center gap-4"
        style={{ color: "var(--ink-faint)" }}
      >
        <div className="flex-1 h-px" style={{ background: "var(--rule)" }} />
        <span className="mono-label">or</span>
        <div className="flex-1 h-px" style={{ background: "var(--rule)" }} />
      </div>

      {/* CSV / XLSX upload */}
      <div
        className="flex flex-col items-center gap-3 py-6 px-4 rounded-sm"
        style={{ border: "2px dashed var(--rule)" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={disabled ? undefined : handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV or XLSX file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
        />

        {file ? (
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-small)",
              }}
            >
              {file.name}
            </span>
            <span className="mono-label">{formatSize(file.size)}</span>
            <button
              className="btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <span
              style={{
                fontFamily: "var(--font-text)",
                color: "var(--ink-soft)",
                fontStyle: "italic",
              }}
            >
              Upload a CSV or XLSX with a &ldquo;review&rdquo; or
              &ldquo;text&rdquo; column
            </span>
            <span className="mono-label">
              .csv / .xlsx — up to {MAX_FILE_MB} MB
            </span>
          </>
        )}
      </div>

      {fileError && (
        <p
          className="m-0 text-xs"
          style={{
            color: "var(--stamp-red)",
            fontFamily: "var(--font-mono)",
          }}
          role="alert"
        >
          {fileError}
        </p>
      )}

      {file && (
        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={() => onSubmitFile(file)}
            disabled={disabled}
          >
            Analyse file
          </button>
        </div>
      )}
    </div>
  );
}
