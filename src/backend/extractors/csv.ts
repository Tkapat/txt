import Papa from "papaparse";
import { ApiError } from "@/backend/http/errors";
import type { Extractor } from "./types";

export const csvExtractor: Extractor = {
  id: "csv",
  accepts: (file) =>
    /\.csv$/i.test(file.name) || file.mime === "text/csv",
  async extract(buffer) {
    const { data, meta } = Papa.parse<Record<string, string>>(
      buffer.toString("utf8"),
      { header: true, skipEmptyLines: true },
    );
    const column = (meta.fields ?? []).find((name) =>
      /^(review|text|body|content|comment)/i.test(name),
    );
    if (!column) {
      throw new ApiError(
        "no_text_column",
        "CSV needs a column named review, text, body or content.",
        422,
      );
    }
    return data.slice(0, 5000).map((row, index) => ({
      id: String(index + 1),
      text: (row[column] ?? "").trim(),
      meta: { rating: Number(row.rating) || undefined },
    }));
  },
};
