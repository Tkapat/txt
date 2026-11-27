import Papa from "papaparse";
import { ApiError } from "@/backend/http/errors";
import {
  noTextColumn,
  normalizeHeader,
  pickTextColumn,
  toUnits,
} from "./tabular";
import type { Extractor } from "./types";

function decode(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function isWorkbook(buffer: Buffer): boolean {
  const zip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const ole = buffer[0] === 0xd0 && buffer[1] === 0xcf;
  return zip || ole;
}

function normalizeCsv(source: string): string {
  const lines = source.split(/\r\n|\r|\n/);
  const start = lines.findIndex((line) => line.trim() !== "");
  if (start >= 0 && /^sep=./i.test(lines[start].trim())) lines.splice(start, 1);
  return lines.join("\n");
}

export const csvExtractor: Extractor = {
  id: "csv",
  accepts: (file) =>
    /\.csv$/i.test(file.name) || file.mime === "text/csv",
  async extract(buffer) {
    if (isWorkbook(buffer)) {
      throw new ApiError(
        "unsupported_type",
        "That looks like an Excel workbook. Upload the .xlsx file instead.",
        415,
      );
    }
    const { data, meta } = Papa.parse<Record<string, string>>(
      normalizeCsv(decode(buffer)),
      {
        header: true,
        skipEmptyLines: true,
        transformHeader: normalizeHeader,
      },
    );
    const fields = meta.fields ?? [];
    const column = pickTextColumn(fields);
    if (!column) throw noTextColumn(fields);
    return toUnits(
      data.map((row) => {
        const extra = (row as Record<string, unknown>).__parsed_extra;
        const parts =
          fields.length === 1 && Array.isArray(extra)
            ? [row[column], ...(extra as string[])]
            : [row[column]];
        return {
          text: parts.join(","),
          rating: Number(row.rating) || undefined,
        };
      }),
    );
  },
};
