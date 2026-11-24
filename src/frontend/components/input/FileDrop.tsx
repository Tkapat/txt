"use client";

import { useRef, useState, type DragEvent } from "react";
import { MAX_FILE_MB } from "@/shared/constants";
import { formatSize } from "@/frontend/lib/format";

const OK_EXT = /\.(txt|md|docx|pdf)$/i;

export function validateFile(f: File): string | null {
  if (!OK_EXT.test(f.name))
    return "Please choose a .txt, .md, .docx or .pdf file.";
  if (f.size > MAX_FILE_MB * 1024 * 1024)
    return `File is larger than ${MAX_FILE_MB} MB.`;
  return null;
}

interface FileDropProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function FileDrop({ onFile, disabled = false }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    const err = validateFile(file);
    if (err) {
      setError(err);
      setSelected(null);
      return;
    }
    setError(null);
    setSelected(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSubmit() {
    if (selected) onFile(selected);
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-up delay-3">
      <div
        className="flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-sm transition-all"
        style={{
          border: `2px dashed ${dragging ? "var(--pen-blue)" : "var(--rule)"}`,
          background: dragging ? "rgba(43,74,122,0.04)" : "transparent",
          transform: dragging ? "rotate(1deg)" : "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload a file"
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
          accept=".txt,.md,.docx,.pdf"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
        />

        {selected ? (
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)" }}>
              {selected.name}
            </span>
            <span className="mono-label">{formatSize(selected.size)}</span>
            <button
              className="btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              aria-label="Remove file"
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
              Drop a file here, or click to choose
            </span>
            <span className="mono-label">
              .txt · .md · .docx · .pdf — up to {MAX_FILE_MB} MB
            </span>
          </>
        )}
      </div>

      {error && (
        <p
          className="m-0 text-xs"
          style={{ color: "var(--stamp-red)", fontFamily: "var(--font-mono)" }}
          role="alert"
        >
          {error}
        </p>
      )}

      {selected && (
        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={disabled}
          >
            Analyse file
          </button>
        </div>
      )}
    </div>
  );
}
