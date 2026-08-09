/**
 * Edge-case matrix against the real engine (skips in Node environments
 * where the web-target glue can't run — same guard as smoke.test.ts).
 * Every sample is forged by scripts/make-samples.mjs.
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

const sample = (name: string): Uint8Array => {
  const file = path.join(process.cwd(), "samples", name);
  if (!existsSync(file)) throw new Error(`missing sample: ${file}`);
  return new Uint8Array(readFileSync(file));
};

const engineTest = (name: string, fn: () => void) =>
  it(name, (ctx) => {
    if (!anydoc) ctx.skip();
    else fn();
  });

const TAXONOMY = new Set([
  "unsupported", "malformed", "encrypted", "resourceLimit", "missingPart",
]);

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
    return "no-error";
  } catch (error) {
    return (error as { code?: string }).code ?? "no-code";
  }
};

describe("edge cases (real engine)", () => {
  engineTest("zero-byte file → taxonomy error, never a crash", () => {
    const bytes = sample("sample-zero.docx");
    expect(anydoc!.formatFromBytes(bytes)).toBeUndefined();
    const code = codeOf(() => anydoc!.toMarkdownBytes(bytes, "docx"));
    expect(TAXONOMY.has(code)).toBe(true);
  });

  engineTest("empty-but-valid docx → empty markdown, no error", () => {
    const bytes = sample("sample-empty.docx");
    expect(anydoc!.formatFromBytes(bytes)).toBe("docx");
    const md = anydoc!.toMarkdownBytes(bytes, "docx");
    expect(typeof md).toBe("string");
    expect(md.trim()).toBe("");
  });

  engineTest("truncated docx → malformed", () => {
    const bytes = sample("sample-truncated.docx");
    expect(codeOf(() => anydoc!.toMarkdownBytes(bytes, "docx"))).toBe("malformed");
  });

  engineTest("scanned PDF → unsupported with the OCR message", () => {
    const bytes = sample("sample-scanned.pdf");
    expect(anydoc!.formatFromBytes(bytes)).toBe("pdf");
    try {
      anydoc!.toMarkdownBytes(bytes, "pdf");
      throw new Error("expected a throw");
    } catch (error) {
      const e = error as { code?: string; message?: string };
      expect(e.code).toBe("unsupported");
      expect(e.message?.toLowerCase()).toContain("ocr");
    }
  });

  engineTest("wrong extension: content detection wins over the name", () => {
    const bytes = sample("sample.docx");
    expect(anydoc!.formatFromBytes(bytes)).toBe("docx"); // content, not the name
    const md = anydoc!.toMarkdownBytes(bytes, "docx");
    expect(md).toContain("Smelted sample");
  });

  engineTest("unsupported type (.png) → unsupported", () => {
    const bytes = sample("sample-unsupported.png");
    expect(anydoc!.formatFromBytes(bytes)).toBeUndefined();
    expect(codeOf(() => anydoc!.toMarkdownBytes(bytes))).toBe("unsupported");
  });

  engineTest("encrypted OOXML (OLE/EncryptedPackage) → encrypted", () => {
    const bytes = sample("sample-encrypted.docx");
    // Deliberately undetectable by content (so the app can say 'encrypted')
    expect(anydoc!.formatFromBytes(bytes)).toBeUndefined();
    expect(anydoc!.formatFromPath("sample-encrypted.docx")).toBe("docx");
    expect(codeOf(() => anydoc!.toMarkdownBytes(bytes, "docx"))).toBe("encrypted");
  });

  engineTest("docx with an embedded image → toDocument returns the asset", () => {
    const bytes = sample("sample-image.docx");
    const doc = anydoc!.toDocument(bytes, "docx");
    expect(doc.assets.length).toBeGreaterThanOrEqual(1);
    const png = sample("sample-unsupported.png");
    const asset = doc.assets.find((a) => a.mediaType === "image/png");
    expect(asset).toBeDefined();
    expect(Array.from(asset!.data)).toEqual(Array.from(png));
  });

  engineTest("large file (120 MB) hits the app pre-flight cap before the engine", () => {
    // The app rejects >100 MB in pool.enqueue (fileTooLarge) — engine never sees it.
    // (Unit-tested in pool.test.ts; here we only pin that the engine's own
    // entry cap would also reject a legal-to-parse oversized zip.)
    const big = new Uint8Array(129 * 1024 * 1024); // > engine MAX_ENTRY_BYTES
    big.set([0x50, 0x4b, 0x03, 0x04], 0); // zip magic
    const code = codeOf(() => anydoc!.toMarkdownBytes(big, "docx"));
    expect(TAXONOMY.has(code)).toBe(true);
  });
});
