import { ApiError } from "./errors";

const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

export function enforceRateLimit(
  req: Request,
  limit = 30,
  windowMs = 60_000,
): void {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > limit) {
    throw new ApiError(
      "rate_limited",
      "Too many requests. Please wait a minute.",
      429,
    );
  }
}

export function resetRateLimit(): void {
  hits.clear();
}
