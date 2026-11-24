import type {
  ApiErrorBody,
  DocumentResult,
  ReviewInput,
  ReviewsReport,
  TextResult,
} from "@/shared/types";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(
      "network",
      "Could not reach the server. Check your connection.",
      0,
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(
      body?.error.code ?? "unknown",
      body?.error.message ?? "Something went wrong.",
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const form = (file: File): RequestInit => {
  const f = new FormData();
  f.append("file", file);
  return { method: "POST", body: f };
};

export const api = {
  detectText: (text: string, s?: AbortSignal) =>
    request<TextResult | DocumentResult>(
      "/api/detect/text",
      json({ text }),
      s,
    ),

  detectFile: (file: File, s?: AbortSignal) =>
    request<DocumentResult>("/api/detect/file", form(file), s),

  detectReviews: (reviews: ReviewInput[], s?: AbortSignal) =>
    request<ReviewsReport>(
      "/api/detect/reviews",
      json({ reviews }),
      s,
    ),

  detectReviewsCsv: (file: File, s?: AbortSignal) =>
    request<ReviewsReport>("/api/detect/reviews", form(file), s),
};
