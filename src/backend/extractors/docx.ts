import mammoth from "mammoth";
import type { Extractor } from "./types";

export const docxExtractor: Extractor = {
  id: "docx",
  accepts: (file) => /\.docx$/i.test(file.name),
  async extract(buffer) {
    const { value } = await mammoth.extractRawText({ buffer });
    return [{ id: "doc", text: value }];
  },
};
