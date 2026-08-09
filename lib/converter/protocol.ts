/**
 * The worker protocol — the single contract shared by the main thread and
 * the converter worker. Hand-rolled (~60 lines), job-id based, so the pool
 * can grow to N workers without touching the worker file.
 *
 * Documented in docs/architecture.md §Protocol.
 */

export type AnyFormat =
  | "doc" | "docx" | "docm" | "odt" | "pdf"
  | "ppt" | "pps" | "pot" | "pptx" | "pptm" | "ppsx" | "ppsm"
  | "rtf" | "epub"
  | "xls" | "xlsx" | "xlsm" | "xlsb" | "ods" | "odp" | "csv";

/** Stable error codes published by the engine's `error.code` (wasm/src/error.rs). */
export type ConvertErrorCode =
  | "unsupported" | "malformed" | "encrypted" | "resourceLimit" | "missingPart";

export type JobId = number;

export type WorkerRequest =
  | { type: "module"; jobId: JobId; module: WebAssembly.Module }
  | { type: "detect"; jobId: JobId; name: string; bytes: Uint8Array }
  | { type: "convert"; jobId: JobId; name: string; bytes: Uint8Array;
      format?: AnyFormat; wantDocument: boolean }
  | { type: "ping"; jobId: JobId };

export type WorkerResponse =
  | { type: "ready"; jobId: JobId }
  | { type: "pong"; jobId: JobId }
  | { type: "detected"; jobId: JobId; format?: AnyFormat }
  | { type: "result"; jobId: JobId; ok: true; format?: AnyFormat;
      result: string | Document }
  | { type: "result"; jobId: JobId; ok: false;
      code: ConvertErrorCode | "engine"; message: string }
  | { type: "fatal"; jobId?: JobId; message: string };

/**
 * `toDocument` result shape (type-only, no runtime cost). Imported +
 * aliased locally: a bare `export type { Document } from "…"` re-export
 * does NOT bring the name into this file's scope, so bare `Document`
 * below would silently resolve to the DOM lib's Document instead.
 */
import type { Asset as EngineAsset, Document as EngineDocument } from "@firecrawl/anydoc-wasm";

export type Document = EngineDocument;
export type Asset = EngineAsset;
/** The engine's own (12-entry) format union — narrower than AnyFormat. */
export type EngineFormat = import("@firecrawl/anydoc-wasm").Format;

/** Runtime contract validators (tested in protocol.test.ts). */
export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.jobId !== "number") return false;
  switch (v.type) {
    case "module":
      return v.module instanceof WebAssembly.Module;
    case "detect":
      return typeof v.name === "string" && v.bytes instanceof Uint8Array;
    case "convert":
      return (
        typeof v.name === "string" &&
        v.bytes instanceof Uint8Array &&
        (v.format === undefined || typeof v.format === "string") &&
        typeof v.wantDocument === "boolean"
      );
    case "ping":
      return true;
    default:
      return false;
  }
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.jobId !== "number" && v.type !== "fatal") return false;
  switch (v.type) {
    case "ready":
    case "pong":
      return true;
    case "detected":
      return v.format === undefined || typeof v.format === "string";
    case "result":
      if (v.ok === true) return typeof v.result === "string" || typeof v.result === "object";
      if (v.ok === false) return typeof v.code === "string" && typeof v.message === "string";
      return false;
    case "fatal":
      return typeof v.message === "string";
    default:
      return false;
  }
}
