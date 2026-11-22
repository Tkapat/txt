import { NextRequest } from "next/server";
import type { DocumentResult } from "@/shared/types";
import { MAX_FILE_MB, MAX_TEXT_CHARS } from "@/shared/constants";
import { RATE_LIMIT } from "@/backend/config";
import { ApiError } from "@/backend/http/errors";
import { handle } from "@/backend/http/handler";
import { enforceRateLimit } from "@/backend/http/rateLimit";
import { pickDocumentExtractor } from "@/backend/extractors/registry";
import { detectText } from "@/backend/pipeline/detectText";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handle(async () => {
    enforceRateLimit(req, RATE_LIMIT.file.limit, RATE_LIMIT.file.windowMs);
    const form = await req.formData().catch(() => {
      throw new ApiError("bad_request", "Invalid multipart body.", 400);
    });
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(
        "bad_request",
        "Attach a file in the 'file' field.",
        400,
      );
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      throw new ApiError(
        "too_large",
        `Max file size is ${MAX_FILE_MB} MB.`,
        413,
      );
    }

    const info = { name: file.name, mime: file.type, size: file.size };
    const units = await pickDocumentExtractor(info).extract(
      Buffer.from(await file.arrayBuffer()),
    );
    const extracted = units.map((unit) => unit.text).join("\n\n");
    const truncated = extracted.length > MAX_TEXT_CHARS;
    const text = extracted.slice(0, MAX_TEXT_CHARS);

    const result = (await detectText(text, "document")) as DocumentResult;
    if (truncated && !result.warnings.includes("truncated")) {
      result.warnings.push("truncated");
    }
    return {
      ...result,
      source: { fileName: file.name, chars: text.length },
    };
  });
}
