/**
 * Chunk-panel visibility decision — extracted pure so the collapse bug is
 * pinned by tests. The panel must NEVER unmount because the async chunk
 * computation failed: open + error still renders (the error is shown).
 */
export const CHUNK_PANEL_ERROR = "Chunking failed — the tokenizer couldn't load. Try again.";

export function chunkPanelVisible(
  open: boolean,
  hasChunks: boolean,
  loading: boolean,
  error: boolean,
): boolean {
  return open && (hasChunks || loading || error);
}
