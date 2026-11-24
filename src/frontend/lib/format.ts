import type { Verdict, Confidence, Warning } from "@/shared/types";

/** Percentage with 0 decimals, e.g. "72%" */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Percentage as a whole number, e.g. 72 */
export function pctNum(value: number): number {
  return Math.round(value * 100);
}

/** Human-readable verdict label */
export function verdictLabel(v: Verdict): string {
  switch (v) {
    case "likely_ai":
      return "Reads as likely AI-written";
    case "likely_human":
    case "uncertain":
      return "Reads as likely human-written";
  }
}

/** Short stamp text */
export function stampText(v: Verdict): string {
  switch (v) {
    case "likely_ai":
      return "Likely AI-written";
    case "likely_human":
    case "uncertain":
      return "Likely human-written";
  }
}

/** Confidence word */
export function confidenceLabel(c: Confidence): string {
  switch (c) {
    case "high":
      return "high confidence";
    case "medium":
      return "medium confidence";
    case "low":
      return "low confidence";
  }
}

/** Warning messages */
export function warningMessage(w: Warning): string | null {
  switch (w) {
    case "short_text":
      return "This text is short. Results are less reliable under about 40 words.";
    case "english_only":
      return "Detection works best on English text.";
    case "scanned_pdf":
      return "This PDF has no selectable text. OCR is not supported.";
    case "truncated":
      return "The document was trimmed to the character limit.";
    case "detector_not_proof":
      return null; // shown as the Disclaimer component
  }
}

/** Word count from plain text */
export function countWords(text: string): number {
  return (text.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) ?? []).length;
}

/** Character count */
export function countChars(text: string): number {
  return text.length;
}

/** Format file size */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
