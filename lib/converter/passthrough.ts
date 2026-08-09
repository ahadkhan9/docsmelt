/**
 * Pass-through detection — files that are already Markdown (or plain text)
 * never touch the wasm engine. The engine converts *to* Markdown; these
 * files are already there, so the app presents them as-is: no smelt, no
 * worker, no engine download.
 *
 * Job-type choice: main-thread only. The worker is a wasm executor — a
 * pass-through has no wasm work, so routing it through the pool would force
 * the 6.5 MB engine to load for files that don't need it. The worker
 * protocol is untouched.
 */
import type { JobView } from "./useConverter";

export type PassThroughKind = "md" | "txt";

/** Extension → kind, case-insensitive. .md/.markdown are trusted by name
 *  (markdown is a text convention; rendering it as markdown is the correct
 *  interpretation even if the content is odd). .txt needs a content peek. */
export function detectPassThrough(name: string, bytes: Uint8Array): PassThroughKind | null {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "txt") return isMostlyText(bytes) ? "txt" : null;
  return null;
}

/**
 * Text vs binary heuristic — samples the first 8 KB, decodes as UTF-8
 * (replacement chars count against us), and requires ≥90% printable.
 * NULs and other C0 controls (except \n \r \t \f \b) count as binary.
 */
export function isMostlyText(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0) return true; // empty file is text
  const sample = bytes.subarray(0, Math.min(bytes.byteLength, 8192));
  const text = new TextDecoder("utf-8", { fatal: false }).decode(sample);
  if (text.length === 0) return true;
  let printable = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code === 0xfffd) continue; // decode failure → not printable
    if (code === 9 || code === 10 || code === 13 || code === 12 || code === 8) {
      printable += 1; // whitespace — text
      continue;
    }
    if (code < 32 || code === 127) continue; // other controls — binary-ish
    printable += 1;
  }
  return printable / text.length >= 0.9;
}

/** UTF-8 decode for pass-through content (non-fatal: replacement chars,
 *  BOM stripped — UTF-8-sig behaviour). */
export function decodeText(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** True when a job went through pass-through (no engine involved). */
export function isPassThrough(job: Pick<JobView, "kind">): boolean {
  return job.kind === "md" || job.kind === "txt";
}
