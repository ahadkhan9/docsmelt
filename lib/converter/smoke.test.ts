/**
 * Real-engine smoke test: the actual @firecrawl/anydoc-wasm binary converts
 * the forged samples in samples/. Proves the engine contract the whole
 * worker layer wraps (sync calls, detection chain, CSV naming).
 *
 * Skipped automatically if the web-target glue can't run under Node
 * (it normally can — no DOM references at module scope).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

type Anydoc = typeof import("@firecrawl/anydoc-wasm");

let anydoc: Anydoc | null = null;

const wasmPath = path.join(
  process.cwd(),
  "node_modules/@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm",
);

beforeAll(async () => {
  try {
    anydoc = await import("@firecrawl/anydoc-wasm");
    await anydoc.default({ module_or_path: readFileSync(wasmPath) });
  } catch (error) {
    console.warn("anydoc-wasm not runnable under Node — smoke test skipped:", error);
    anydoc = null;
  }
}, 60_000);

const sample = (name: string): Uint8Array => {
  const file = path.join(process.cwd(), "samples", name);
  if (!existsSync(file)) throw new Error(`missing sample: ${file} — run node scripts/make-samples.mjs`);
  return new Uint8Array(readFileSync(file));
};

const detect = (name: string) => {
  const bytes = sample(name);
  const format = anydoc!.formatFromBytes(bytes) ?? anydoc!.formatFromPath(name);
  return { bytes, format };
};

/** Runtime skip — evaluated after beforeAll has had its chance. */
const engineTest = (name: string, fn: () => void) =>
  it(name, (ctx) => {
    if (!anydoc) ctx.skip();
    else fn();
  });

describe("anydoc-wasm real conversion", () => {
  engineTest("docx → markdown with detected format", () => {
    const { bytes, format } = detect("sample.docx");
    expect(format).toBe("docx");
    const md = anydoc!.toMarkdownBytes(bytes, format);
    expect(md).toContain("Smelted sample");
  });

  engineTest("xlsx → GFM table", () => {
    const { bytes, format } = detect("sample.xlsx");
    expect(format).toBe("xlsx");
    const md = anydoc!.toMarkdownBytes(bytes, format);
    expect(md).toContain("Iron");
    expect(md).toContain("1538");
  });

  engineTest("csv requires the explicit format name", () => {
    const bytes = sample("sample.csv");
    expect(anydoc!.formatFromBytes(bytes)).toBeUndefined(); // no signature
    expect(anydoc!.formatFromPath("sample.csv")).toBe("csv");
    const md = anydoc!.toMarkdownBytes(bytes, "csv");
    expect(md).toContain("Iron");
    expect(md).toContain("Gold");
  });

  engineTest("rtf converts", () => {
    const { bytes, format } = detect("sample.rtf");
    expect(format).toBe("rtf");
    expect(anydoc!.toMarkdownBytes(bytes, format)).toContain("bold");
  });

  engineTest("epub converts", () => {
    const { bytes, format } = detect("sample.epub");
    expect(format).toBe("epub");
    expect(anydoc!.toMarkdownBytes(bytes, format)).toContain("Smelted chapter");
  });

  engineTest("hand-forged text pdf converts", () => {
    const { bytes, format } = detect("sample.pdf");
    expect(format).toBe("pdf");
    expect(anydoc!.toMarkdownBytes(bytes, format)).toContain("Smelted sample PDF");
  });
});
