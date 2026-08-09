"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  Check,
  Copy,
  Download,
  FileQuestion,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { refine, type ErrorKind } from "@/lib/converter/errors";
import { FAMILY_OF, FAMILY_TOKEN, FamilyGlyph, supportsZip } from "@/lib/converter/formats";
import type { JobView } from "@/lib/converter/useConverter";
import { cn } from "@/lib/utils";

const formatSize = (bytes: number): string => {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const ACTIVE = new Set(["queued", "detecting", "smelting", "packing"]);

export function FileQueue({
  jobs,
  now,
  selectedId,
  onSelect,
  onCancel,
  onRemove,
  onRetry,
  onDownloadMd,
  onDownloadZip,
  onClearFinished,
}: {
  jobs: JobView[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onDownloadMd: (id: string) => void;
  onDownloadZip: (id: string) => void;
  onClearFinished: () => void;
}) {
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const finished = jobs.some((j) => ["done", "failed", "cancelled"].includes(j.status));

  return (
    <div className="flex max-h-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:max-h-none">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Queue{" "}
          <span className="text-foreground">
            {doneCount}/{jobs.length}
          </span>
        </h2>
        {finished && (
          <Button variant="ghost" size="sm" className="min-h-9" onClick={onClearFinished}>
            Clear finished
          </Button>
        )}
      </div>
      {jobs.length === 0 ? (
        <p className="px-4 py-10 text-center font-mono text-xs leading-relaxed text-muted-foreground">
          Nothing in the queue. Feed the furnace above.
        </p>
      ) : (
        <ul
          className="flex-1 divide-y divide-border/60 overflow-y-auto scroll-thin"
          aria-label="Conversion queue"
          aria-busy={jobs.some((j) => ACTIVE.has(j.status))}
        >
          <AnimatePresence initial={false}>
            {jobs.map((job) => (
              <QueueRow
                key={job.id}
                job={job}
                now={now}
                selected={job.id === selectedId}
                onSelect={() => onSelect(job.id)}
                onCancel={() => onCancel(job.id)}
                onRemove={() => onRemove(job.id)}
                onRetry={() => onRetry(job.id)}
                onDownloadMd={() => onDownloadMd(job.id)}
                onDownloadZip={() => onDownloadZip(job.id)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function QueueRow({
  job,
  now,
  selected,
  onSelect,
  onCancel,
  onRemove,
  onRetry,
  onDownloadMd,
  onDownloadZip,
}: {
  job: JobView;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onDownloadMd: () => void;
  onDownloadZip: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const family = job.format ? FAMILY_OF[job.format] : undefined;
  const active = ACTIVE.has(job.status);
  const elapsed = Math.max(0, Math.round((now - job.startedAt) / 1000));
  const error =
    job.status === "failed"
      ? refine(job.file.name, job.format, (job.code ?? "engine") as ErrorKind)
      : null;

  const copy = async () => {
    if (!job.markdown) return;
    try {
      await navigator.clipboard.writeText(job.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — .md download is the fallback
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      role="listitem"
      aria-busy={active}
      aria-label={`${job.file.name} — ${job.status}`}
      onClick={onSelect}
      className={cn(
        "relative cursor-pointer px-4 py-3 transition-colors duration-150 [content-visibility:auto]",
        selected ? "bg-accent/60" : "hover:bg-accent/30",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background"
          style={{ color: family ? `var(--${FAMILY_TOKEN[family]})` : "var(--muted-foreground)" }}
          aria-hidden
        >
          {family ? <FamilyGlyph family={family} /> : <FileQuestion className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{job.file.name}</p>
            {job.format && family && (
              <span
                className="shrink-0 rounded-full border border-border/70 bg-background px-1.5 py-px font-mono text-[10px] uppercase tracking-wide"
                style={{ color: `var(--${FAMILY_TOKEN[family]})` }}
              >
                {job.format}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {formatSize(job.file.size)}
            {active && job.status === "smelting" ? ` · ${elapsed}s` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {active ? (
            <Button
              variant="ghost"
              size="icon-lg"
              className="min-h-11 min-w-11"
              aria-label={`Cancel ${job.file.name}`}
              title="Cancel"
              onClick={onCancel}
            >
              <X className="size-4" />
            </Button>
          ) : job.status === "done" ? (
            <>
              <span className="mr-1 font-mono text-[11px] text-fam-sheet" title={`${job.ms} ms`}>
                {job.ms} ms
              </span>
              <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Copy markdown" title="Copy markdown" onClick={copy}>
                {copied ? <Check className="size-4 text-fam-sheet" /> : <Copy className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Download .md" title="Download .md" onClick={onDownloadMd}>
                <Download className="size-4" />
              </Button>
              {supportsZip(job.format) && (
                <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Download .zip with images" title="Download .zip" onClick={onDownloadZip}>
                  <Archive className="size-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Remove from queue" title="Remove" onClick={onRemove}>
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : job.status === "failed" ? (
            <>
              <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Retry" title="Retry" onClick={onRetry}>
                <RotateCcw className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Remove" title="Remove" onClick={onRemove}>
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Remove" title="Remove" onClick={onRemove}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2">
          <p className="text-xs font-medium text-destructive">{error.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.hint}</p>
        </div>
      )}
      {active && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-muted/60">
          <div className="h-full w-1/4 bg-molten animate-shimmer" />
        </div>
      )}
    </motion.li>
  );
}
