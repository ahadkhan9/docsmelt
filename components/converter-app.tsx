"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { Lock } from "lucide-react";
import { refine, type ErrorKind } from "@/lib/converter/errors";
import { useConverter } from "@/lib/converter/useConverter";
import { FurnaceDropzone } from "./furnace-dropzone";
import { FileQueue } from "./file-queue";
import { IngotPreview } from "./ingot-preview";

const FORMATS =
  "doc · docx · docm · odt · rtf · pdf · xls · xlsx · xlsm · xlsb · ods · csv · " +
  "ppt · pps · pot · pptx · pptm · ppsx · ppsm · odp · epub";

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
    if (last.status === "done") setAnnouncement(`Converted ${last.file.name}.`);
    else if (last.status === "failed") {
      const title = refine(last.file.name, last.format, (last.code ?? "engine") as ErrorKind).title;
      setAnnouncement(`${last.file.name}: ${title}.`);
    } else setAnnouncement(`Cancelled ${last.file.name}.`);
  }, [c.jobs]);

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

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
          {hasJobs ? (
            <div className="flex flex-col gap-5">
              <FurnaceDropzone compact engine={c.engine} onFiles={c.addFiles} />
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                <FileQueue
                  jobs={c.jobs}
                  now={c.now}
                  selectedId={c.selected?.id ?? null}
                  onSelect={c.select}
                  onCancel={c.cancel}
                  onRemove={c.remove}
                  onRetry={c.retry}
                  onDownloadMd={c.downloadMarkdown}
                  onDownloadZip={c.downloadZip}
                  onClearFinished={c.clearFinished}
                />
                <IngotPreview
                  job={c.selected}
                  onDownloadMd={c.downloadMarkdown}
                  onDownloadZip={c.downloadZip}
                  onRetry={c.retry}
                  onRemove={c.remove}
                />
              </div>
            </div>
          ) : (
            <FurnaceDropzone engine={c.engine} onFiles={c.addFiles} />
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
            </div>
            <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              <p>Engine: Firecrawl AnyDoc (MIT) · WebAssembly</p>
              <p>No server · no uploads · no accounts</p>
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
