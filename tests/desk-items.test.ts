import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESK_ITEMS } from "@/frontend/lib/desk-items";

describe("desk art config", () => {
  const stickers = DESK_ITEMS.filter((item) => item.kind === "sticker");
  const sketches = DESK_ITEMS.filter((item) => item.kind === "sketch");

  it("stays within the 7 sticker / 3 sketch budget", () => {
    expect(stickers.length).toBeLessThanOrEqual(7);
    expect(sketches.length).toBeLessThanOrEqual(3);
  });

  it("tucks stickers at most 30% and sketches at most 40% under the sheet", () => {
    for (const item of DESK_ITEMS) {
      const limit = item.kind === "sticker" ? 0.3 : 0.4;
      expect(item.tuck, `${item.id} tuck`).toBeLessThanOrEqual(item.w * limit);
    }
  });

  it("uses valid sides, tiers and a gentle rotation", () => {
    for (const item of DESK_ITEMS) {
      expect(["l", "r"]).toContain(item.side);
      expect(["m", "l"]).toContain(item.tier);
      expect(Math.abs(item.rot), `${item.id} rotation`).toBeLessThanOrEqual(9);
      expect(item.top).toBeGreaterThanOrEqual(0);
      expect(item.top).toBeLessThanOrEqual(100);
    }
  });

  it("ships every referenced asset", () => {
    for (const item of DESK_ITEMS) {
      const file = path.join(process.cwd(), "public", item.src);
      expect(existsSync(file), `${item.id} -> ${item.src}`).toBe(true);
    }
  });

  it("uses unique item ids", () => {
    expect(new Set(DESK_ITEMS.map((item) => item.id)).size).toBe(
      DESK_ITEMS.length,
    );
  });
});
