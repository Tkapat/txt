import { NextRequest } from "next/server";
import { z } from "zod";
import { MAX_FILE_MB } from "@/shared/constants";
import { RATE_LIMIT } from "@/backend/config";
import { ApiError } from "@/backend/http/errors";
import { handle } from "@/backend/http/handler";
import { enforceRateLimit } from "@/backend/http/rateLimit";
import { pickExtractor } from "@/backend/extractors/registry";
import { detectReviews } from "@/backend/pipeline/detectReviews";

export const maxDuration = 60;

const Review = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  rating: z.number().finite().optional(),
});

const JsonBody = z.object({
  reviews: z.array(Review).min(1),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    enforceRateLimit(req, RATE_LIMIT.reviews.limit, RATE_LIMIT.reviews.windowMs);
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => {
        throw new ApiError("bad_request", "Invalid multipart body.", 400);
      });
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new ApiError(
          "bad_request",
          "Attach a CSV in the 'file' field.",
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
      const extractor = pickExtractor(info);
      if (extractor.id !== "csv") {
        throw new ApiError(
          "unsupported_type",
          "Reviews upload must be a .csv file.",
          415,
        );
      }
      const units = await extractor.extract(
        Buffer.from(await file.arrayBuffer()),
      );
      return detectReviews(
        units.map((unit) => ({
          id: unit.id,
          text: unit.text,
          rating:
            typeof unit.meta?.rating === "number"
              ? unit.meta.rating
              : undefined,
        })),
      );
    }

    const body = JsonBody.parse(
      await req
        .json()
        .catch(() => {
          throw new ApiError("bad_request", "Invalid JSON body.", 400);
        }),
    );
    return detectReviews(body.reviews);
  });
}
