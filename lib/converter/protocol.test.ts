/**
 * Protocol contract tests — the discriminated union both ends speak.
 * The guards are the runtime contract validator; malformed payloads from
 * a broken worker must never reach job resolvers.
 */
import { describe, expect, it } from "vitest";
import { isWorkerRequest, isWorkerResponse } from "./protocol";

describe("isWorkerRequest", () => {
  it("accepts every request variant", () => {
    const module = new WebAssembly.Module(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
    expect(isWorkerRequest({ type: "module", jobId: 0, module })).toBe(true);
    expect(isWorkerRequest({ type: "detect", jobId: 1, name: "a.docx", bytes: new Uint8Array(4) })).toBe(true);
    expect(isWorkerRequest({ type: "convert", jobId: 2, name: "a.pdf", bytes: new Uint8Array(4), format: "pdf", wantDocument: false })).toBe(true);
    expect(isWorkerRequest({ type: "ping", jobId: 3 })).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isWorkerRequest(null)).toBe(false);
    expect(isWorkerRequest({})).toBe(false);
    expect(isWorkerRequest({ type: "convert", jobId: "1", name: "a", bytes: new Uint8Array(4) })).toBe(false);
    expect(isWorkerRequest({ type: "convert", jobId: 1, name: "a", bytes: "nope", wantDocument: false })).toBe(false);
    expect(isWorkerRequest({ type: "detect", jobId: 1, bytes: new Uint8Array(4) })).toBe(false);
    expect(isWorkerRequest({ type: "module", jobId: 0, module: {} })).toBe(false);
    expect(isWorkerRequest({ type: "unknown", jobId: 1 })).toBe(false);
  });
});

describe("isWorkerResponse", () => {
  it("accepts every response variant", () => {
    expect(isWorkerResponse({ type: "ready", jobId: 0 })).toBe(true);
    expect(isWorkerResponse({ type: "pong", jobId: 0 })).toBe(true);
    expect(isWorkerResponse({ type: "detected", jobId: 1, format: "docx" })).toBe(true);
    expect(isWorkerResponse({ type: "detected", jobId: 1 })).toBe(true);
    expect(isWorkerResponse({ type: "result", jobId: 2, ok: true, format: "pdf", result: "# hi" })).toBe(true);
    expect(isWorkerResponse({ type: "result", jobId: 2, ok: false, code: "encrypted", message: "document is encrypted" })).toBe(true);
    expect(isWorkerResponse({ type: "fatal", message: "boom" })).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isWorkerResponse({ type: "result", jobId: 2, ok: true })).toBe(false);
    expect(isWorkerResponse({ type: "result", jobId: 2, ok: false, code: "encrypted" })).toBe(false);
    expect(isWorkerResponse({ type: "result", jobId: 2, ok: "yes", result: "x" })).toBe(false);
    expect(isWorkerResponse({ type: "detected", jobId: "x" })).toBe(false);
    expect(isWorkerResponse({ type: "fatal" })).toBe(false);
    expect(isWorkerResponse({ type: "ready" })).toBe(false);
    expect(isWorkerResponse("hello")).toBe(false);
  });
});
