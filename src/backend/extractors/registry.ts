import { ApiError } from "@/backend/http/errors";
import type { Extractor, FileInfo } from "./types";
import { csvExtractor } from "./csv";
import { docxExtractor } from "./docx";
import { pdfExtractor } from "./pdf";
import { txtExtractor } from "./txt";
import { xlsxExtractor } from "./xlsx";

export const documentExtractors: Extractor[] = [
  txtExtractor,
  docxExtractor,
  pdfExtractor,
];

export const extractors: Extractor[] = [
  ...documentExtractors,
  csvExtractor,
  xlsxExtractor,
];

export function pickExtractor(file: FileInfo): Extractor {
  const extractor = extractors.find((candidate) => candidate.accepts(file));
  if (!extractor) {
    throw new ApiError(
      "unsupported_type",
      "Supported files: .txt, .md, .docx, .pdf, .csv, .xlsx",
      415,
    );
  }
  return extractor;
}

export function pickDocumentExtractor(file: FileInfo): Extractor {
  const extractor = documentExtractors.find((candidate) =>
    candidate.accepts(file),
  );
  if (!extractor) {
    throw new ApiError(
      "unsupported_type",
      "Supported files: .txt, .md, .docx, .pdf",
      415,
    );
  }
  return extractor;
}
