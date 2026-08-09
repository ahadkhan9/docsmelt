/**
 * Long-run regression — the "stays in a loop after Clear" bug.
 *
 * Root cause (fixed): the 60 s idle teardown (and pagehide) terminates
 * every worker but left readyPromise resolved; the next ensureReady()
 * returned the stale promise with ZERO workers, so every new job sat in
 * the queue forever — a spinner that never resolves. terminateAll() now
 * resets readyPromise, and ensureReady re-spawns.
 *
 * These tests run the REAL pool logic against a fake worker that answers
 * the protocol, exercising clear/reuse cycles exactly as a long session
 * does. On the old code the first test wedges (the promise never
 * resolves — caught by the timeout).
 */
import { describe, expect, it } from "vitest";
import { ConverterPool } from "./pool";

type Handler = ((e: MessageEvent) => void) | null;

/** Minimal worker that answers the pool's protocol over microtasks. */
class FakeWorker {
  onmessage: Handler = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private reply: (msg: unknown) => void;

  constructor() {
    this.reply = (msg) => {
      queueMicrotask(() => this.onmessage?.({ data: msg } as MessageEvent));
    };
  }

  postMessage(msg: unknown): void {
    const m = msg as { type?: string; jobId?: number; format?: string };
    if (m.type === "module") {
      this.reply({ type: "ready", jobId: m.jobId });
    } else if (m.type === "detect") {
      this.reply({ type: "detected", jobId: m.jobId, format: undefined });
    } else if (m.type === "convert") {
      this.reply({ type: "result", jobId: m.jobId, ok: true, format: m.format, result: "# ok" });
    }
  }

  terminate(): void {
    /* nothing to release in a fake */
  }

  addEventListener(type: string, cb: Handler): void {
    if (type === "message") this.onmessage = cb;
  }

  removeEventListener(): void {}
}

const makePool = () =>
  new ConverterPool((() => new FakeWorker()) as unknown as () => Worker);
const job = (pool: ConverterPool, name: string) =>
  pool.enqueue("convert", name, new Uint8Array(4));

describe("pool long-run — clear/reuse cycles never wedge", () => {
  it("REGRESSION: re-initializes after terminateAll (idle teardown / pagehide)", async () => {
    const pool = makePool();
    await pool.ensureReady();
    expect((await job(pool, "a.md").promise).ok).toBe(true);

    // the 60 s idle teardown path — workers gone, compiled Module kept
    pool.terminateAll();
    expect(pool.workerCount).toBe(0);

    // the hook's ensureEngine flow: ensureReady must RE-SPAWN, not return
    // a stale resolved promise
    await pool.ensureReady();
    expect(pool.workerCount).toBeGreaterThan(0);

    const second = job(pool, "b.md");
    const outcome = await Promise.race([
      second.promise.then((r) => (r.ok ? "resolved" : "failed")),
      new Promise<string>((resolve) => setTimeout(() => resolve("STUCK"), 2000)),
    ]);
    expect(outcome).toBe("resolved");
  });

  it("survives many clear/reuse cycles with worker count bounded", async () => {
    const pool = makePool();
    for (let i = 0; i < 5; i += 1) {
      await pool.ensureReady();
      expect((await job(pool, `${i}.md`).promise).ok).toBe(true);
      pool.terminateAll(); // clear + idle gap
      expect(pool.workerCount).toBe(0);
    }
    await pool.ensureReady();
    expect(pool.workerCount).toBeGreaterThan(0);
    expect((await job(pool, "last.md").promise).ok).toBe(true);
  });

  it("processes a concurrent batch without deadlock", async () => {
    const pool = makePool();
    await pool.ensureReady();
    const jobs = Array.from({ length: 8 }, (_, i) => job(pool, `${i}.pdf`));
    const results = await Promise.all(jobs.map((j) => j.promise));
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("isWarm reflects worker liveness across teardown", async () => {
    const pool = makePool();
    expect(pool.isWarm()).toBe(false);
    await pool.ensureReady();
    expect(pool.isWarm()).toBe(true);
    pool.terminateAll();
    expect(pool.isWarm()).toBe(false);
  });
});
