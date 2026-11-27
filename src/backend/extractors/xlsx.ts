import readXlsxFile from "read-excel-file/node";
import { ApiError } from "@/backend/http/errors";
import {
  noTextColumn,
  normalizeHeader,
  pickTextColumn,
  toUnits,
} from "./tabular";
import type { Extractor } from "./types";

const XLSX_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-excel",
];

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

interface Table {
  rows: string[][];
  headers: string[];
  headerIndex: number;
  column: string | undefined;
}

function toTable(data: unknown[][]): Table | null {
  const rows = data
    .map((row) => row.map(cellText))
    .filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return null;
  for (let headerIndex = 0; headerIndex < Math.min(rows.length, 10); headerIndex += 1) {
    const headers = rows[headerIndex].map(normalizeHeader);
    const column = pickTextColumn(headers);
    if (column) return { rows, headers, headerIndex, column };
  }
  return {
    rows,
    headers: rows[0].map(normalizeHeader),
    headerIndex: 0,
    column: undefined,
  };
}

export const xlsxExtractor: Extractor = {
  id: "xlsx",
  accepts: (file) =>
    /\.(xlsx|xlsm|xls)$/i.test(file.name) || XLSX_MIMES.includes(file.mime),
  async extract(buffer) {
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf) {
      throw new ApiError(
        "unsupported_type",
        "Legacy .xls files are not supported. Save as .xlsx or CSV and upload again.",
        415,
      );
    }
    let sheets: Awaited<ReturnType<typeof readXlsxFile>>;
    try {
      sheets = await readXlsxFile(buffer, { trim: true });
    } catch {
      throw new ApiError(
        "bad_request",
        "Could not read that spreadsheet. Save it as .xlsx or CSV and try again.",
        400,
      );
    }
    const tables = sheets
      .map(({ data }) => toTable(data))
      .filter((table): table is Table => table !== null);
    const table = tables.find((candidate) => candidate.column) ?? tables[0];
    if (!table) {
      throw new ApiError("empty_text", "The spreadsheet has no rows.", 422);
    }
    if (!table.column) throw noTextColumn(table.headers);
    const columnIndex = table.headers.indexOf(table.column);
    const ratingIndex = table.headers.indexOf("rating");
    return toUnits(
      table.rows.slice(table.headerIndex + 1).map((row) => ({
        text: row[columnIndex] ?? "",
        rating:
          ratingIndex >= 0 && row[ratingIndex] !== ""
            ? Number(row[ratingIndex])
            : undefined,
      })),
    );
  },
};
