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
import { rangeSelect, toggleChecked } from "./selection";
import { chunkMarkdownAsync, resolveChunkOptions, type RagChunk } from "./chunk";
import { clearHistory, loadAll, recordFromJob, recordToJobView, saveRecord } from "./history";
import { downloadBlob } from "@/lib/utils";

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
  /** Restored from IndexedDB — the original file bytes are gone. */
  restored?: boolean;
  /** Computed chunks when chunking is enabled (Flow B preview). */
  chunks?: RagChunk[];
  chunkEncoding?: string;
}

/** Global chunking settings — the Flow A/B switch (docs/preview-design.md §6). */
export interface ChunkSettings {
  enabled: boolean;
  preset: 256 | 512 | 1024;
  customTokens?: string;
  overlapAuto: boolean;
  overlapTokens?: string;
}

type JobKey = { poolJob?: number; cancelled: boolean };

const ACTIVE: ReadonlySet<JobStatus> = new Set([
  "queued", "detecting", "smelting", "packing",
]);

const download = downloadBlob;

export function useConverter() {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [engine, setEngine] = useState<EngineState>("cold");
  const [now, setNow] = useState(() => Date.now());
  const [exporting, setExporting] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [chunkSettings, setChunkSettingsState] = useState<ChunkSettings>({
    enabled: false,
    preset: 512,
    overlapAuto: true,
  });
  const checkAnchor = useRef<string | null>(null);
  const chunkSettingsRef = useRef<ChunkSettings>(chunkSettings);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // Offer a restore banner once, if anything survived the last session.
  useEffect(() => {
    void loadAll()
      .then((records) => {
        if (records.length > 0) setHistoryCount(records.length);
      })
      .catch(() => {});
  }, []);

  const restoreHistory = useCallback(async (): Promise<number> => {
    const records = await loadAll().catch(() => []);
    if (records.length === 0) return 0;
    const views = records.map(recordToJobView);
    for (const view of views) keysRef.current.set(view.id, { cancelled: false });
    setJobs((list) => [...views, ...list]);
    setSelectedId(views[0]?.id ?? null);
    setHistoryCount(null);
    return views.length;
  }, []);

  const dismissHistory = useCallback(() => setHistoryCount(null), []);

  const clearHistoryStore = useCallback(async () => {
    await clearHistory().catch(() => {});
    setHistoryCount(null);
  }, []);

  const keysRef = useRef(new Map<string, JobKey>());
  const jobsRef = useRef<JobView[]>([]);
  jobsRef.current = jobs;
  const setJob = useCallback((id: string, patch: Partial<JobView>) => {
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  /** Persist a finished job to IndexedDB; surface honest cap trimming. */
  const persistDone = useCallback((view: JobView) => {
    const record = recordFromJob(view);
    if (!record) return;
    void saveRecord(record)
      .then((evicted) => {
        if (evicted > 0) {
          setNotice(
            `History trimmed — ${evicted} oldest conversion${evicted === 1 ? "" : "s"} removed to stay under the 50 MB cap.`,
          );
        }
      })
      .catch(() => {
        // history is a bonus; storage failures are silent
      });
  }, []);

  /** Compute chunks for a finished job when chunking is enabled (Flow B).
   *  Chunking is auxiliary — failures never fail the conversion. */
  const attachChunks = useCallback(async (view: JobView) => {
    if (!view.markdown) return;
    const settings = chunkSettingsRef.current;
    if (!settings?.enabled) return;
    const options = resolveChunkOptions({
      preset: settings.preset,
      customTokens: Number(settings.customTokens) || undefined,
      overlapAuto: settings.overlapAuto,
      overlapTokens: Number(settings.overlapTokens) || undefined,
    });
    try {
      const result = await chunkMarkdownAsync(view.markdown, options);
      setJob(view.id, { chunks: result.chunks, chunkEncoding: result.encoding });
    } catch {
      // chunking is a bonus — the conversion stands on its own
    }
  }, [setJob]);

  const setChunkSettings = useCallback(
    (next: ChunkSettings) => {
      setChunkSettingsState(next);
      chunkSettingsRef.current = next;
      if (!next.enabled) return;
      // Re-chunk the selected done job from its in-memory markdown (cheap).
      const selected = jobsRef.current.find((j) => j.id === selectedIdRef.current);
      if (selected?.markdown) void attachChunks(selected);
    },
    [attachChunks],
  );

  /** Load the engine on demand. Safe to call concurrently (pool dedupes).
   *  The engine state is ALWAYS derived from the pool — a cached 'ready'
   *  shortcut here caused the long-run loop: the 60 s idle teardown (or
   *  pagehide) terminates all workers, and the next batch then enqueued
   *  into a zero-worker pool forever. ensureReady() re-initializes after
   *  any teardown (readyPromise resets). */
  const ensureEngine = useCallback(async (): Promise<boolean> => {
    try {
      if (!getPool().isWarm()) setEngine("loading");
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
        const updated: JobView = {
          ...view,
          status: "done",
          kind: passThrough,
          markdown,
          chars: markdown.length,
        };
        setJob(view.id, updated);
        persistDone(updated);
        void attachChunks(updated);
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
        const updated: JobView = {
          ...view,
          status: "done",
          format: res.format,
          markdown,
          chars: markdown.length,
          ms: Math.max(1, Math.round(performance.now() - started)),
        };
        setJob(view.id, updated);
        persistDone(updated);
        void attachChunks(updated);
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
  }, [attachChunks, ensureEngine, setJob]);

  const addFiles = useCallback(
    (files: File[], meta?: { folders?: number; foldersUnsupported?: boolean }) => {
      if (files.length === 0) {
        if (meta?.foldersUnsupported) {
          setNotice("Folder drop isn't supported in this browser — pick files instead.");
        }
        return;
      }
      if (meta?.folders && meta.folders > 0) {
        setNotice(
          `Added ${files.length} file${files.length === 1 ? "" : "s"} from ${meta.folders} folder${meta.folders === 1 ? "" : "s"}.`,
        );
      }
      for (const file of files) {
        const id = crypto.randomUUID();
        keysRef.current.set(id, { cancelled: false });
        setJobs((list) => [...list, { id, file, status: "queued", startedAt: Date.now() }]);
        const view: JobView = { id, file, status: "queued", startedAt: Date.now() };
        void run(view);
      }
    },
    [run],
  );

  // ── multi-select ───────────────────────────────────────────────────────
  const toggleCheck = useCallback((id: string, range = false) => {
    setChecked((prev) => {
      const ids = jobsRef.current.map((j) => j.id);
      const anchor = checkAnchor.current;
      checkAnchor.current = id;
      if (range && anchor) return [...rangeSelect(ids, anchor, id)];
      return [...toggleChecked(new Set(prev), id)];
    });
  }, []);

  const clearChecked = useCallback(() => setChecked([]), []);

  const deleteChecked = useCallback(() => {
    const doomed = new Set(checked);
    for (const id of doomed) {
      keysRef.current.delete(id);
      setJobs((list) => list.filter((j) => j.id !== id));
      setSelectedId((s) => (s && doomed.has(s) ? null : s));
    }
    setChecked([]);
  }, [checked]);

  const copyChecked = useCallback(async (): Promise<number> => {
    const ids = new Set(checked);
    const done = jobsRef.current.filter(
      (j) => j.status === "done" && j.markdown && ids.has(j.id),
    );
    if (done.length === 0) return 0;
    const text = done.map((j) => `# ${j.file.name}\n\n${j.markdown}`).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      return done.length;
    } catch {
      return -1;
    }
  }, [checked]);

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
    setChecked([]); // stale ids would otherwise linger in the batch bar
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
    if (view.restored) return; // the original file bytes are gone
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
   * Export a list of done jobs as one .zip. Assets come from a lazy
   * toDocument pass, run sequentially (memory-safe). Jobs flip to
   * 'packing' while their assets are gathered; markdown stays visible.
   */
  const exportJobs = useCallback(
    async (list: JobView[]): Promise<boolean> => {
      if (list.length === 0 || exporting) return false;
      if (jobsRef.current.some((j) => j.status === "packing")) return false;
      setExporting(true);
      for (const job of list) setJob(job.id, { status: "packing" });
      try {
        const entries: { name: string; markdown: string; assets?: Asset[] }[] = [];
        for (const job of list) {
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
        for (const job of list) setJob(job.id, { status: "done" });
        setExporting(false);
      }
    },
    [exporting, setJob],
  );

  const exportAll = useCallback(
    () => exportJobs(jobsRef.current.filter((j) => j.status === "done")),
    [exportJobs],
  );

  const exportChecked = useCallback(() => {
    const ids = new Set(checked);
    return exportJobs(jobsRef.current.filter((j) => j.status === "done" && ids.has(j.id)));
  }, [checked, exportJobs]);

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
    checked, notice, historyCount, chunkSettings, setChunkSettings,
    addFiles, cancel, remove, retry, clearFinished,
    exportAll, exportChecked, deleteChecked, copyChecked,
    toggleCheck, clearChecked,
    restoreHistory, dismissHistory, clearHistoryStore,
    downloadMarkdown, downloadZip, select: setSelectedId,
    activeCount,
  };
}
