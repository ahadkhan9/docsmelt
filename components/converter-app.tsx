"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { Lock } from "lucide-react";
import { refine, type ErrorKind } from "@/lib/converter/errors";
import { Button } from "@/components/ui/button";
import { handleShortcut } from "@/lib/converter/shortcuts";
import { useConverter } from "@/lib/converter/useConverter";
import { FurnaceDropzone } from "./furnace-dropzone";
import { FileQueue } from "./file-queue";
import { IngotPreview } from "./ingot-preview";

const FORMATS =
  "doc · docx · docm · odt · rtf · pdf · xls · xlsx · xlsm · xlsb · ods · csv · " +
  "ppt · pps · pot · pptx · pptm · ppsx · ppsm · odp · epub";

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
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
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
                  exporting={c.exporting}
                  globalPreset={c.chunkSettings.enabled ? c.chunkSettings.preset : undefined}
                />
                <IngotPreview
                  job={c.selected}
                  chunkSettings={c.chunkSettings}
                  onChunkSettings={c.setChunkSettings}
                  onDownloadMd={c.downloadMarkdown}
                  onDownloadZip={c.downloadZip}
                  onRetry={c.retry}
                  onRemove={c.remove}
                />
              </div>
            </div>
          ) : (
            <FurnaceDropzone engine={c.engine} onFiles={c.addFiles} pickerRef={pickerRef} />
          )}
        </main>

        <footer className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Formats
              </p>
              <p className="mt-2 max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
                {FORMATS}
              </p>
              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                Markdown and plain text pass through unchanged — no conversion needed.
              </p>
              <div className="shortcuts-hint mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
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
            </div>
            <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              <p>
                <a href="/benchmark" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
                  Benchmarks
                </a>{" "}
                · Engine: Firecrawl AnyDoc (MIT) · WebAssembly
              </p>
              <p>
                No server · no uploads · no accounts
                {c.historyCount !== null && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() => void c.clearHistoryStore()}
                    >
                      Clear history
                    </button>
                  </>
                )}
              </p>
              <p>
                Built by <span translate="no">Ahad Khan</span> ·{" "}
                <a
                  href="https://ahad.works"
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  ahad.works
                </a>
              </p>
            </div>
          </div>
        </footer>

        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
    </MotionConfig>
  );
}
