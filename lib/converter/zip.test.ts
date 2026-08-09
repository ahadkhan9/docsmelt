/**
 * Zip building — markdown + embedded assets, correct extensions.
 */
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { zipDocument } from "./zip";

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
