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

export interface ExportEntry {
  /** File name as shown to the user (used for the .md stem). */
  name: string;
  markdown: string;
  /** Embedded assets, when the caller re-ran toDocument for this file. */
  assets?: Asset[];
}

/**
 * Export-all assembly: one .md per file, per-file assets under
 * `{stem}/assets/`, plus a small index file. Pure — the caller decides
 * which jobs supply assets (via a lazy toDocument pass).
 */
export async function buildExportZip(entries: ExportEntry[]): Promise<Blob> {
  const zip = new JSZip();
  for (const entry of entries) {
    const base = stemOf(entry.name);
    zip.file(`${base}.md`, entry.markdown);
    if (entry.assets && entry.assets.length > 0) {
      for (const asset of entry.assets) {
        const ext = EXT_BY_MIME[asset.mediaType] ?? "bin";
        zip.file(`${base}/assets/${asset.id}.${ext}`, asset.data);
      }
    }
  }
  const index = [
    "# docsmelt export",
    "",
    ...entries.map(
      (e) =>
        `- \`${stemOf(e.name)}.md\`${e.assets?.length ? ` (+ ${e.assets.length} embedded asset${e.assets.length === 1 ? "" : "s"})` : ""}`,
    ),
    "",
    `_${entries.length} file${entries.length === 1 ? "" : "s"} converted by docsmelt — everything in this archive was processed in your browser._`,
  ].join("\n");
  zip.file("_docsmelt-export.md", index);
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
