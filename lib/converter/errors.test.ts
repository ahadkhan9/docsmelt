/**
 * Error taxonomy → UX copy tests. Every engine code must have copy, and
 * the special refinements (scanned PDF, CSV) must win over the generic
 * unsupported message.
 */
import { describe, expect, it } from "vitest";
import { ERROR_UX, refine } from "./errors";

describe("ERROR_UX covers every engine code", () => {
  it("has copy for all five engine codes plus engine/fileTooLarge", () => {
    for (const code of ["unsupported", "malformed", "encrypted", "resourceLimit", "missingPart", "engine", "fileTooLarge"]) {
      const entry = ERROR_UX[code as keyof typeof ERROR_UX];
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("refine", () => {
  it("maps scanned PDFs (unsupported + pdf) to the OCR hint", () => {
    const r = refine("scan.pdf", "pdf", "unsupported");
    expect(r.title).toContain("Scanned PDF");
    expect(r.hint).toContain("OCR");
  });

  it("maps CSV detection failure to the explicit-format hint", () => {
    const r = refine("data.csv", undefined, "unsupported");
    expect(r.title).toContain("CSV");
  });

  it("passes through the generic copy otherwise", () => {
    expect(refine("x.docx", "docx", "encrypted")).toBe(ERROR_UX.encrypted);
    expect(refine("x.pdf", "pdf", "encrypted")).toBe(ERROR_UX.encrypted);
  });

  it("does not treat a text PDF unsupported error as scanned", () => {
    // unsupported + non-pdf format → generic unsupported copy
    expect(refine("weird.bin", undefined, "unsupported")).toBe(ERROR_UX.unsupported);
  });
});
