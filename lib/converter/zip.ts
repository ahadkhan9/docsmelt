/**
 * Markdown + embedded assets → .zip download.
 * `toDocument` returns assets (id, mediaType, data) — embedded images render
 * as alt text in the markdown; the zip restores them as files.
 */
import JSZip from "jszip";
import type { Asset } from "./protocol";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "video/mp4": "mp4",
};

export const stemOf = (name: string) => name.replace(/\.[^.]+$/, "") || "document";

export async function zipDocument(
  name: string,
  markdown: string,
  doc: { assets: Asset[] },
): Promise<Blob> {
  const zip = new JSZip();
  const stem = stemOf(name);
  zip.file(`${stem}.md`, markdown);
  for (const asset of doc.assets) {
    const ext = EXT_BY_MIME[asset.mediaType] ?? "bin";
    zip.file(`assets/${asset.id}.${ext}`, asset.data);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
