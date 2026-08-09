/// <reference lib="webworker" />
/**
 * One-shot chunking worker — the pure chunk function off the main thread
 * for large documents. No wasm, no converter pool, no protocol changes:
 * `{type:'chunk', jobId, markdown, options}` → `{type:'chunks', jobId,
 * chunks, encoding}` (or `chunk-error`). Terminated by the caller after
 * one job.
 *
 * The message wiring is guarded so the handler is importable and
 * unit-testable under Node (no `self` there).
 */
import { chunkMarkdown, type ChunkOptions, type RagChunk } from "./chunk";
import { loadTokenizer } from "./tokenizer";

export async function handleChunkRequest(
  markdown: string,
  options: ChunkOptions,
): Promise<{ chunks: RagChunk[]; encoding: string }> {
  const tokenizer = await loadTokenizer();
  return { chunks: chunkMarkdown(markdown, options, tokenizer), encoding: tokenizer.encoding };
}

declare const self: { postMessage(msg: unknown): void; onmessage: ((e: MessageEvent) => void) | null };

if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  self.onmessage = async (event: MessageEvent) => {
    const msg = event.data as { type?: string; jobId?: number; markdown?: string; options?: ChunkOptions };
    if (msg?.type !== "chunk") return;
    try {
      const result = await handleChunkRequest(msg.markdown ?? "", msg.options ?? { targetTokens: 512 });
      self.postMessage({ type: "chunks", jobId: msg.jobId, ...result });
    } catch (error) {
      self.postMessage({
        type: "chunk-error",
        jobId: msg.jobId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
