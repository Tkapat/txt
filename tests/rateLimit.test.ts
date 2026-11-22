import { beforeEach, describe, expect, it } from "vitest";
import {
  enforceRateLimit,
  resetRateLimit,
} from "@/backend/http/rateLimit";

const request = (ip: string) =>
  new Request("http://localhost/api", {
    headers: { "x-forwarded-for": ip },
  });

describe("enforceRateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("allows requests up to the limit and rejects the next one", () => {
    expect(() => enforceRateLimit(request("1.2.3.4"), 2)).not.toThrow();
    expect(() => enforceRateLimit(request("1.2.3.4"), 2)).not.toThrow();
    expect(() => enforceRateLimit(request("1.2.3.4"), 2)).toThrowError(
      expect.objectContaining({ code: "rate_limited", status: 429 }),
    );
  });

  it("tracks each IP separately", () => {
    enforceRateLimit(request("1.2.3.4"), 1);
    expect(() => enforceRateLimit(request("5.6.7.8"), 1)).not.toThrow();
  });
});
