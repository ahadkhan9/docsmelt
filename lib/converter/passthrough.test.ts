/**
 * Pass-through detection — Markdown and plain text must be caught
 * client-side (no engine), while everything else keeps flowing to the
 * engine's detection chain (and the unsupported path for the rest).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeText, detectPassThrough, isMostlyText } from "./passthrough";

const text = (s: string) => new TextEncoder().encode(s);
const PNG = new Uint8Array(
  readFileSync(path.join(process.cwd(), "samples/sample-unsupported.png")),
);
const BOM = (s: string) => new Uint8Array([0xef, 0xbb, 0xbf, ...text(s)]);

describe("detectPassThrough — markdown by name", () => {
  it("catches .md and .markdown, case-insensitively", () => {
    expect(detectPassThrough("notes.md", text("# Hi"))).toBe("md");
    expect(detectPassThrough("NOTES.MD", text("# Hi"))).toBe("md");
    expect(detectPassThrough("README.markdown", text("# Hi"))).toBe("md");
    expect(detectPassThrough("ReadMe.MarkDown", text("# Hi"))).toBe("md");
  });

  it("trusts the .md name even for odd content (markdown is a convention)", () => {
    expect(detectPassThrough("weird.md", PNG)).toBe("md");
  });
});

describe("detectPassThrough — .txt by content peek", () => {
  it("passes UTF-8 text, BOM included", () => {
    expect(detectPassThrough("notes.txt", text("plain notes\nsecond line"))).toBe("txt");
    expect(detectPassThrough("notes.txt", BOM("bommed text"))).toBe("txt");
    expect(detectPassThrough("notes.txt", text("accentué — naïve — 中文"))).toBe("txt");
  });

  it("passes empty files as text", () => {
    expect(detectPassThrough("empty.txt", new Uint8Array(0))).toBe("txt");
  });

  it("rejects binary content (images, NUL-heavy, control-heavy)", () => {
    expect(detectPassThrough("photo.txt", PNG)).toBeNull();
    expect(detectPassThrough("data.txt", new Uint8Array([0, 1, 2, 3, 4, 5]))).toBeNull();
    expect(
      detectPassThrough("data.txt", new Uint8Array(64).fill(0x01)),
    ).toBeNull(); // mostly C0 controls
  });
});

describe("detectPassThrough — everything else stays on the engine path", () => {
  it("returns null for office formats, CSV, and unknown names", () => {
    expect(detectPassThrough("report.docx", PNG)).toBeNull();
    expect(detectPassThrough("data.csv", text("a,b\n1,2"))).toBeNull(); // CSV → engine (tables!)
    expect(detectPassThrough("slide.pptx", PNG)).toBeNull();
    expect(detectPassThrough("noext", text("# Hi"))).toBeNull();
    expect(detectPassThrough("file.final", text("# Hi"))).toBeNull();
    expect(detectPassThrough("", text("# Hi"))).toBeNull();
  });

  it("leaves .png and .zip to the unsupported path", () => {
    expect(detectPassThrough("photo.png", PNG)).toBeNull();
    expect(detectPassThrough("bundle.zip", PNG)).toBeNull();
    expect(detectPassThrough("app.exe", PNG)).toBeNull();
  });
});

describe("isMostlyText heuristic", () => {
  it("true for plain and accented text", () => {
    expect(isMostlyText(text("hello world\nline two\t tabbed"))).toBe(true);
    expect(isMostlyText(BOM("naïve — 中文 — café"))).toBe(true);
  });

  it("false for binary payloads", () => {
    expect(isMostlyText(PNG)).toBe(false);
    expect(isMostlyText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBe(false);
    expect(isMostlyText(new Uint8Array(256).fill(0x00))).toBe(false);
  });
});

describe("decodeText", () => {
  it("decodes UTF-8 and strips a BOM", () => {
    expect(decodeText(text("# Hello"))).toBe("# Hello");
    expect(decodeText(BOM("# Hello"))).toBe("# Hello");
  });
});
