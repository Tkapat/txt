import { ApiError } from "@/backend/http/errors";
import type { ExtractedUnit } from "./types";

export const TEXT_COLUMNS = ["review", "text", "body", "content", "comment"];

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/[\uFEFF\u200B-\u200D]/g, "")
    .trim()
    .toLowerCase();
}

export function pickTextColumn(headers: string[]): string | undefined {
  return (
    headers.find((name) => TEXT_COLUMNS.includes(name)) ??
    headers.find((name) => TEXT_COLUMNS.some((key) => name.startsWith(key)))
  );
}

export function noTextColumn(headers: string[]): ApiError {
  const found = headers.filter(Boolean).slice(0, 5).join(", ") || "none";
  return new ApiError(
    "no_text_column",
    `Spreadsheet needs a column named review, text, body or content. Found: ${found}.`,
    422,
  );
}

export function toUnits(
  rows: { text: string; rating?: number }[],
): ExtractedUnit[] {
  return rows.slice(0, 5000).map((row, index) => ({
    id: String(index + 1),
    text: row.text.trim(),
    meta: { rating: Number(row.rating) || undefined },
  }));
}
