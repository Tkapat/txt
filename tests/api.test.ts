import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_FILE_MB, MAX_REVIEWS, MAX_TEXT_CHARS } from "@/shared/constants";
import { resetRateLimit } from "@/backend/http/rateLimit";
import { POST as postText } from "@/app/api/detect/text/route";
import { POST as postFile } from "@/app/api/detect/file/route";
import { POST as postReviews } from "@/app/api/detect/reviews/route";

const jsonRequest = (url: string, body: unknown, ip: string) =>
  new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  }) as NextRequest;

const formRequest = (url: string, file: File, ip: string) => {
  const form = new FormData();
  form.append("file", file);
  return new Request(url, {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: form,
  }) as NextRequest;
};

const errorBody = async (response: Response) =>
  (await response.json()) as { error: { code: string } };

describe("POST /api/detect/text", () => {
  beforeEach(() => resetRateLimit());

  it("rejects text over the character limit with 413", async () => {
    const response = await postText(
      jsonRequest(
        "http://localhost/api/detect/text",
        { text: "a".repeat(MAX_TEXT_CHARS + 1) },
        "text-too-large",
      ),
    );
    expect(response.status).toBe(413);
    expect((await errorBody(response)).error.code).toBe("too_large");
  });

  it("rejects text with no readable words with 422", async () => {
    const response = await postText(
      jsonRequest(
        "http://localhost/api/detect/text",
        { text: "!!! --- ???" },
        "text-empty",
      ),
    );
    expect(response.status).toBe(422);
    expect((await errorBody(response)).error.code).toBe("empty_text");
  });

  it("rejects malformed JSON with 400", async () => {
    const request = new Request("http://localhost/api/detect/text", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "text-bad-json",
      },
      body: "{",
    }) as NextRequest;
    const response = await postText(request);
    expect(response.status).toBe(400);
    expect((await errorBody(response)).error.code).toBe("bad_request");
  });
});

describe("POST /api/detect/file", () => {
  beforeEach(() => resetRateLimit());

  it("rejects files over the size limit with 413", async () => {
    const file = new File(
      [new Uint8Array(MAX_FILE_MB * 1024 * 1024 + 1)],
      "big.txt",
      { type: "text/plain" },
    );
    const response = await postFile(
      formRequest("http://localhost/api/detect/file", file, "file-too-large"),
    );
    expect(response.status).toBe(413);
    expect((await errorBody(response)).error.code).toBe("too_large");
  });

  it("rejects unsupported file types with 415", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "payload.exe", {
      type: "application/octet-stream",
    });
    const response = await postFile(
      formRequest("http://localhost/api/detect/file", file, "file-bad-type"),
    );
    expect(response.status).toBe(415);
    expect((await errorBody(response)).error.code).toBe("unsupported_type");
  });

  it("requires a file field", async () => {
    const request = new Request("http://localhost/api/detect/file", {
      method: "POST",
      headers: { "x-forwarded-for": "file-missing" },
      body: new FormData(),
    }) as NextRequest;
    const response = await postFile(request);
    expect(response.status).toBe(400);
    expect((await errorBody(response)).error.code).toBe("bad_request");
  });
});

describe("POST /api/detect/reviews", () => {
  beforeEach(() => resetRateLimit());

  it("rejects more than the maximum number of reviews with 413", async () => {
    const reviews = Array.from({ length: MAX_REVIEWS + 1 }, (_, index) => ({
      id: String(index + 1),
      text: "This review is long enough to be analyzed by the detector.",
    }));
    const response = await postReviews(
      jsonRequest(
        "http://localhost/api/detect/reviews",
        { reviews },
        "reviews-too-many",
      ),
    );
    expect(response.status).toBe(413);
    expect((await errorBody(response)).error.code).toBe("too_many");
  });

  it("rejects an empty review list with 400", async () => {
    const response = await postReviews(
      jsonRequest(
        "http://localhost/api/detect/reviews",
        { reviews: [] },
        "reviews-empty",
      ),
    );
    expect(response.status).toBe(400);
    expect((await errorBody(response)).error.code).toBe("bad_request");
  });

  it("rejects a CSV without a text column with 422", async () => {
    const file = new File([Buffer.from("foo,bar\n1,2\n")], "reviews.csv", {
      type: "text/csv",
    });
    const response = await postReviews(
      formRequest("http://localhost/api/detect/reviews", file, "reviews-csv"),
    );
    expect(response.status).toBe(422);
    expect((await errorBody(response)).error.code).toBe("no_text_column");
  });

  it("rejects a non-CSV upload with 415", async () => {
    const file = new File([Buffer.from("hello")], "notes.txt", {
      type: "text/plain",
    });
    const response = await postReviews(
      formRequest("http://localhost/api/detect/reviews", file, "reviews-txt"),
    );
    expect(response.status).toBe(415);
    expect((await errorBody(response)).error.code).toBe("unsupported_type");
  });
});
