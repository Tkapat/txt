import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { csvExtractor } from "@/backend/extractors/csv";
import { docxExtractor } from "@/backend/extractors/docx";
import { pdfExtractor } from "@/backend/extractors/pdf";
import { txtExtractor } from "@/backend/extractors/txt";
import { xlsxExtractor } from "@/backend/extractors/xlsx";
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

  it("keeps commas in an unquoted single-column file", async () => {
    const units = await csvExtractor.extract(
      Buffer.from("review\nGreat product, works well.\n"),
    );
    expect(units[0].text).toBe("Great product, works well.");
  });

  it("rejects an Excel workbook renamed to .csv", async () => {
    await expect(
      csvExtractor.extract(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])),
    ).rejects.toMatchObject({ code: "unsupported_type", status: 415 });
  });

  it("handles a single review column with a UTF-8 BOM", async () => {
    const units = await csvExtractor.extract(
      Buffer.from('\uFEFFreview\n"Great product, works well."\n'),
    );
    expect(units).toHaveLength(1);
    expect(units[0].text).toBe("Great product, works well.");
  });

  it("handles uppercase headers and a sep= prefix", async () => {
    const units = await csvExtractor.extract(
      Buffer.from('sep=;\n"Review";Rating\n"Solid, does the job.";4\n'),
    );
    expect(units[0]).toMatchObject({ text: "Solid, does the job.", meta: { rating: 4 } });
  });

  it("handles a sep=, prefix followed by a single column", async () => {
    const units = await csvExtractor.extract(
      Buffer.from("sep=,\nreview\nWorks fine.\n"),
    );
    expect(units[0]).toMatchObject({ id: "1", text: "Works fine." });
  });

  it("ignores zero-width characters in the header", async () => {
    const units = await csvExtractor.extract(
      Buffer.from("\u200Breview\u200B\nWorks fine.\n"),
    );
    expect(units[0].text).toBe("Works fine.");
  });

  it("handles UTF-16LE CSVs", async () => {
    const source = Buffer.from("\uFEFFreview\r\nNice and easy.\r\n", "utf16le");
    const units = await csvExtractor.extract(source);
    expect(units[0].text).toBe("Nice and easy.");
  });

  it("rejects a CSV without a text column", async () => {
    await expect(
      csvExtractor.extract(Buffer.from("foo,bar\n1,2\n")),
    ).rejects.toMatchObject({ code: "no_text_column", status: 422 });
  });
});

describe("xlsx extractor", () => {
  it("finds the review sheet, skips preamble rows and maps ratings", async () => {
    const units = await xlsxExtractor.extract(
      await fixture("sample.xlsx"),
    );
    expect(units).toHaveLength(3);
    expect(units[0]).toMatchObject({
      id: "1",
      text: "Bought it twice, still love it.",
      meta: { rating: 5 },
    });
    expect(units[1]).toMatchObject({ text: "Broke after a week.", meta: { rating: 2 } });
    expect(units[2]).toMatchObject({ text: "Fine.", meta: { rating: 3 } });
  });

  it("rejects legacy .xls binaries", async () => {
    await expect(
      xlsxExtractor.extract(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1])),
    ).rejects.toMatchObject({ code: "unsupported_type", status: 415 });
  });

  it("rejects a file that is not a spreadsheet", async () => {
    await expect(
      xlsxExtractor.extract(Buffer.from("review\nnot a workbook\n")),
    ).rejects.toMatchObject({ code: "bad_request", status: 400 });
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

  it("picks xlsx for review uploads but not for text detection", () => {
    const file = {
      name: "reviews.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 10,
    };
    expect(pickExtractor(file).id).toBe("xlsx");
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
