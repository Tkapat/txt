import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { csvExtractor } from "@/backend/extractors/csv";
import { docxExtractor } from "@/backend/extractors/docx";
import { pdfExtractor } from "@/backend/extractors/pdf";
import { txtExtractor } from "@/backend/extractors/txt";
import {
  pickDocumentExtractor,
  pickExtractor,
} from "@/backend/extractors/registry";

const fixture = (name: string) =>
  readFile(path.join(process.cwd(), "tests/fixtures", name));

describe("txt extractor", () => {
  it("strips a UTF-8 BOM and keeps the text", async () => {
    const units = await txtExtractor.extract(await fixture("sample.txt"));
    expect(units).toHaveLength(1);
    expect(units[0].id).toBe("doc");
    expect(units[0].text.startsWith("Plain text sample")).toBe(true);
    expect(units[0].text).toContain("second line");
  });
});

describe("docx extractor", () => {
  it("extracts paragraphs from a real docx package", async () => {
    const units = await docxExtractor.extract(await fixture("sample.docx"));
    expect(units).toHaveLength(1);
    expect(units[0].text).toContain("DOCX sample heading");
    expect(units[0].text).toContain("extracted by mammoth");
  });
});

describe("pdf extractor", () => {
  it("extracts selectable text from a real pdf", async () => {
    const units = await pdfExtractor.extract(await fixture("sample.pdf"));
    expect(units).toHaveLength(1);
    expect(units[0].text).toContain("PDF sample");
    expect(units[0].text.replace(/\s/g, "").length).toBeGreaterThan(200);
  });
});

describe("csv extractor", () => {
  it("finds the review column and maps ratings", async () => {
    const units = await csvExtractor.extract(await fixture("sample.csv"));
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({
      id: "1",
      text: "This is the first review, with a comma.",
      meta: { rating: 5 },
    });
    expect(units[1]).toMatchObject({ id: "2", meta: { rating: 3 } });
  });

  it("rejects a CSV without a text column", async () => {
    await expect(
      csvExtractor.extract(Buffer.from("foo,bar\n1,2\n")),
    ).rejects.toMatchObject({ code: "no_text_column", status: 422 });
  });
});

describe("extractor registry", () => {
  it("picks csv only for review uploads", () => {
    const file = { name: "reviews.csv", mime: "text/csv", size: 10 };
    expect(pickExtractor(file).id).toBe("csv");
    expect(() => pickDocumentExtractor(file)).toThrowError(
      expect.objectContaining({ code: "unsupported_type", status: 415 }),
    );
  });

  it("rejects unsupported files", () => {
    expect(() =>
      pickExtractor({ name: "payload.exe", mime: "application/octet-stream", size: 10 }),
    ).toThrowError(
      expect.objectContaining({ code: "unsupported_type", status: 415 }),
    );
  });
});
