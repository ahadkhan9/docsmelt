/**
 * ConverterPool — a lazy pool of module workers sharing one main-thread-
 * compiled WebAssembly.Module. Per docs/architecture.md.
 *
 * - Created lazily on the first convert gesture (never at module scope —
 *   that breaks static prerender).
 * - FIFO queue on the main thread; workers are dumb executors.
 * - Memory guard: never start a job whose estimated peak would push the
 *   in-flight total over budget (OOM is not catchable — caps are the only
 *   graceful "too large" path).
 * - Cancel = terminate the in-flight worker + respawn (the only abort
 *   primitive for a synchronous wasm call).
 * - Workers are disposable, not resettable: any engine-level failure
 *   terminates + respawns (~100–200 ms from the cached Module).
 * - Idle > 60 s: workers terminated, compiled Module kept (cold respawn
 *   costs only instantiation; terminate() is the only way to release
 *   wasm linear memory).
 */
import type { AnyFormat, Document, JobId, WorkerRequest, WorkerResponse } from "./protocol";

export type JobResult =
  | { ok: true; format?: AnyFormat; result: string | Document }
  | { ok: false; code: string; message: string };

type Job = {
  id: JobId;
  kind: "detect" | "convert";
  name: string;
  bytes: Uint8Array;
  format?: AnyFormat;
  wantDocument: boolean;
  resolve: (r: JobResult) => void;
  reject: (e: Error) => void;
};

const IS_MOBILE =
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const FILE_CAP = (IS_MOBILE ? 40 : 100) * 1024 * 1024; // per file, before reading
const BUDGET = (IS_MOBILE ? 700 : 1536) * 1024 * 1024; // pool memory budget
const IDLE_MS = 60_000;
const INIT_TIMEOUT_MS = 15_000;
const MAX_WORKERS = IS_MOBILE ? 1 : 4;
/** input copy in JS + wasm + decompressed parts + DOM tree + assets + slack */
export const estimatePeak = (size: number) => size * 6 + 256 * 1024 * 1024;

/** Memory guard: a job may start only if the in-flight peaks + its own fit. */
export function fitsBudget(
  inFlightSizes: number[],
  nextSize: number,
  budget: number = BUDGET,
): boolean {
  return (
    inFlightSizes.reduce((sum, s) => sum + estimatePeak(s), 0) + estimatePeak(nextSize) <=
    budget
  );
}

export class ConverterPool {
  private compiled: WebAssembly.Module | null = null;
  private workers: Worker[] = [];
  private busy = new Set<Worker>();
  private inflight = new Map<Worker, Job>();
  private queue: Job[] = [];
  private nextId = 1;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readyPromise: Promise<void> | null = null;

  /** Compile once, share forever. Called on the first convert gesture. */
  ensureReady(): Promise<void> {
    // Guard against concurrent callers (batch adds) double-compiling.
    this.readyPromise ??= this.ensure();
    return this.readyPromise;
  }

  private async ensure(): Promise<void> {
    if (!this.compiled) {
      // Relative to THIS module — webpack rewrites it to the emitted,
      // hashed asset. The wasm-bindgen glue inside the worker resolves the
      // same file relative to its own bundle.
      const wasmUrl = new URL(
        "../../node_modules/@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm",
        import.meta.url,
      );
      try {
        // compileStreaming compiles off the main thread.
        const response = await fetch(wasmUrl);
        this.compiled = await WebAssembly.compileStreaming(response);
      } catch {
        try {
          // MIME mismatch → fall back to byte compile (no streaming).
          const response = await fetch(wasmUrl);
          this.compiled = await WebAssembly.compile(await response.arrayBuffer());
        } catch {
          // Missing asset → workers fetch+compile themselves (init()
          // without a module). Slower per worker, still correct.
        }
      }
    }
    const n = Math.min(navigator.hardwareConcurrency ?? 2, MAX_WORKERS);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const spawns: Promise<void>[] = [];
      while (this.workers.length < n) spawns.push(this.spawn());
      try {
        await Promise.all(spawns);
        break;
      } catch {
        // Init failure (fatal from a worker, or timeout) — full reset, one retry.
        for (const w of this.workers) w.terminate();
        this.workers = [];
        this.busy.clear();
        this.inflight.clear();
        if (attempt === 1) throw new Error("converter workers failed to start");
      }
    }
    // Jobs enqueued while the engine was still loading must not sit forever:
    // pump ran with zero workers earlier and nothing re-triggered it.
    this.pump();
  }

  enqueue(
    kind: "detect" | "convert",
    name: string,
    bytes: Uint8Array,
    opts?: { format?: AnyFormat; wantDocument?: boolean },
  ): { id: JobId; promise: Promise<JobResult> } {
    const id = this.nextId++;
    if (bytes.byteLength > FILE_CAP) {
      const err = Object.assign(new Error("File too large for in-browser conversion"), {
        code: "fileTooLarge",
      });
      return { id, promise: Promise.reject(err) };
    }
    const promise = new Promise<JobResult>((resolve, reject) => {
      this.queue.push({
        id,
        kind,
        name,
        bytes,
        format: opts?.format,
        wantDocument: opts?.wantDocument ?? false,
        resolve,
        reject,
      });
      this.pump();
    });
    return { id, promise };
  }

  /** Terminate-based cancellation: kills the in-flight worker, respawns. */
  cancel(jobId: JobId): void {
    const queued = this.queue.findIndex((j) => j.id === jobId);
    if (queued >= 0) {
      const [job] = this.queue.splice(queued, 1);
      job.reject(Object.assign(new Error("Cancelled"), { code: "cancelled" }));
      return;
    }
    const hit = [...this.inflight.entries()].find(([, job]) => job.id === jobId);
    if (hit) this.kill(hit[0], "cancelled");
  }

  /** Release all workers (pagehide). The compiled Module stays. */
  terminateAll(): void {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.busy.clear();
    this.inflight.clear();
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  private pump(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    while (this.queue.length > 0) {
      const worker = this.workers.find((w) => !this.busy.has(w));
      if (!worker) return; // all busy — a result will pump again
      const inFlightSizes = [...this.inflight.values()].map((j) => j.bytes.byteLength);
      // Scan for the first job that fits the memory budget (a small file
      // behind a huge one must not starve).
      const index = this.queue.findIndex((j) => fitsBudget(inFlightSizes, j.bytes.byteLength));
      if (index < 0) return; // memory guard: wait for a slot
      const [job] = this.queue.splice(index, 1);
      this.busy.add(worker);
      this.inflight.set(worker, job);
      worker.postMessage(
        job.kind === "detect"
          ? { type: "detect", jobId: job.id, name: job.name, bytes: job.bytes }
          : {
              type: "convert",
              jobId: job.id,
              name: job.name,
              bytes: job.bytes,
              format: job.format,
              wantDocument: job.wantDocument,
            },
        [job.bytes.buffer], // transfer, not copy: zero-copy input
      );
    }
    this.armIdleTimer();
  }

  private spawn(): Promise<void> {
    // ONE LINE, inline — hoisting the URL breaks webpack's static analysis
    // and the worker chunk silently fails to emit.
    const worker = new Worker(new URL("./converter.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.onMessage(worker, event.data);
    worker.onerror = () => this.kill(worker, "engine");
    this.workers.push(worker);
    if (this.compiled) {
      worker.postMessage({ type: "module", jobId: 0, module: this.compiled });
      return this.waitReady(worker);
    }
    return Promise.resolve();
  }

  private waitReady(worker: Worker): Promise<void> {
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === "ready") {
          worker.removeEventListener("message", onMessage);
          clearTimeout(timer);
          resolve();
        } else if (event.data.type === "fatal") {
          worker.removeEventListener("message", onMessage);
          clearTimeout(timer);
          reject(new Error("worker failed to initialize"));
        }
      };
      const timer = setTimeout(() => {
        worker.removeEventListener("message", onMessage);
        reject(new Error("worker init timed out"));
      }, INIT_TIMEOUT_MS);
      worker.addEventListener("message", onMessage);
    });
  }

  private onMessage(worker: Worker, msg: WorkerResponse): void {
    if (msg.type === "ready" || msg.type === "pong") return;
    if (msg.type === "fatal") {
      this.kill(worker, "engine");
      return;
    }
    const job = this.inflight.get(worker);
    if (!job) return; // stale message (e.g. after cancel)
    this.inflight.delete(worker);
    this.busy.delete(worker);
    if (msg.type === "detected") {
      job.resolve({ ok: true, format: msg.format, result: "" });
    } else if (msg.ok) {
      job.resolve(msg);
    } else {
      job.reject(Object.assign(new Error(msg.message), { code: msg.code }));
    }
    this.pump();
  }

  /** Terminate + respawn. The ONLY reliable way to release wasm memory. */
  private kill(worker: Worker, code: "cancelled" | "engine"): void {
    const job = this.inflight.get(worker);
    this.inflight.delete(worker);
    this.busy.delete(worker);
    if (job) job.reject(Object.assign(new Error(code), { code }));
    worker.terminate();
    this.workers = this.workers.filter((w) => w !== worker);
    if (this.compiled) void this.spawn(); // keep the pool at size
    this.pump();
  }

  private armIdleTimer(): void {
    if (this.queue.length > 0 || this.inflight.size > 0) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.queue.length === 0 && this.inflight.size === 0) this.terminateAll();
    }, IDLE_MS);
  }
}
