import { NextRequest } from "next/server";
import { z } from "zod";
import { MAX_TEXT_CHARS } from "@/shared/constants";
import { RATE_LIMIT } from "@/backend/config";
import { ApiError } from "@/backend/http/errors";
import { handle } from "@/backend/http/handler";
import { enforceRateLimit } from "@/backend/http/rateLimit";
import { detectText } from "@/backend/pipeline/detectText";

export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1),
  model: z.enum(["review", "document"]).optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    enforceRateLimit(req, RATE_LIMIT.text.limit, RATE_LIMIT.text.windowMs);
    const body = Body.parse(
      await req
        .json()
        .catch(() => {
          throw new ApiError("bad_request", "Invalid JSON body.", 400);
        }),
    );
    if (body.text.length > MAX_TEXT_CHARS) {
      throw new ApiError(
        "too_large",
        `Max text length is ${MAX_TEXT_CHARS} characters.`,
        413,
      );
    }
    return detectText(body.text, body.model);
  });
}
