/// <reference lib="webworker" />
/**
 * The converter worker — a dumb executor. No queue, no state beyond the
 * wasm instance. All logic (queue, cancel, memory guard) lives in pool.ts.
 * This file never runs on the main thread.
 */
import init, {
  formatFromBytes,
  formatFromPath,
  toDocument,
  toMarkdownBytes,
} from "@firecrawl/anydoc-wasm";
import type {
  ConvertErrorCode,
  Document,
  EngineFormat,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

let ready: Promise<void> | null = null;
let sharedModule: WebAssembly.Module | null = null;

/** init() accepts { module_or_path } — a compiled Module skips compilation.
 *  Fallback (no module posted): the worker fetches + compiles itself. */
const ensureReady = (): Promise<void> => {
  ready ??= (sharedModule
    ? init({ module_or_path: sharedModule })
    : init()
  ).then(() => undefined);
  return ready;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "module":
        sharedModule = msg.module;
        await ensureReady();
        postMessage({ type: "ready", jobId: msg.jobId } satisfies WorkerResponse);
        break;

      case "detect": {
        await ensureReady();
        // Detection chain mirrors the demo page: bytes, then extension.
        postMessage({
          type: "detected",
          jobId: msg.jobId,
          format: formatFromBytes(msg.bytes) ?? formatFromPath(msg.name),
        } satisfies WorkerResponse);
        break;
      }

      case "convert": {
        await ensureReady();
        const { jobId, name, bytes, format, wantDocument } = msg;
        try {
          // AnyFormat (superset) → the engine's narrower Format union.
          const detected = (format ?? formatFromBytes(bytes) ?? formatFromPath(name)) as
            | EngineFormat
            | undefined;
          const result = wantDocument
            ? toDocument(bytes, detected)
            : toMarkdownBytes(bytes, detected);

          // Assets are app-owned Uint8Arrays — transfer them zero-copy.
          // Never transfer views over wasm linear memory — engines refuse.
          const transfer: Transferable[] = [];
          if (wantDocument) {
            for (const asset of (result as Document).assets) transfer.push(asset.data.buffer);
          }
          postMessage(
            { type: "result", jobId, ok: true, format: detected, result } satisfies WorkerResponse,
            transfer,
          );
        } catch (error) {
          postMessage({
            type: "result",
            jobId,
            ok: false,
            code: ((error as { code?: string }).code as ConvertErrorCode | "engine" | undefined) ?? "engine",
            message: error instanceof Error ? error.message : String(error),
          } satisfies WorkerResponse);
        }
        break;
      }

      case "ping":
        postMessage({ type: "pong", jobId: msg.jobId } satisfies WorkerResponse);
        break;
    }
  } catch (error) {
    // init failure / DataCloneError / anything outside a job → poison.
    // The main thread will terminate and respawn this worker.
    postMessage({ type: "fatal", jobId: msg.jobId, message: String(error) });
  }
};
