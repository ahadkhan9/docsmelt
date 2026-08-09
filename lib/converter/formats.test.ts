/**
 * Format identity system integrity — every supported format must have a
 * family (and thus a color + glyph), and the extension map must cover
 * the full engine format list.
 */
import { describe, expect, it } from "vitest";
import {
  EXT_TO_FORMAT,
  FAMILY_OF,
  FAMILY_TOKEN,
  formatFromFileName,
  supportsZip,
} from "./formats";
import type { AnyFormat } from "./protocol";

const ENGINE_FORMATS: AnyFormat[] = [
  "doc", "docx", "docm", "odt", "pdf",
  "ppt", "pps", "pot", "pptx", "pptm", "ppsx", "ppsm",
  "rtf", "epub",
  "xls", "xlsx", "xlsm", "xlsb", "ods", "odp", "csv",
];

describe("format identity system", () => {
  it("maps every engine format to a family", () => {
    for (const format of ENGINE_FORMATS) {
      expect(FAMILY_OF[format], format).toBeDefined();
      expect(FAMILY_TOKEN[FAMILY_OF[format]], format).toBeDefined();
    }
  });

  it("covers every engine format extension in EXT_TO_FORMAT", () => {
    for (const format of ENGINE_FORMATS) {
      expect(EXT_TO_FORMAT[format], format).toBe(format);
    }
  });

  it("has exactly five families with distinct tokens", () => {
    const families = new Set(Object.values(FAMILY_OF));
    expect(families.size).toBe(5);
    expect(new Set(Object.values(FAMILY_TOKEN)).size).toBe(5);
  });

  it("resolves formats from file names (extension fallback)", () => {
    expect(formatFromFileName("REPORT.DOCX")).toBe("docx");
    expect(formatFromFileName("notes.pdf")).toBe("pdf");
    expect(formatFromFileName("data.csv")).toBe("csv");
    expect(formatFromFileName("no-extension")).toBeUndefined();
    expect(formatFromFileName("archive.7z")).toBeUndefined();
  });

  it("only PDF lacks the zip-with-assets path", () => {
    expect(supportsZip("docx")).toBe(true);
    expect(supportsZip("epub")).toBe(true);
    expect(supportsZip("csv")).toBe(true);
    expect(supportsZip("pdf")).toBe(false);
    expect(supportsZip(undefined)).toBe(false);
  });
});
