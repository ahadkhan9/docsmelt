/**
 * Pool unit tests. No workers are ever spawned here (the pool is lazy and
 * ensureReady() is never called) — these cover the pure decision logic and
 * the queued-job paths that don't need a real Worker.
 */
import { describe, expect, it } from "vitest";
import { ConverterPool, estimatePeak, fitsBudget } from "./pool";

const MB = 1024 * 1024;

describe("estimatePeak / fitsBudget (memory guard)", () => {
  it("estimates peak as size×6 + 256 MB slack", () => {
    expect(estimatePeak(10 * MB)).toBe(10 * MB * 6 + 256 * MB);
  });

  it("allows jobs within the budget", () => {
    expect(fitsBudget([], 10 * MB)).toBe(true);
    // three 20 MB jobs: each peaks at 376 MB → 1128 MB ≤ 1536 MB
    expect(fitsBudget([20 * MB, 20 * MB], 20 * MB)).toBe(true);
  });

  it("blocks jobs that would exceed the budget", () => {
    // three 100 MB jobs: each peaks at 856 MB → 1712 MB > 1536 MB
    expect(fitsBudget([100 * MB, 100 * MB], 100 * MB)).toBe(false);
  });

  it("respects a custom budget", () => {
    expect(fitsBudget([], 10 * MB, 700 * MB)).toBe(true);
    expect(fitsBudget([100 * MB], 100 * MB, 700 * MB)).toBe(false);
  });
});

describe("ConverterPool queue (no workers — lazy)", () => {
  it("rejects oversized files before enqueue (fileTooLarge)", async () => {
    const pool = new ConverterPool();
    const big = new Uint8Array(101 * MB);
    const { promise } = pool.enqueue("convert", "huge.bin", big);
    await expect(promise).rejects.toMatchObject({ code: "fileTooLarge" });
  });

  it("keeps small jobs queued when no workers exist (never rejects early)", async () => {
    const pool = new ConverterPool();
    const { promise } = pool.enqueue("detect", "a.docx", new Uint8Array(10));
    const state = await Promise.race([
      promise.then(() => "resolved", () => "rejected"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
    ]);
    expect(state).toBe("pending");
  });

  it("cancel removes a queued job and rejects it as cancelled", async () => {
    const pool = new ConverterPool();
    const a = pool.enqueue("detect", "a.docx", new Uint8Array(4));
    const b = pool.enqueue("detect", "b.pdf", new Uint8Array(4));
    pool.cancel(a.id);
    await expect(a.promise).rejects.toMatchObject({ code: "cancelled" });
    const bState = await Promise.race([
      b.promise.then(() => "resolved", () => "rejected"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
    ]);
    expect(bState).toBe("pending"); // untouched neighbour
  });

  it("cancel of an unknown job is a no-op", () => {
    const pool = new ConverterPool();
    expect(() => pool.cancel(999)).not.toThrow();
  });

  it("terminateAll is safe with no workers", () => {
    const pool = new ConverterPool();
    expect(() => pool.terminateAll()).not.toThrow();
  });
});
