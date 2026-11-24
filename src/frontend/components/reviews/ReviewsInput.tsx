"use client";

import { useRef, useState, type KeyboardEvent, type DragEvent } from "react";
import { MAX_REVIEWS, MAX_FILE_MB } from "@/shared/constants";
import type { ReviewInput } from "@/shared/types";
import { formatSize } from "@/frontend/lib/format";

interface ReviewsInputProps {
  onSubmitText: (reviews: ReviewInput[]) => void;
  onSubmitCsv: (file: File) => void;
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
  onSubmitCsv,
  disabled = false,
}: ReviewsInputProps) {
  const [text, setText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
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

  function handleCsvSelect(file: File) {
    if (!/\.csv$/i.test(file.name)) {
      setCsvError("Please choose a .csv file.");
      setCsvFile(null);
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setCsvError(`File is larger than ${MAX_FILE_MB} MB.`);
      setCsvFile(null);
      return;
    }
    setCsvError(null);
    setCsvFile(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleCsvSelect(file);
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

      {/* CSV upload */}
      <div
        className="flex flex-col items-center gap-3 py-6 px-4 rounded-sm"
        style={{ border: "2px dashed var(--rule)" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={disabled ? undefined : handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV file"
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
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCsvSelect(file);
          }}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
        />

        {csvFile ? (
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-small)",
              }}
            >
              {csvFile.name}
            </span>
            <span className="mono-label">{formatSize(csvFile.size)}</span>
            <button
              className="btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setCsvFile(null);
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
              Upload a CSV with a &ldquo;review&rdquo; or &ldquo;text&rdquo;
              column
            </span>
            <span className="mono-label">.csv — up to {MAX_FILE_MB} MB</span>
          </>
        )}
      </div>

      {csvError && (
        <p
          className="m-0 text-xs"
          style={{
            color: "var(--stamp-red)",
            fontFamily: "var(--font-mono)",
          }}
          role="alert"
        >
          {csvError}
        </p>
      )}

      {csvFile && (
        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={() => onSubmitCsv(csvFile)}
            disabled={disabled}
          >
            Analyse CSV
          </button>
        </div>
      )}
    </div>
  );
}
