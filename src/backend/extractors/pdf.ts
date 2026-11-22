import { extractText, getDocumentProxy } from "unpdf";
import { ApiError } from "@/backend/http/errors";
import type { Extractor } from "./types";

export const pdfExtractor: Extractor = {
  id: "pdf",
  accepts: (file) =>
    /\.pdf$/i.test(file.name) || file.mime === "application/pdf",
  async extract(buffer) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    try {
      const { text } = await extractText(pdf, { mergePages: true });
      if (text.replace(/\s/g, "").length < 200) {
        throw new ApiError(
          "scanned_pdf",
          "This PDF has no selectable text (scanned?). OCR is not supported.",
          422,
        );
      }
      return [{ id: "doc", text }];
    } finally {
      await pdf.loadingTask.destroy();
    }
  },
};
