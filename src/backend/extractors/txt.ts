import type { Extractor } from "./types";

export const txtExtractor: Extractor = {
  id: "txt",
  accepts: (file) =>
    /\.(txt|md)$/i.test(file.name) || file.mime.startsWith("text/plain"),
  async extract(buffer) {
    return [{ id: "doc", text: buffer.toString("utf8").replace(/^\uFEFF/, "") }];
  },
};
