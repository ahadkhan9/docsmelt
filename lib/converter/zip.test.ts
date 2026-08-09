/**
 * Zip building — markdown + embedded assets, correct extensions.
 */
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildExportZip, zipDocument } from "./zip";

const DOC = {
  assets: [
    { id: 0, mediaType: "image/png", originPart: "word/media/image1.png", data: new Uint8Array([1, 2, 3]) },
    { id: 1, mediaType: "image/jpeg", originPart: "word/media/image2.jpg", data: new Uint8Array([4, 5]) },
    { id: 2, mediaType: "application/octet-stream", originPart: "x", data: new Uint8Array([6]) },
  ],
};

describe("zipDocument", () => {
  it("zips markdown with assets/{id}.{ext} and a .md at the root", async () => {
    const blob = await zipDocument("report.docx", "# Report\n\nHello.", DOC);
    // Node's jszip can't read a Blob directly — load from its bytes.
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file("report.md")).not.toBeNull();
    expect(zip.file("assets/0.png")).not.toBeNull();
    expect(zip.file("assets/1.jpg")).not.toBeNull();
    expect(zip.file("assets/2.bin")).not.toBeNull();
    const md = await zip.file("report.md")!.async("text");
    expect(md).toBe("# Report\n\nHello.");
    const png = await zip.file("assets/0.png")!.async("uint8array");
    expect(Array.from(png)).toEqual([1, 2, 3]);
  });
});

describe("buildExportZip (export all)", () => {
  it("packs one .md per file, assets under {stem}/assets/, and an index", async () => {
    const blob = await buildExportZip([
      { name: "report.docx", markdown: "# Report" },
      { name: "notes.pdf", markdown: "plain" },
      {
        name: "deck.pptx",
        markdown: "# Deck",
        assets: [
          { id: 0, mediaType: "image/png", originPart: "ppt/media/1.png", data: new Uint8Array([9]) },
        ],
      },
    ]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file("report.md")).not.toBeNull();
    expect(zip.file("notes.md")).not.toBeNull();
    expect(zip.file("deck.md")).not.toBeNull();
    expect(zip.file("deck/assets/0.png")).not.toBeNull();
    const index = await zip.file("_docsmelt-export.md")!.async("text");
    expect(index).toContain("`report.md`");
    expect(index).toContain("`deck.md` (+ 1 embedded asset)");
    expect(index).toContain("3 files");
  });

  it("empty export still yields a valid index-only archive", async () => {
    const blob = await buildExportZip([]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file("_docsmelt-export.md")).not.toBeNull();
    expect(zip.files["_docsmelt-export.md"]).toBeDefined();
  });
});
