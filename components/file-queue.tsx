"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  Check,
  Copy,
  Download,
  FileQuestion,
  FileText,
  MoreHorizontal,
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
  checked,
  onSelect,
  onToggleCheck,
  onCancel,
  onRemove,
  onRetry,
  onDownloadMd,
  onDownloadZip,
  onClearFinished,
  onExportAll,
  onDeleteChecked,
  onExportChecked,
  onCopyChecked,
  onClearChecked,
  onCancelExport,
  exporting,
}: {
  jobs: JobView[];
  now: number;
  selectedId: string | null;
  checked: string[];
  onSelect: (id: string) => void;
  onToggleCheck: (id: string, range: boolean) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onDownloadMd: (id: string) => void;
  onDownloadZip: (id: string) => void;
  onClearFinished: () => void;
  onExportAll: () => void;
  onDeleteChecked: () => void;
  onExportChecked: () => void;
  onCopyChecked: () => Promise<number>;
  onClearChecked: () => void;
  /** Aborts the running batch export (the Export all button becomes it). */
  onCancelExport: () => void;
  exporting: boolean;
}) {
  const [copiedN, setCopiedN] = useState<number | null>(null);
  const [armed, setArmed] = useState<"remove" | "clear" | null>(null);
  const armTimer = useRef<number | null>(null);
  const checkedSet = new Set(checked);
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const restoredDone = jobs.filter((j) => j.status === "done" && j.restored).length;
  const exportableCount = doneCount - restoredDone;
  const finished = jobs.some((j) => ["done", "failed", "cancelled"].includes(j.status));
  const anyCheckedDone = checked.some(
    (id) => jobs.find((j) => j.id === id)?.status === "done",
  );

  /** Two-step inline confirmation for destructive batch actions: first
   *  click arms ("Remove 3?"), the second within 3 s executes. */
  const confirm = (kind: "remove" | "clear", action: () => void) => {
    if (armed === kind) {
      if (armTimer.current) window.clearTimeout(armTimer.current);
      setArmed(null);
      action();
    } else {
      setArmed(kind);
      if (armTimer.current) window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => setArmed(null), 3000);
    }
  };

  const copyChecked = async () => {
    const n = await onCopyChecked();
    if (n > 0) {
      setCopiedN(n);
      setTimeout(() => setCopiedN(null), 1500);
    }
  };

  const exportTitle =
    restoredDone > 0
      ? `Export ${exportableCount} converted file${exportableCount === 1 ? "" : "s"} as one .zip — ${restoredDone} restored skipped (no original bytes)`
      : `Export ${exportableCount} converted file${exportableCount === 1 ? "" : "s"} as one .zip`;

  return (
    <div className="flex max-h-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:max-h-none">
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Queue{" "}
            <span className="text-foreground">
              {doneCount}/{jobs.length}
            </span>
          </h2>
          {/* Global actions — always visible, so checking rows never hides them. */}
          <div className="flex flex-wrap items-center gap-1">
            {exportableCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="min-h-10"
                onClick={exporting ? onCancelExport : onExportAll}
                title={exporting ? "Click to cancel the export" : exportTitle}
              >
                <Archive className="size-3.5" aria-hidden />
                {exporting ? "Cancel export…" : "Export all"}
              </Button>
            )}
            {finished && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-10"
                onClick={() => confirm("clear", onClearFinished)}
              >
                {armed === "clear" ? "Clear finished?" : "Clear finished"}
              </Button>
            )}
          </div>
        </div>
        {checked.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-accent/30 px-4 py-2">
            <span className="mr-1 font-mono text-[11px] text-steel">{checked.length} selected</span>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10"
              onClick={() => confirm("remove", onDeleteChecked)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {armed === "remove" ? `Remove ${checked.length}?` : "Remove"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10"
              disabled={!anyCheckedDone || exporting}
              onClick={onExportChecked}
            >
              <Archive className="size-3.5" aria-hidden />
              Export .zip
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10"
              disabled={!anyCheckedDone}
              onClick={() => void copyChecked()}
            >
              <Copy className="size-3.5" aria-hidden />
              {copiedN !== null ? `Copied ${copiedN}` : "Copy"}
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="min-h-11 min-w-11"
              aria-label="Clear selection"
              title="Clear selection"
              onClick={onClearChecked}
            >
              <X className="size-4" />
            </Button>
          </div>
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
                checked={checkedSet.has(job.id)}
                onToggleCheck={(range) => onToggleCheck(job.id, range)}
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
  checked,
  onToggleCheck,
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
  checked: boolean;
  onToggleCheck: (range: boolean) => void;
  onSelect: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onDownloadMd: () => void;
  onDownloadZip: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const family = job.format ? FAMILY_OF[job.format] : undefined;
  const active = ACTIVE.has(job.status);
  const elapsed = Math.max(0, Math.round((now - job.startedAt) / 1000));
  const error =
    job.status === "failed"
      ? refine(job.file.name, job.format, (job.code ?? "engine") as ErrorKind)
      : null;


  /** Row actions in primary-first order. `labeled` renders the mobile
   *  strip variant (icon + text, 44px targets); icon-only otherwise.
   *  Whole-job Copy lives in the ingot header and chunking in the ingot's
   *  Chunking switch — neither is duplicated on rows. */
  const buildActions = (labeled: boolean) => {
    const cls = labeled ? "min-h-11" : "min-h-11 min-w-11";
    const iconCls = "size-4";
    const withLabel = (icon: React.ReactNode, label: string) => (
      <>
        {icon}
        {label}
      </>
    );
    const stop = (handler: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      handler();
    };
    if (active) {
      return [
        <Button key="cancel" variant="ghost" className={cls} aria-label={`Cancel ${job.file.name}`} title="Cancel" onClick={stop(onCancel)}>
          {labeled ? withLabel(<X className={iconCls} aria-hidden />, "Cancel") : <X className={iconCls} />}
        </Button>,
      ];
    }
    if (job.status === "done") {
      return [
        <Button key="md" variant="ghost" className={cls} aria-label="Download .md" title="Download .md" onClick={stop(onDownloadMd)}>
          {labeled ? withLabel(<Download className={iconCls} aria-hidden />, "Download .md") : <Download className={iconCls} />}
        </Button>,
        ...(supportsZip(job.format) && !job.restored
          ? [
              <Button key="zip" variant="ghost" className={cls} aria-label="Download .zip with images" title="Download .zip with images" onClick={stop(onDownloadZip)}>
                {labeled ? withLabel(<Archive className={iconCls} aria-hidden />, "Download .zip") : <Archive className={iconCls} />}
              </Button>,
            ]
          : []),
        <Button key="remove" variant="ghost" className={cls} aria-label="Remove from queue" title="Remove" onClick={stop(onRemove)}>
          {labeled ? withLabel(<Trash2 className={iconCls} aria-hidden />, "Remove") : <Trash2 className={iconCls} />}
        </Button>,
      ];
    }
    if (job.status === "failed" || job.status === "cancelled") {
      return [
        <Button key="retry" variant="ghost" className={cls} aria-label="Retry" title="Retry" onClick={stop(onRetry)}>
          {labeled ? withLabel(<RotateCcw className={iconCls} aria-hidden />, "Retry") : <RotateCcw className={iconCls} />}
        </Button>,
        <Button key="remove" variant="ghost" className={cls} aria-label="Remove" title="Remove" onClick={stop(onRemove)}>
          {labeled ? withLabel(<Trash2 className={iconCls} aria-hidden />, "Remove") : <Trash2 className={iconCls} />}
        </Button>,
      ];
    }
    return [
      <Button key="remove" variant="ghost" className={cls} aria-label="Remove" title="Remove" onClick={stop(onRemove)}>
        {labeled ? withLabel(<Trash2 className={iconCls} aria-hidden />, "Remove") : <Trash2 className={iconCls} />}
      </Button>,
    ];
  };

  const actions = buildActions(false);
  const labeledActions = buildActions(true);

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
        "relative cursor-pointer px-4 py-3 transition-colors duration-150 [content-visibility:auto] [contain-intrinsic-size:auto_64px]",
        selected ? "bg-accent/60" : "hover:bg-accent/30",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          role="checkbox"
          aria-checked={checked}
          aria-label={`Toggle batch-select ${job.file.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck(e.shiftKey);
          }}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 focus-visible:border-ring focus-visible:bg-accent/40",
            checked
              ? "border-molten bg-molten/10 text-molten"
              : "border-border text-transparent hover:border-molten/50 hover:text-muted-foreground",
          )}
        >
          <Check className="size-4" />
        </button>
        {/* The select target is a real button — keyboard users can Tab to it. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          aria-label={`Preview ${job.file.name}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:rounded-md focus-visible:border-ring"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background"
            style={{ color: family ? `var(--${FAMILY_TOKEN[family]})` : "var(--muted-foreground)" }}
            aria-hidden
          >
            {job.kind ? (
              <FileText className="size-4" />
            ) : family ? (
              <FamilyGlyph family={family} />
            ) : (
              <FileQuestion className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{job.file.name}</span>
              {job.kind ? (
                <span className="shrink-0 rounded-full border border-border/70 bg-background px-1.5 py-px font-mono text-[11px] uppercase tracking-wide text-steel">
                  {job.kind}
                </span>
              ) : job.format && family ? (
                <span
                  className="shrink-0 rounded-full border border-border/70 bg-background px-1.5 py-px font-mono text-[11px] uppercase tracking-wide"
                  style={{ color: `var(--${FAMILY_TOKEN[family]})` }}
                >
                  {job.format}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
              {formatSize(job.file.size)}
              {job.status === "done"
                ? job.kind
                  ? " · already markdown"
                  : ` · ${job.ms} ms`
                : ""}
              {active ? ` · ${elapsed}s` : ""}
            </span>
          </span>
        </button>
        <div className="hidden items-center gap-0.5 sm:flex" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
        <div className="flex items-center gap-1 sm:hidden" onClick={(e) => e.stopPropagation()}>
          {actions[0]}
          {actions.length > 1 && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="min-h-11 min-w-11"
              aria-label="More actions"
              title="More actions"
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((open) => !open)}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {actionsOpen && (
        <div
          className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2 sm:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* slice(1) — the always-visible primary is already inline. */}
          {labeledActions.slice(1)}
        </div>
      )}

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
