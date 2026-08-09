/**
 * Large-document preview thresholds + a text-segmenting helper.
 *
 * The app never renders a giant text node: every raw/chunk preview segment is
 * capped at MAX_TEXT_NODE_CHARS, and docs over HUGE_MD_CHARS are auto-chunked
 * (bounded chunk blocks) instead of being shown as a raw wall.
 */

/** Above this many markdown chars a doc is "huge" — auto-chunked preview,
 *  chunking locked on, raw tab truncated. */
export const HUGE_MD_CHARS = 1_000_000;

/** Huge-doc raw preview cap — honest note + .md download point beyond it. */
export const RAW_PREVIEW_CHARS = 250_000;

/** Hard ceiling per rendered text node (raw segments + chunk previews). */
export const MAX_TEXT_NODE_CHARS = 24_000;

/** Progressive chunk mounting: mount this many blocks, then +batch on scroll. */
export const CHUNK_MOUNT_BATCH = 150;

/** Sentinel rootMargin — mount the next batch ~600px before the last block. */
export const CHUNK_MOUNT_ROOT_MARGIN = "0px 0px 600px 0px";

/** Split text into ≤max segments (line-agnostic; used for bounded <pre>s). */
export function segmentText(text: string, max: number = MAX_TEXT_NODE_CHARS): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max));
  return out;
}
