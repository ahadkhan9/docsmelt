"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Archive,
  Check,
  CircleAlert,
  Copy,
  Download,
  FileText,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChunkSettingsStrip } from "./chunk-settings";
import { MarkdownView } from "./markdown";
import { DocumentPreview } from "./document-preview";
import { refine, type ErrorKind } from "@/lib/converter/errors";
import { FAMILY_OF, FAMILY_TOKEN, FamilyGlyph, supportsZip } from "@/lib/converter/formats";
import type { ChunkSettings, JobView } from "@/lib/converter/useConverter";
import { cn } from "@/lib/utils";

/**
 * The INGOT — the bright paper surface where converted markdown lands
 * (design direction §5/§6). Dark foundry frame, paper reading surface.
 */
export function IngotPreview({
  job,
  chunkSettings,
  onChunkSettings,
  onDownloadMd,
  onDownloadZip,
  onRetry,
  onRemove,
}: {
  job: JobView | null;
  chunkSettings: ChunkSettings;
  onChunkSettings: (next: ChunkSettings) => void;
  onDownloadMd: (id: string) => void;
  onDownloadZip: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [tab, setTab] = useState<"rendered" | "raw">("rendered");
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const copy = async () => {
    if (!job?.markdown) return;
    try {
      await navigator.clipboard.writeText(job.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the .md download remains the fallback
    }
  };

  if (!job) {
    return (
      <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 text-center lg:h-[600px]">
        <p className="font-display text-2xl font-semibold text-muted-foreground">
          Select a converted file.
        </p>
        <p className="max-w-sm font-mono text-xs leading-relaxed text-muted-foreground">
          Its markdown lands here — rendered or raw.
        </p>
      </div>
    );
  }

  const family = job.format ? FAMILY_OF[job.format] : undefined;
  const active =
    job.status === "queued" || job.status === "detecting" || job.status === "smelting" ||
    job.status === "packing";
  // Large markdown would freeze react-markdown's synchronous parse on the
  // main thread — show raw text instead (the .md download has it all).
  const huge = (job.markdown?.length ?? 0) > 1_000_000;
  const empty = job.status === "done" && (job.chars ?? 0) === 0;
  const error =
    job.status === "failed"
      ? refine(job.file.name, job.format, (job.code ?? "engine") as ErrorKind)
      : null;

  return (
    <div className="flex h-[60dvh] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:h-[600px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background"
          style={{ color: family ? `var(--${FAMILY_TOKEN[family]})` : "var(--muted-foreground)" }}
          aria-hidden
        >
          {job.kind ? (
            <FileText className="size-4" />
          ) : family ? (
            <FamilyGlyph family={family} />
          ) : (
            <CircleAlert className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{job.file.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {job.markdown
              ? job.kind
                ? `already markdown · ${(job.chars ?? 0).toLocaleString()} chars`
                : `${(job.chars ?? 0).toLocaleString()} chars${job.ms ? ` · ${job.ms} ms` : ""}`
              : active
                ? job.status === "smelting"
                  ? "smelting…"
                  : `${job.status}…`
                : job.status}
            {job.format ? ` · ${job.format}` : ""}
          </p>
        </div>
        {job.markdown && (
          <>
            {!huge && (
              <div
                className="flex rounded-lg border border-border bg-background p-0.5"
                role="tablist"
                aria-label="Preview mode"
              >
                {(["rendered", "raw"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "min-h-10 rounded-md px-3 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
                      tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            {!huge && (
              <button
                role="switch"
                aria-checked={chunkSettings.enabled}
                onClick={() => onChunkSettings({ ...chunkSettings, enabled: !chunkSettings.enabled })}
                className={cn(
                  "min-h-10 rounded-lg border px-3 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
                  chunkSettings.enabled
                    ? "border-molten bg-molten/10 text-molten"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Chunking {chunkSettings.enabled ? "on" : "off"}
              </button>
            )}
            {chunkSettings.enabled && (
              <Button
                variant="ghost"
                size="icon-lg"
                className="min-h-11 min-w-11"
                aria-label="Edit chunk settings"
                title="Edit chunk settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <Settings2 className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              className="min-h-11 min-w-11"
              aria-label="Copy markdown"
              title="Copy markdown"
              onClick={copy}
            >
              {copied ? <Check className="size-4 text-fam-sheet" /> : <Copy className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="min-h-11 min-w-11"
              aria-label="Download markdown (.md)"
              title="Download .md"
              onClick={() => onDownloadMd(job.id)}
            >
              <Download className="size-4" />
            </Button>
            {supportsZip(job.format) && !job.restored && (
              <Button
                variant="ghost"
                size="icon-lg"
                className="min-h-11 min-w-11"
                aria-label="Download markdown and embedded images (.zip)"
                title="Download .zip with images"
                onClick={() => onDownloadZip(job.id)}
              >
                <Archive className="size-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {chunkSettings.enabled && settingsOpen && (
        <ChunkSettingsStrip settings={chunkSettings} onChange={onChunkSettings} />
      )}

      {job.markdown ? (
        <motion.div
          key={job.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="min-h-0 flex-1 overflow-hidden"
        >
          {huge ? (
            <div className="h-full overflow-y-auto scroll-thin bg-paper text-paper-foreground">
              <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
                <p className="mb-4 rounded-lg border border-dashed border-paper-line bg-[#f1f3f4] px-3 py-2 font-mono text-xs text-paper-muted">
                  Large output — shown as raw text. Download the .md for the full file.
                </p>
                <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
                  {job.markdown}
                </pre>
              </div>
            </div>
          ) : empty ? (
            <div className="flex h-full items-center justify-center bg-paper">
              <p className="font-mono text-sm text-paper-muted">
                No text content was extracted.
              </p>
            </div>
          ) : tab === "rendered" ? (
            <DocumentPreview
              markdown={job.markdown}
              chunks={job.chunks ?? null}
              stem={job.file.name.replace(/\.[^.]+$/, "") || "document"}
              tokenLabel={
                job.chunkEncoding === "chars/4 estimate" ? "tokens (estimate)" : "cl100k tokens"
              }
            />
          ) : (
            <div className="h-full overflow-y-auto scroll-thin bg-paper text-paper-foreground">
              <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
                <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
                  {job.markdown}
                </pre>
              </div>
            </div>
          )}
        </motion.div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <CircleAlert className="size-9 text-fam-pdf" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-foreground">{error.title}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {error.hint}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onRetry(job.id)}>
              <RotateCcw className="size-4" aria-hidden />
              Retry
            </Button>
            <Button variant="ghost" onClick={() => onRemove(job.id)}>
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuetext={`${job.status} — working`}>
            <div className="h-full w-1/3 rounded-full bg-molten animate-shimmer" />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {job.status === "smelting"
              ? "smelting…"
              : job.status === "packing"
                ? "packing assets…"
                : `${job.status}…`}
          </p>
        </div>
      )}
    </div>
  );
}
