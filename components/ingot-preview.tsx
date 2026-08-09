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
import { DocumentPreview } from "./document-preview";
import { announce } from "@/lib/announce";
import { HUGE_MD_CHARS, RAW_PREVIEW_CHARS, MAX_TEXT_NODE_CHARS, segmentText } from "@/lib/converter/preview";
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
  onDownloadChunksZip,
  onRetry,
  onRemove,
}: {
  job: JobView | null;
  chunkSettings: ChunkSettings;
  onChunkSettings: (next: ChunkSettings) => void;
  onDownloadMd: (id: string) => void;
  onDownloadZip: (id: string) => void;
  onDownloadChunksZip: (id: string) => void;
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
      announce("Copied markdown");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the .md download remains the fallback
    }
  };

  // ArrowLeft/ArrowRight roving selection for the rendered/raw tabs.
  const onTabsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = tab === "rendered" ? "raw" : "rendered";
    setTab(next);
    document.getElementById(next === "raw" ? "preview-tab-raw" : "preview-tab-rendered")?.focus();
  };

  if (!job) {
    return (
      <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 text-center lg:h-[var(--ingot-h,600px)] lg:max-h-[85dvh]">
        <p className="font-display text-2xl font-semibold text-muted-foreground">
          Your markdown lands here.
        </p>
        <p className="max-w-sm font-mono text-xs leading-relaxed text-muted-foreground">
          Select a converted file to preview — rendered or raw.
        </p>
      </div>
    );
  }

  const family = job.format ? FAMILY_OF[job.format] : undefined;
  const active =
    job.status === "queued" || job.status === "detecting" || job.status === "smelting" ||
    job.status === "packing";
  // Large markdown would freeze react-markdown's synchronous parse on the
  // main thread — huge docs are AUTO-CHUNKED and previewed as bounded chunk
  // blocks instead of a raw wall (chunking is locked on for them).
  const huge = (job.markdown?.length ?? 0) > HUGE_MD_CHARS;
  const empty = job.status === "done" && (job.chars ?? 0) === 0;
  const error =
    job.status === "failed"
      ? refine(job.file.name, job.format, (job.code ?? "engine") as ErrorKind)
      : null;
  // Auto-chunked preview is pending while the worker runs and no chunks exist.
  const chunkingLarge =
    huge &&
    job.chunksStatus !== "done" &&
    !(job.chunks && job.chunks.length > 0);
  // In-place re-chunk of an already-chunked huge doc (settings probe).
  const chunking = huge && job.chunksStatus === "running";

  return (
    <div className="flex h-[60dvh] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:h-[var(--ingot-h,600px)] lg:max-h-[85dvh]">
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
                : `${(job.chars ?? 0).toLocaleString()} chars`
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
            <div
              className="flex rounded-lg border border-border bg-background p-0.5"
              role="tablist"
              aria-label="Preview mode"
              onKeyDown={onTabsKeyDown}
            >
              {(["rendered", "raw"] as const).map((t) => (
                <button
                  key={t}
                  id={t === "rendered" ? "preview-tab-rendered" : "preview-tab-raw"}
                  role="tab"
                  aria-selected={tab === t}
                  aria-controls="preview-panel"
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => {
                    setTab(t);
                    if (t === "raw" && huge)
                      announce(
                        `Large output — showing the first ${RAW_PREVIEW_CHARS.toLocaleString()} characters. Download the .md for the full file.`,
                      );
                  }}
                  className={cn(
                    "min-h-10 rounded-md px-3 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
                    tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {!huge ? (
              <button
                role="switch"
                aria-checked={chunkSettings.enabled}
                aria-label="Toggle chunking — split the preview into token-bounded chunks"
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
            ) : (
              /* huge docs: chunking is locked on — a static status stamp */
              <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-molten bg-molten/10 px-3 font-mono text-[11px] uppercase tracking-wide text-molten">
                <span aria-hidden className="size-1.5 rounded-full bg-molten" />
                Auto-chunked
              </span>
            )}
            {(chunkSettings.enabled || huge) && (
              <Button
                variant="ghost"
                size="icon-lg"
                className="min-h-11 min-w-11"
                aria-label={huge ? "Edit chunk settings — auto-chunking is on" : "Edit chunk settings"}
                title="Edit chunk settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <Settings2 className="size-4" />
              </Button>
            )}
            <Button
              variant="secondary"
              className="min-h-10"
              aria-label="Copy markdown"
              title="Copy markdown"
              onClick={copy}
            >
              {copied ? <Check className="size-4 text-fam-sheet" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
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

      {(chunkSettings.enabled || huge) && settingsOpen && (
        <ChunkSettingsStrip
          settings={chunkSettings}
          onChange={onChunkSettings}
          hasChunks={(job.chunks?.length ?? 0) > 0}
          onDownloadChunksZip={() => onDownloadChunksZip(job.id)}
        />
      )}

      {job.markdown ? (
        <motion.div
          key={job.id}
          role="tabpanel"
          id="preview-panel"
          aria-labelledby={tab === "rendered" ? "preview-tab-rendered" : "preview-tab-raw"}
          aria-busy={huge && job.chunksStatus === "running" ? true : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="min-h-0 flex-1 overflow-hidden"
        >
          {empty ? (
            <div className="flex h-full items-center justify-center bg-paper">
              <p className="font-mono text-sm text-paper-muted">
                No text content was extracted.
              </p>
            </div>
          ) : tab === "rendered" && chunkingLarge ? (
            job.chunksStatus === "error" ? (
              <div
                role="alert"
                className="flex h-full flex-col items-center justify-center gap-4 bg-paper px-6"
              >
                <CircleAlert className="size-9 text-fam-pdf" aria-hidden />
                <div className="text-center">
                  <h2 className="text-base font-semibold text-paper-foreground">Chunking failed</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-paper-muted">
                    Couldn&apos;t split this large document into chunks. The raw text and the .md
                    download still work.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="min-h-11" onClick={() => setTab("raw")}>
                    Show raw
                  </Button>
                  <Button variant="ghost" className="min-h-11" onClick={() => onDownloadMd(job.id)}>
                    Download .md
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 bg-paper">
                <div
                  className="h-1 w-40 overflow-hidden rounded-full bg-paper-line"
                  role="progressbar"
                  aria-label="Chunking"
                  aria-valuetext="chunking — working"
                >
                  <div className="h-full w-1/3 rounded-full bg-molten animate-shimmer" />
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-paper-muted">
                  chunking…
                </p>
                <p className="max-w-sm text-center font-mono text-xs leading-relaxed text-paper-muted">
                  Splitting the document into token-bounded chunks — headings, tables, and code
                  fences stay intact.
                </p>
              </div>
            )
          ) : tab === "rendered" ? (
            <DocumentPreview
              markdown={job.markdown}
              chunks={job.chunks ?? null}
              huge={huge}
              chunking={chunking}
              stem={job.file.name.replace(/\.[^.]+$/, "") || "document"}
              tokenLabel={
                job.chunkEncoding === "chars/4 estimate" ? "tokens (estimate)" : "cl100k tokens"
              }
            />
          ) : (
            <RawPreview
              markdown={job.markdown}
              truncated={huge}
              onDownloadMd={() => onDownloadMd(job.id)}
            />
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
            <Button variant="secondary" className="min-h-11" onClick={() => onRetry(job.id)}>
              <RotateCcw className="size-4" aria-hidden />
              Retry
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => onRemove(job.id)}>
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Converting" aria-valuetext={`${job.status} — working`}>
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

/**
 * Bounded raw tab. Never mounts a giant text node: content is split into
 * MAX_TEXT_NODE_CHARS segments, each with [content-visibility:auto] so only
 * in-fold segments lay out. Huge docs are capped at RAW_PREVIEW_CHARS with an
 * honest note + a real .md download button. Segments stack flush (my-0) so
 * the raw wall reads as ONE continuous surface. Applies to ALL docs — a
 * 900k non-huge raw view is segmented too.
 */
function RawPreview({
  markdown,
  truncated,
  onDownloadMd,
}: {
  markdown: string;
  truncated: boolean;
  onDownloadMd: () => void;
}) {
  // Line-seam cut so the preview never starts mid-line.
  const cut = truncated ? markdown.lastIndexOf("\n", RAW_PREVIEW_CHARS) : markdown.length;
  const shown = truncated ? markdown.slice(0, cut > 0 ? cut : RAW_PREVIEW_CHARS) : markdown;
  const segs = segmentText(shown, MAX_TEXT_NODE_CHARS);
  return (
    <div className="h-full overflow-y-auto scroll-thin scroll-thin-on-paper [scrollbar-gutter:stable] bg-paper text-paper-foreground">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        {truncated && (
          <p
            role="note"
            className="mb-4 rounded-lg border border-dashed border-paper-line bg-paper-chip px-3 py-2 font-mono text-xs leading-relaxed text-paper-muted"
          >
            Large output — showing the first {shown.length.toLocaleString()} of{" "}
            {markdown.length.toLocaleString()} characters.{" "}
            <button
              type="button"
              onClick={onDownloadMd}
              className="underline underline-offset-2 hover:text-paper-foreground"
            >
              Download the .md
            </button>{" "}
            for the full file.
          </p>
        )}
        {segs.map((s, i) => (
          <pre
            key={i}
            className="my-0 whitespace-pre-wrap font-mono text-[13px] leading-relaxed [content-visibility:auto] [contain-intrinsic-size:auto_8000px]"
          >
            {s}
          </pre>
        ))}
      </div>
    </div>
  );
}
