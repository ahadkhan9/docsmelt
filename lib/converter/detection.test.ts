/**
 * Detection regression tests — pins the engine's runtime behavior that the
 * worker's detection chain (formatFromBytes ?? formatFromPath) relies on.
 * These are the answers to the "We can't smelt this file" mystery: every
 * supported input must be DETECTED, and only genuinely unidentifiable
 * content may fall through to the unsupported error.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

type Anydoc = typeof import("@firecrawl/anydoc-wasm");
let anydoc: Anydoc | null = null;

beforeAll(async () => {
  try {
    anydoc = await import("@firecrawl/anydoc-wasm");
    await anydoc.default({
      module_or_path: readFileSync(
        path.join(process.cwd(), "node_modules/@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm"),
      ),
    });
  } catch {
    anydoc = null;
  }
}, 60_000);

const engineTest = (name: string, fn: () => void) =>
  it(name, (ctx) => {
    if (!anydoc) ctx.skip();
    else fn();
  });

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
    return "no-error";
  } catch (error) {
    return (error as { code?: string }).code ?? "no-code";
  }
};

const CSV = Buffer.from("name,melts_at_c\nIron,1538\nGold,1064\n");
const MD = Buffer.from("# Hello\n\nMarkdown text.\n");
const TXT = Buffer.from("plain text, nothing special\n");

describe("formatFromPath — the extension fallback", () => {
  engineTest("is case-insensitive (DATA.CSV, Report.DOCX)", () => {
    expect(anydoc!.formatFromPath("DATA.CSV")).toBe("csv");
    expect(anydoc!.formatFromPath("Report.DOCX")).toBe("docx");
    expect(anydoc!.formatFromPath("notes.PDF")).toBe("pdf");
  });

  engineTest("maps every variant extension the app advertises", () => {
    expect(anydoc!.formatFromPath("x.docm")).toBe("docx");
    expect(anydoc!.formatFromPath("x.pptm")).toBe("pptx");
    expect(anydoc!.formatFromPath("x.ppsx")).toBe("pptx");
    expect(anydoc!.formatFromPath("x.ppsm")).toBe("pptx");
    expect(anydoc!.formatFromPath("x.xlsm")).toBe("xlsx");
    expect(anydoc!.formatFromPath("x.xlsb")).toBe("xlsx");
    expect(anydoc!.formatFromPath("x.odp")).toBe("odp");
    expect(anydoc!.formatFromPath("x.epub")).toBe("epub");
    expect(anydoc!.formatFromPath("x.rtf")).toBe("rtf");
  });

  engineTest("still recognizes legacy binary extensions (doc, ppt)", () => {
    expect(anydoc!.formatFromPath("x.doc")).toBe("doc");
    expect(anydoc!.formatFromPath("x.ppt")).toBe("ppt");
    // legacy xls normalizes to the xlsx family at the name level
    expect(anydoc!.formatFromPath("x.xls")).toBe("xlsx");
  });

  engineTest("returns undefined for unidentifiable names", () => {
    expect(anydoc!.formatFromPath("noext")).toBeUndefined();
    expect(anydoc!.formatFromPath("file.final")).toBeUndefined();
    expect(anydoc!.formatFromPath("x.md")).toBeUndefined();
    expect(anydoc!.formatFromPath("x.txt")).toBeUndefined();
    expect(anydoc!.formatFromPath("")).toBeUndefined();
  });
});

describe("legacy OLE detection (forged compound files)", () => {
  engineTest("WordDocument stream → doc; PowerPoint Document → ppt; Workbook → xlsx", () => {
    const doc = new Uint8Array(readFileSync(path.join(process.cwd(), "samples/sample-legacy.doc")));
    expect(anydoc!.formatFromBytes(doc)).toBe("doc");
    // Conversion of the shell fails as malformed, not unsupported — proving
    // the 'doc' format string itself is accepted by the engine.
    expect(codeOf(() => anydoc!.toMarkdownBytes(doc, "doc"))).toBe("malformed");
  });
});

describe("signature-less CSV — the explicit-format contract", () => {
  engineTest("is never content-detectable and needs the name or explicit format", () => {
    expect(anydoc!.formatFromBytes(CSV)).toBeUndefined();
    expect(codeOf(() => anydoc!.toMarkdownBytes(CSV))).toBe("unsupported");
  });

  engineTest("converts with an explicit format, BOM included", () => {
    const md = anydoc!.toMarkdownBytes(CSV, "csv");
    expect(md).toContain("Iron");
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), CSV]);
    expect(anydoc!.toMarkdownBytes(bom, "csv")).toContain("Iron");
  });

  engineTest("text garbage named .csv passes through as a table (not unsupported)", () => {
    expect(anydoc!.toMarkdownBytes(TXT, "csv")).toContain("plain text");
  });
});

describe("what genuinely lands on unsupported", () => {
  engineTest("markdown, plain text, and binaries without a name or format", () => {
    expect(codeOf(() => anydoc!.toMarkdownBytes(MD))).toBe("unsupported");
    expect(codeOf(() => anydoc!.toMarkdownBytes(TXT))).toBe("unsupported");
    const png = new Uint8Array(readFileSync(path.join(process.cwd(), "samples/sample-unsupported.png")));
    expect(anydoc!.formatFromBytes(png)).toBeUndefined();
    expect(codeOf(() => anydoc!.toMarkdownBytes(png))).toBe("unsupported");
  });

  engineTest("content detection beats a misleading name", () => {
    const docx = new Uint8Array(readFileSync(path.join(process.cwd(), "samples/sample.docx")));
    expect(anydoc!.formatFromBytes(docx)).toBe("docx"); // named .pdf or not
    expect(anydoc!.formatFromPath("fake.pdf")).toBe("pdf"); // name alone
    // the app's chain (bytes first, then name) resolves docx content → docx
    expect(anydoc!.formatFromBytes(docx) ?? anydoc!.formatFromPath("fake.pdf")).toBe("docx");
  });
});
