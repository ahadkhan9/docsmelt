/**
 * The converter hook — all job state lives here; the pool is a module-level
 * singleton. Per-file flow: pass-through check → detect → badge → convert →
 * done/failed. The wasm engine loads lazily, only when the first file
 * actually needs it (Markdown/plain-text files never trigger it).
 * Progress is indeterminate by design (a synchronous wasm call can't be
 * chunked) — rows show honest elapsed time, never fake percentages.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyFormat, Asset, Document } from "./protocol";
import { ConverterPool } from "./pool";
import { decodeText, detectPassThrough, type PassThroughKind } from "./passthrough";
import { buildExportZip, zipDocument } from "./zip";
import { supportsZip } from "./formats";

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
  /** Set when the file passed through without the engine (md/txt). */
  kind?: PassThroughKind;
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
  const [exporting, setExporting] = useState(false);

  const keysRef = useRef(new Map<string, JobKey>());
  const jobsRef = useRef<JobView[]>([]);
  jobsRef.current = jobs;
  const engineRef = useRef<EngineState>("cold");
  engineRef.current = engine;

  const setJob = useCallback((id: string, patch: Partial<JobView>) => {
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  /** Load the engine on demand. Safe to call concurrently (pool dedupes). */
  const ensureEngine = useCallback(async (): Promise<boolean> => {
    if (engineRef.current === "ready") return true;
    if (engineRef.current === "error") return false;
    setEngine("loading");
    try {
      await getPool().ensureReady();
      setEngine("ready");
      return true;
    } catch {
      setEngine("error");
      return false;
    }
  }, []);

  const run = useCallback(async (view: JobView) => {
    const key = keysRef.current.get(view.id);
    if (!key) return;
    try {
      const bytes = new Uint8Array(await view.file.arrayBuffer());
      if (key.cancelled) return;

      // Pass-through: already Markdown or plain text — no engine involved.
      const passThrough = detectPassThrough(view.file.name, bytes);
      if (passThrough) {
        const markdown = decodeText(bytes);
        setJob(view.id, {
          status: "done",
          kind: passThrough,
          markdown,
          chars: markdown.length,
        });
        setSelectedId((s) => s ?? view.id);
        return;
      }

      setJob(view.id, { status: "detecting" });
      if (!(await ensureEngine())) {
        setJob(view.id, {
          status: "failed",
          code: "engine",
          message: "The conversion engine failed to load. Reload the page and try again.",
        });
        return;
      }
      if (key.cancelled) return;

      // Detect: bytes are transferred zero-copy to the worker (detached
      // after postMessage) — the convert pass re-reads the file.
      const detect = getPool().enqueue("detect", view.file.name, bytes);
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
  }, [ensureEngine, setJob]);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    for (const file of files) {
      const id = crypto.randomUUID();
      keysRef.current.set(id, { cancelled: false });
      setJobs((list) => [...list, { id, file, status: "queued", startedAt: Date.now() }]);
      const view: JobView = { id, file, status: "queued", startedAt: Date.now() };
      void run(view);
    }
  }, [run]);

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
    download(
      new Blob([view.markdown], { type: "text/markdown;charset=utf-8" }),
      `${view.file.name.replace(/\.[^.]+$/, "")}.md`,
    );
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

  /**
   * Export all done jobs as one .zip. Assets come from a lazy toDocument
   * pass, run sequentially (memory-safe). Jobs flip to 'packing' while
   * their assets are gathered; markdown stays visible in the preview.
   */
  const exportAll = useCallback(async (): Promise<boolean> => {
    const done = jobsRef.current.filter((j) => j.status === "done");
    if (done.length === 0 || exporting) return false;
    if (jobsRef.current.some((j) => j.status === "packing")) return false;
    setExporting(true);
    for (const job of done) setJob(job.id, { status: "packing" });
    try {
      const entries: { name: string; markdown: string; assets?: Asset[] }[] = [];
      for (const job of done) {
        const entry: { name: string; markdown: string; assets?: Asset[] } = {
          name: job.file.name,
          markdown: job.markdown ?? "",
        };
        // Asset-capable formats need a fresh toDocument run (the original
        // .md path never stored the document model). Pass-through files
        // have no assets by definition.
        if (!job.kind && job.format && supportsZip(job.format)) {
          try {
            const bytes = new Uint8Array(await job.file.arrayBuffer());
            const key = keysRef.current.get(job.id);
            if (key?.cancelled) continue;
            const conv = getPool().enqueue("convert", job.file.name, bytes, {
              format: job.format,
              wantDocument: true,
            });
            key && (key.poolJob = conv.id);
            const res = await conv.promise;
            if (res.ok) entry.assets = (res.result as Document).assets;
          } catch {
            // Asset pass failed — export the markdown alone, honestly.
          }
        }
        entries.push(entry);
      }
      const blob = await buildExportZip(entries);
      download(blob, `docsmelt-export-${entries.length}-files.zip`);
      return true;
    } finally {
      for (const job of done) setJob(job.id, { status: "done" });
      setExporting(false);
    }
  }, [exporting, setJob]);

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
    jobs, selected, engine, now, exporting,
    addFiles, cancel, remove, retry, clearFinished, exportAll,
    downloadMarkdown, downloadZip, select: setSelectedId,
    activeCount,
  };
}
