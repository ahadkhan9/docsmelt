/**
 * The converter hook — all job state lives here; the pool is a module-level
 * singleton. Per-file flow: detect → badge → convert → done/failed.
 * Progress is indeterminate by design (a synchronous wasm call can't be
 * chunked) — rows show honest elapsed time, never fake percentages.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyFormat, Document } from "./protocol";
import { ConverterPool } from "./pool";
import { zipDocument } from "./zip";

let pool: ConverterPool | null = null;
const getPool = () => (pool ??= new ConverterPool());

export type EngineState = "cold" | "loading" | "ready" | "error";
export type JobStatus =
  | "queued" | "detecting" | "smelting" | "packing"
  | "done" | "failed" | "cancelled";

export interface JobView {
  id: string;
  file: File;
  status: JobStatus;
  format?: AnyFormat;
  code?: string;
  message?: string;
  markdown?: string;
  chars?: number;
  ms?: number;
  startedAt: number;
}

type JobKey = { poolJob?: number; cancelled: boolean };

const ACTIVE: ReadonlySet<JobStatus> = new Set([
  "queued", "detecting", "smelting", "packing",
]);

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function useConverter() {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [engine, setEngine] = useState<EngineState>("cold");
  const [now, setNow] = useState(() => Date.now());

  const keysRef = useRef(new Map<string, JobKey>());
  const jobsRef = useRef<JobView[]>([]);
  jobsRef.current = jobs;

  const setJob = useCallback((id: string, patch: Partial<JobView>) => {
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const run = useCallback(async (view: JobView) => {
    const key = keysRef.current.get(view.id);
    if (!key) return;
    try {
      // Detect: bytes are transferred zero-copy to the worker (detached
      // after postMessage) — the convert pass re-reads the file.
      const detectBytes = new Uint8Array(await view.file.arrayBuffer());
      if (key.cancelled) return;
      setJob(view.id, { status: "detecting" });
      const detect = getPool().enqueue("detect", view.file.name, detectBytes);
      key.poolJob = detect.id;
      const d = await detect.promise;
      if (key.cancelled) return;
      const format = d.ok ? d.format : undefined;
      setJob(view.id, { status: "smelting", format });

      const convertBytes = new Uint8Array(await view.file.arrayBuffer());
      if (key.cancelled) return;
      const started = performance.now();
      const conv = getPool().enqueue("convert", view.file.name, convertBytes, { format });
      key.poolJob = conv.id;
      const res = await conv.promise;
      if (key.cancelled) return;
      if (res.ok) {
        const markdown = res.result as string;
        setJob(view.id, {
          status: "done",
          format: res.format,
          markdown,
          chars: markdown.length,
          ms: Math.max(1, Math.round(performance.now() - started)),
        });
        setSelectedId((s) => s ?? view.id);
      } else {
        setJob(view.id, { status: "failed", code: res.code, message: res.message });
      }
    } catch (error) {
      const code = (error as { code?: string }).code ?? "engine";
      if (key.cancelled || code === "cancelled") {
        setJob(view.id, { status: "cancelled" });
      } else {
        setJob(view.id, {
          status: "failed",
          code,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [setJob]);

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    let engineState: EngineState = engine;
    if (engine === "cold") {
      engineState = "loading";
      setEngine("loading");
      try {
        await getPool().ensureReady();
        engineState = "ready";
        setEngine("ready");
      } catch {
        engineState = "error";
        setEngine("error");
      }
    }
    for (const file of files) {
      const id = crypto.randomUUID();
      keysRef.current.set(id, { cancelled: false });
      setJobs((list) => [...list, { id, file, status: "queued", startedAt: Date.now() }]);
      const view: JobView = { id, file, status: "queued", startedAt: Date.now() };
      if (engineState === "error") {
        setJob(id, {
          status: "failed",
          code: "engine",
          message: "The conversion engine failed to load. Reload the page and try again.",
        });
      } else {
        void run(view);
      }
    }
  }, [engine, run, setJob]);

  const cancel = useCallback((id: string) => {
    const key = keysRef.current.get(id);
    if (key) {
      key.cancelled = true;
      if (key.poolJob !== undefined) getPool().cancel(key.poolJob);
    }
    setJob(id, { status: "cancelled" });
  }, [setJob]);

  const remove = useCallback((id: string) => {
    keysRef.current.delete(id);
    setJobs((list) => list.filter((j) => j.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const retry = useCallback((id: string) => {
    const view = jobsRef.current.find((j) => j.id === id);
    if (!view) return;
    const key = keysRef.current.get(id);
    if (key) key.cancelled = false;
    setJob(id, { status: "queued", code: undefined, message: undefined, startedAt: Date.now() });
    void run({ ...view, status: "queued", startedAt: Date.now() });
  }, [run, setJob]);

  const clearFinished = useCallback(() => {
    for (const j of jobsRef.current) {
      if (j.status === "done" || j.status === "failed" || j.status === "cancelled") {
        keysRef.current.delete(j.id);
      }
    }
    setJobs((list) => list.filter((j) => !(j.status === "done" || j.status === "failed" || j.status === "cancelled")));
    setSelectedId(null);
  }, []);

  const downloadMarkdown = useCallback((id: string) => {
    const view = jobsRef.current.find((j) => j.id === id);
    if (!view?.markdown) return;
    download(new Blob([view.markdown], { type: "text/markdown;charset=utf-8" }), `${view.file.name.replace(/\.[^.]+$/, "")}.md`);
  }, []);

  const downloadZip = useCallback(async (id: string) => {
    const view = jobsRef.current.find((j) => j.id === id);
    if (!view?.format || !view.markdown) return;
    if (view.status === "packing") return; // already packing — no double runs
    const key = keysRef.current.get(id);
    if (!key) return;
    setJob(id, { status: "packing" });
    try {
      const bytes = new Uint8Array(await view.file.arrayBuffer());
      if (key.cancelled) return;
      const job = getPool().enqueue("convert", view.file.name, bytes, {
        format: view.format,
        wantDocument: true,
      });
      key.poolJob = job.id;
      const res = await job.promise;
      if (key.cancelled) return;
      if (!res.ok) {
        setJob(id, { status: "failed", code: res.code, message: res.message });
        return;
      }
      const blob = await zipDocument(view.file.name, view.markdown, res.result as Document);
      download(blob, `${view.file.name.replace(/\.[^.]+$/, "")}.zip`);
      setJob(id, { status: "done" });
    } catch (error) {
      const code = (error as { code?: string }).code ?? "engine";
      if (!key.cancelled && code !== "cancelled") {
        setJob(id, { status: "failed", code, message: error instanceof Error ? error.message : String(error) });
      } else {
        setJob(id, { status: "cancelled" });
      }
    }
  }, [setJob]);

  // One shared clock while anything is active — rows derive elapsed time.
  useEffect(() => {
    if (!jobs.some((j) => ACTIVE.has(j.status))) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [jobs]);

  // Keep the pool honest on unload.
  useEffect(() => {
    const onHide = () => getPool().terminateAll();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  const activeCount = jobs.filter((j) => ACTIVE.has(j.status)).length;

  return {
    jobs, selected, engine, now,
    addFiles, cancel, remove, retry, clearFinished,
    downloadMarkdown, downloadZip, select: setSelectedId,
    activeCount,
  };
}
