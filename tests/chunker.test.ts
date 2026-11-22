import { describe, expect, it } from "vitest";
import { chunkText } from "@/backend/detector/chunker";

const words = (n: number) =>
  Array.from({ length: n }, (_, index) => `word${index}`).join(" ");

describe("chunkText", () => {
  it("returns offsets that slice back to the original text", () => {
    const text = words(500);
    const chunks = chunkText(text, 160, 120, 60);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].start).toBe(0);
    expect(chunks[chunks.length - 1].end).toBe(text.length);
    chunks.forEach((chunk, index) => {
      expect(chunk.index).toBe(index);
      expect(text.slice(chunk.start, chunk.end)).toBe(chunk.text);
      expect(chunk.text.split(/\s+/)).toHaveLength(
        index === chunks.length - 1 ? 140 : 160,
      );
    });
  });

  it("covers a short tail with overlap and stops when the tail is too small", () => {
    const text = words(200);
    const chunks = chunkText(text, 160, 120, 60);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].text.split(/\s+/)).toHaveLength(80);
    expect(chunks[chunks.length - 1].end).toBe(text.length);
  });

  it("keeps a single short chunk for short input", () => {
    const text = "  one   two\nthree\tfour  ";
    const chunks = chunkText(text, 160, 120, 60);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text.trim());
    expect(chunks[0].start).toBe(2);
    expect(chunks[0].end).toBe(text.trimEnd().length);
  });

  it("returns no chunks for whitespace-only input", () => {
    expect(chunkText("   \n\t  ")).toEqual([]);
  });
});
