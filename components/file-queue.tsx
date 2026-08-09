"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  Check,
  Copy,
  Download,
  FileQuestion,
  FileText,
  RotateCcw,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chunkMarkdownAsync,
  chunkZip,
  resolveChunkOptions,
  type RagChunk,
} from "@/lib/converter/chunk";
import { refine, type ErrorKind } from "@/lib/converter/errors";
import { FAMILY_OF, FAMILY_TOKEN, FamilyGlyph, supportsZip } from "@/lib/converter/formats";
import type { JobView } from "@/lib/converter/useConverter";
import { stemOf } from "@/lib/converter/zip";
import { cn, downloadBlob } from "@/lib/utils";

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
  exporting: boolean;
}) {
  const [copiedN, setCopiedN] = useState<number | null>(null);
  const checkedSet = new Set(checked);
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const finished = jobs.some((j) => ["done", "failed", "cancelled"].includes(j.status));
  const anyCheckedDone = checked.some(
    (id) => jobs.find((j) => j.id === id)?.status === "done",
  );

  const copyChecked = async () => {
    const n = await onCopyChecked();
    if (n > 0) {
      setCopiedN(n);
      setTimeout(() => setCopiedN(null), 1500);
    }
  };

  return (
    <div className="flex max-h-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:max-h-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Queue{" "}
          <span className="text-foreground">
            {doneCount}/{jobs.length}
          </span>
        </h2>
        {checked.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 font-mono text-[11px] text-steel">
              {checked.length} selected
            </span>
            <Button variant="secondary" size="sm" className="min-h-10" onClick={onDeleteChecked}>
              <Trash2 className="size-3.5" aria-hidden />
              Delete
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
        ) : (
          <div className="flex items-center gap-1">
            {doneCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="min-h-10"
                onClick={onExportAll}
                disabled={exporting}
                title={
                  exporting
                    ? "Packing files…"
                    : `Export ${doneCount} converted file${doneCount === 1 ? "" : "s"} as one .zip`
                }
              >
                <Archive className="size-3.5" aria-hidden />
                {exporting ? "Exporting…" : "Export all"}
              </Button>
            )}
            {finished && (
              <Button variant="ghost" size="sm" className="min-h-10" onClick={onClearFinished}>
                Clear finished
              </Button>
            )}
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
  const [copied, setCopied] = useState(false);
  const [chunkOpen, setChunkOpen] = useState(false);
  const [chunkSize, setChunkSize] = useState<256 | 512 | 1024>(512);
  const [customTokens, setCustomTokens] = useState("");
  const [overlapAuto, setOverlapAuto] = useState(true);
  const [overlapTokens, setOverlapTokens] = useState("");
  const [chunks, setChunks] = useState<RagChunk[] | null>(null);
  const [encoding, setEncoding] = useState("cl100k_base");
  const [chunkLoading, setChunkLoading] = useState(false);
  const family = job.format ? FAMILY_OF[job.format] : undefined;

  const computeChunks = async () => {
    if (!job.markdown) return;
    setChunkLoading(true);
    try {
      // Small docs chunk on the main thread; large ones (>2 MB) offload to
      // a one-shot worker. The tokenizer vocab loads lazily either way.
      const options = resolveChunkOptions({
        preset: chunkSize,
        customTokens: Number(customTokens) || undefined,
        overlapAuto,
        overlapTokens: Number(overlapTokens) || undefined,
      });
      const result = await chunkMarkdownAsync(job.markdown, options);
      setEncoding(result.encoding);
      setChunks(result.chunks);
    } finally {
      setChunkLoading(false);
    }
  };
  const openChunks = () => {
    if (!job.markdown) return;
    setChunkOpen(true);
    void computeChunks();
  };
  const changeChunkSize = (size: 256 | 512 | 1024) => {
    setChunkSize(size);
    void computeChunks();
  };
  const downloadChunks = async () => {
    if (!chunks?.length) return;
    const base = stemOf(job.file.name);
    const label =
      encoding === "chars/4 estimate" ? "tokens (estimate)" : "cl100k tokens";
    const options = resolveChunkOptions({
      preset: chunkSize,
      customTokens: Number(customTokens) || undefined,
      overlapAuto,
      overlapTokens: Number(overlapTokens) || undefined,
    });
    const blob = await chunkZip(base, chunks, job.file.name, label, options);
    downloadBlob(blob, `${base}-chunks.zip`);
  };
  const tokenLabel =
    encoding === "chars/4 estimate" ? "tokens (estimate)" : "cl100k tokens";
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
        "relative cursor-pointer px-4 py-3 transition-colors duration-150 [content-visibility:auto] [contain-intrinsic-size:auto_64px]",
        selected ? "bg-accent/60" : "hover:bg-accent/30",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          role="checkbox"
          aria-checked={checked}
          aria-label={`Select ${job.file.name} for batch actions`}
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{job.file.name}</p>
            {job.kind ? (
              <span className="shrink-0 rounded-full border border-border/70 bg-background px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-steel">
                {job.kind}
              </span>
            ) : job.format && family ? (
              <span
                className="shrink-0 rounded-full border border-border/70 bg-background px-1.5 py-px font-mono text-[10px] uppercase tracking-wide"
                style={{ color: `var(--${FAMILY_TOKEN[family]})` }}
              >
                {job.format}
              </span>
            ) : null}
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
              <span
                className="mr-1 font-mono text-[11px] text-fam-sheet"
                title={job.kind ? "no conversion needed" : `${job.ms} ms`}
              >
                {job.kind ? "already markdown" : `${job.ms} ms`}
              </span>
              <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Copy markdown" title="Copy markdown" onClick={copy}>
                {copied ? <Check className="size-4 text-fam-sheet" /> : <Copy className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Download .md" title="Download .md" onClick={onDownloadMd}>
                <Download className="size-4" />
              </Button>
              {supportsZip(job.format) && !job.restored && (
                <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Download .zip with images" title="Download .zip" onClick={onDownloadZip}>
                  <Archive className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-lg"
                className="min-h-11 min-w-11"
                aria-label="Chunk for RAG"
                title="Chunk for RAG"
                aria-expanded={chunkOpen}
                onClick={chunkOpen ? () => setChunkOpen(false) : openChunks}
              >
                <Scissors className="size-4" />
              </Button>
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
      {(chunkOpen && (chunks || chunkLoading)) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 rounded-lg border border-border bg-background p-3"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Chunk for RAG
            </p>
            <div
              className="flex rounded-lg border border-border bg-background p-0.5"
              role="group"
              aria-label="Chunk size in tokens"
            >
              {([256, 512, 1024] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => changeChunkSize(size)}
                  aria-pressed={chunkSize === size && customTokens === ""}
                  className={cn(
                    "min-h-10 rounded-md px-3 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
                    chunkSize === size && customTokens === ""
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {size}
                </button>
              ))}
              <input
                type="number"
                min={32}
                max={4096}
                value={customTokens}
                onChange={(e) => {
                  setCustomTokens(e.target.value);
                  void computeChunks();
                }}
                placeholder="custom"
                aria-label="Custom chunk size in tokens"
                className="min-h-10 w-24 rounded-md bg-transparent px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {chunkLoading ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                loading tokenizer…
              </span>
            ) : (
              <span className="font-mono text-[11px] text-steel">
                {chunks?.length ?? 0} chunk{chunks?.length === 1 ? "" : "s"} · ~
                {Math.round(
                  (chunks ?? []).reduce((s, c) => s + c.tokens, 0) / Math.max(1, chunks?.length ?? 1),
                )}{" "}
                {tokenLabel} avg
                {(chunks ?? []).filter((c) => c.meta.isTable).length > 0 && (
                  <>
                    {" "}
                    · {(chunks ?? []).filter((c) => c.meta.isTable).length} table
                    {(chunks ?? []).filter((c) => c.meta.isTable).length === 1 ? "" : "s"} kept
                    whole
                  </>
                )}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" className="min-h-10" onClick={() => void downloadChunks()}>
                <Archive className="size-3.5" aria-hidden />
                Download .zip
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-10"
                onClick={() => setChunkOpen(false)}
              >
                <X className="size-3.5" aria-hidden />
                Close
              </Button>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">overlap</span>
              <div
                className="flex rounded-lg border border-border bg-background p-0.5"
                role="group"
                aria-label="Overlap mode"
              >
                <button
                  onClick={() => {
                    setOverlapAuto(true);
                    void computeChunks();
                  }}
                  aria-pressed={overlapAuto}
                  className={cn(
                    "min-h-9 rounded-md px-2.5 font-mono text-[10px] uppercase tracking-wide transition-colors duration-150",
                    overlapAuto
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  auto ~10%
                </button>
                <button
                  onClick={() => {
                    setOverlapAuto(false);
                    void computeChunks();
                  }}
                  aria-pressed={!overlapAuto}
                  className={cn(
                    "min-h-9 rounded-md px-2.5 font-mono text-[10px] uppercase tracking-wide transition-colors duration-150",
                    !overlapAuto
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  manual
                </button>
              </div>
              {!overlapAuto && (
                <input
                  type="number"
                  min={0}
                  max={1024}
                  value={overlapTokens}
                  onChange={(e) => {
                    setOverlapTokens(e.target.value);
                    void computeChunks();
                  }}
                  placeholder="tokens"
                  aria-label="Overlap in tokens"
                  className="min-h-9 w-20 rounded-md border border-border bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
              )}
            </div>
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Counted with {tokenLabel} · 10–20% overlap is the common range — one published
              benchmark found zero benefit, so treat it as cheap insurance, not a guarantee.
            </p>
          </div>
        </motion.div>
      )}
      {active && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-muted/60">
          <div className="h-full w-1/4 bg-molten animate-shimmer" />
        </div>
      )}
    </motion.li>
  );
}
