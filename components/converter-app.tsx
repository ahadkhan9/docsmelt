"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import { Lock, X } from "lucide-react";
import { ANNOUNCE_EVENT } from "@/lib/announce";
import { refine, type ErrorKind } from "@/lib/converter/errors";
import { Button } from "@/components/ui/button";
import { handleShortcut } from "@/lib/converter/shortcuts";
import { useConverter } from "@/lib/converter/useConverter";
import { FurnaceDropzone } from "./furnace-dropzone";
import { FileQueue } from "./file-queue";
import { IngotPreview } from "./ingot-preview";
import {
  PreviewResizeHandle,
  QUEUE_W_DEFAULT,
  QUEUE_W_MIN,
  QUEUE_W_MAX,
  INGOT_H_DEFAULT,
} from "./preview-resize-handle";

/** Best-effort global paste (⌘⇧V): read the clipboard, hand files to the app.
 *  Fails silently when permission is denied — the dropzone paste hint stays. */
async function pasteFromClipboard(addFiles: (files: File[]) => void): Promise<void> {
  try {
    const items = await navigator.clipboard.read();
    const files: File[] = [];
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith("text/")) continue;
        const blob = await item.getType(type);
        const ext = type.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
        files.push(new File([blob], `pasted.${ext}`, { type }));
      }
    }
    if (files.length > 0) addFiles(files);
  } catch {
    // clipboard permission denied — nothing to do
  }
}

export default function ConverterApp() {
  const c = useConverter();
  const hasJobs = c.jobs.length > 0;

  // Workspace split: the queue column width is user-adjustable and persists;
  // the preview height resets to the default each load — a desktop-tuned px
  // height must never leak onto a phone (the grid is single-column below lg
  // and lg:h-[var(--ingot-h)] never applies there). The persisted width is
  // applied AFTER mount so SSR and the hydrated client always agree.
  const [queueW, setQueueW] = useState(QUEUE_W_DEFAULT);
  const [ingotH, setIngotH] = useState(INGOT_H_DEFAULT);
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let mounted = true;
    try {
      const w = Number(localStorage.getItem("dm-queue-w"));
      if (mounted && Number.isFinite(w)) {
        setQueueW(Math.min(QUEUE_W_MAX, Math.max(QUEUE_W_MIN, w)));
      }
    } catch {
      // privacy mode — layout preference just doesn't persist
    }
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("dm-queue-w", String(queueW));
    } catch {
      // privacy mode — layout preference just doesn't persist
    }
  }, [queueW]);

  // Screen-reader announcements on status flips (aria-live).
  const [announcement, setAnnouncement] = useState("");
  const lastKey = useRef("");
  useEffect(() => {
    const done = c.jobs.filter((j) => ["done", "failed", "cancelled"].includes(j.status));
    const last = done[done.length - 1];
    if (!last) return;
    const key = `${last.id}:${last.status}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (last.status === "done")
      setAnnouncement(
        last.kind ? `${last.file.name} is already markdown.` : `Converted ${last.file.name}.`,
      );
    else if (last.status === "failed") {
      const title = refine(last.file.name, last.format, (last.code ?? "engine") as ErrorKind).title;
      setAnnouncement(`${last.file.name}: ${title}.`);
    } else setAnnouncement(`Cancelled ${last.file.name}.`);
  }, [c.jobs]);

  // Folder-drop / batch feedback through the same live region.
  useEffect(() => {
    if (c.notice) setAnnouncement(c.notice);
  }, [c.notice]);

  // Visible toast for the same notices (folder counts, history trim) — the
  // live region alone was screen-reader-only feedback (G1).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!c.notice) return;
    setToast(c.notice);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, [c.notice]);

  // One-time, dismissible "you're done" hint after the first conversion.
  const [showDoneHint, setShowDoneHint] = useState(false);
  useEffect(() => {
    if (showDoneHint || c.jobs.length === 0) return;
    if (!c.jobs.some((j) => j.status === "done")) return;
    try {
      if (sessionStorage.getItem("dm-done-hint")) return;
      sessionStorage.setItem("dm-done-hint", "1");
    } catch {
      // privacy mode — the hint just shows once per mount
    }
    setShowDoneHint(true);
  }, [c.jobs, showDoneHint]);

  // Screen-reader announcements for copy/export actions from any surface.
  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setAnnouncement(detail);
    };
    window.addEventListener(ANNOUNCE_EVENT, onAnnounce);
    return () => window.removeEventListener(ANNOUNCE_EVENT, onAnnounce);
  }, []);

  // "Clear history" is permanent — two-step inline confirmation (R5).
  const [clearArmed, setClearArmed] = useState(false);
  const clearArmTimer = useRef<number | null>(null);
  const armClearHistory = () => {
    if (clearArmed) {
      if (clearArmTimer.current) window.clearTimeout(clearArmTimer.current);
      setClearArmed(false);
      void c.clearHistoryStore();
    } else {
      setClearArmed(true);
      if (clearArmTimer.current) window.clearTimeout(clearArmTimer.current);
      clearArmTimer.current = window.setTimeout(() => setClearArmed(false), 3000);
    }
  };

  // PWA: register the offline shell (production only; dev never caches).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // offline is a bonus, never a failure mode
    });
  }, []);

  // Keyboard-first workflow. The hook value is read through a ref so the
  // listener subscribes once.
  const cRef = useRef(c);
  cRef.current = c;
  const pickerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      const inEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        target?.isContentEditable === true;
      const app = cRef.current;
      const action = handleShortcut(event, {
        inEditable,
        rowIds: app.jobs.map((j) => j.id),
      });
      if (!action) return;
      event.preventDefault();
      switch (action.type) {
        case "open-picker":
          pickerRef.current?.();
          break;
        case "paste":
          void pasteFromClipboard(app.addFiles);
          break;
        case "download-active":
          if (app.selected?.markdown) app.downloadMarkdown(app.selected.id);
          break;
        case "escape": {
          const active = [...app.jobs]
            .reverse()
            .find((j) =>
              ["queued", "detecting", "smelting", "packing"].includes(j.status),
            );
          if (active) app.cancel(active.id);
          else app.select(null);
          break;
        }
        case "select-row": {
          const job = app.jobs[action.index];
          if (job) app.select(job.id);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-border/60">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-baseline gap-2.5">
              <span
                translate="no"
                className="font-display text-2xl font-bold tracking-wide text-foreground"
              >
                DOC<span className="text-molten">SMELT</span>
              </span>
              <span className="hidden font-mono text-[11px] uppercase tracking-widest text-muted-foreground md:inline">
                document smeltery
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Lock className="size-3.5 text-molten" aria-hidden />
              <span>Converts in your browser — files never leave</span>
            </div>
          </div>
        </header>

        {c.historyCount !== null && c.historyCount > 0 && (
          <div className="border-b border-border/60 bg-card/60">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
              <p className="font-mono text-[11px] text-steel">
                Restore previous session — {c.historyCount} converted file
                {c.historyCount === 1 ? "" : "s"} stored locally.
              </p>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-10"
                  onClick={() => void c.restoreHistory()}
                >
                  Restore
                </Button>
                <Button variant="ghost" size="sm" className="min-h-10" onClick={c.dismissHistory}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
          {hasJobs ? (
            <div className="flex flex-col gap-5">
              <FurnaceDropzone compact engine={c.engine} onFiles={c.addFiles} pickerRef={pickerRef} />
              {showDoneHint && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-molten/40 bg-card px-4 py-2.5">
                  <p className="font-mono text-[11px] text-steel">
                    Done — copy the markdown or download the .md from the panel.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDoneHint(false)}
                    aria-label="Dismiss hint"
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
              <div
                ref={gridRef}
                className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[var(--queue-w,340px)_minmax(0,1fr)]"
                style={{ "--queue-w": `${queueW}px` } as React.CSSProperties}
              >
                <FileQueue
                  jobs={c.jobs}
                  now={c.now}
                  selectedId={c.selected?.id ?? null}
                  checked={c.checked}
                  onSelect={c.select}
                  onToggleCheck={c.toggleCheck}
                  onCancel={c.cancel}
                  onRemove={c.remove}
                  onRetry={c.retry}
                  onDownloadMd={c.downloadMarkdown}
                  onDownloadZip={c.downloadZip}
                  onClearFinished={c.clearFinished}
                  onExportAll={() => void c.exportAll()}
                  onDeleteChecked={c.deleteChecked}
                  onExportChecked={() => void c.exportChecked()}
                  onCopyChecked={c.copyChecked}
                  onClearChecked={c.clearChecked}
                  onCancelExport={c.cancelExport}
                  exporting={c.exporting}
                />
                <div
                  className="relative min-w-0"
                  style={{ "--ingot-h": `${ingotH}px` } as React.CSSProperties}
                >
                  <IngotPreview
                    job={c.selected}
                    chunkSettings={c.chunkSettings}
                    onChunkSettings={c.setChunkSettings}
                    onDownloadMd={c.downloadMarkdown}
                    onDownloadZip={c.downloadZip}
                    onDownloadChunksZip={c.downloadChunksZip}
                    onRetry={c.retry}
                    onRemove={c.remove}
                  />
                  <PreviewResizeHandle
                    gridRef={gridRef}
                    queueW={queueW}
                    setQueueW={setQueueW}
                    ingotH={ingotH}
                    setIngotH={setIngotH}
                  />
                </div>
              </div>
            </div>
          ) : (
            <FurnaceDropzone engine={c.engine} onFiles={c.addFiles} pickerRef={pickerRef} />
          )}
        </main>

        <footer className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="shortcuts-hint flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
              <span>
                <kbd className="kbd">⌘O</kbd> open
              </span>
              <span>
                <kbd className="kbd">⌘⇧V</kbd> paste
              </span>
              <span>
                <kbd className="kbd">⌘D</kbd> download
              </span>
              <span>
                <kbd className="kbd">Esc</kbd> cancel / clear
              </span>
              <span>
                <kbd className="kbd">1–9</kbd> select
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] leading-relaxed text-muted-foreground md:shrink-0 md:justify-end">
              <span className="whitespace-nowrap">Engine: Firecrawl AnyDoc (MIT) · WebAssembly</span>
              <span aria-hidden className="hidden text-border sm:inline">·</span>
              <span className="hidden sm:inline">No server · no uploads · no accounts</span>
              <Link
                href="/benchmark"
                className="rounded px-1 py-0.5 underline underline-offset-2 hover:text-foreground"
              >
                Benchmarks
              </Link>
              {c.historyCount !== null && (
                <button
                  type="button"
                  className="rounded px-1 py-0.5 underline underline-offset-2 hover:text-foreground"
                  onClick={armClearHistory}
                >
                  {clearArmed ? "Clear history? This can't be undone." : "Clear history"}
                </button>
              )}
            </div>
          </div>
        </footer>

        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border border-molten/40 bg-card px-4 py-2.5 font-mono text-[12px] leading-relaxed text-foreground shadow-lg"
          >
            {toast}
          </motion.div>
        )}

        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
    </MotionConfig>
  );
}
