"use client";

import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChunkSettings } from "@/lib/converter/useConverter";
import { cn } from "@/lib/utils";

/**
 * The chunk-settings strip — the Flow B controls (presets + custom +
 * overlap). Every change re-chunks the selected job instantly (cheap,
 * in-memory). This is the SINGLE chunking surface: the per-row panel is
 * gone, and "Chunks .zip" is the one chunk-export path (uses the global
 * settings above). Copy states the honest overlap guidance.
 */
export function ChunkSettingsStrip({
  settings,
  onChange,
  hasChunks = false,
  onDownloadChunksZip,
}: {
  settings: ChunkSettings;
  onChange: (next: ChunkSettings) => void;
  hasChunks?: boolean;
  onDownloadChunksZip?: () => void;
}) {
  const presets: ChunkSettings["preset"][] = [256, 512, 1024];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 bg-card/40 px-4 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Chunk settings
      </span>
      <div
        className="flex rounded-lg border border-border bg-background p-0.5"
        role="group"
        aria-label="Chunk size in tokens"
      >
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onChange({ ...settings, preset })}
            aria-pressed={settings.preset === preset && !settings.customTokens}
            className={cn(
              "min-h-10 rounded-md px-3 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
              settings.preset === preset && !settings.customTokens
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {preset}
          </button>
        ))}
        <input
          type="number"
          min={32}
          max={4096}
          value={settings.customTokens ?? ""}
          onChange={(e) => onChange({ ...settings, customTokens: e.target.value })}
          placeholder="custom"
          aria-label="Custom chunk size in tokens"
          className="min-h-10 w-24 rounded-md bg-transparent px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">overlap</span>
        <div
          className="flex rounded-lg border border-border bg-background p-0.5"
          role="group"
          aria-label="Overlap mode"
        >
          <button
            onClick={() => onChange({ ...settings, overlapAuto: true })}
            aria-pressed={settings.overlapAuto}
            className={cn(
              "min-h-10 rounded-md px-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
              settings.overlapAuto
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            auto ~10%
          </button>
          <button
            onClick={() => onChange({ ...settings, overlapAuto: false })}
            aria-pressed={!settings.overlapAuto}
            className={cn(
              "min-h-10 rounded-md px-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
              !settings.overlapAuto
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            manual
          </button>
        </div>
        {!settings.overlapAuto && (
          <input
            type="number"
            min={0}
            max={1024}
            value={settings.overlapTokens ?? ""}
            onChange={(e) => onChange({ ...settings, overlapTokens: e.target.value })}
            placeholder="tokens"
            aria-label="Overlap in tokens"
            className="min-h-10 w-20 rounded-md border border-border bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        )}
      </div>
      {hasChunks && onDownloadChunksZip && (
        <Button
          variant="outline"
          size="sm"
          className="ml-auto min-h-10"
          onClick={onDownloadChunksZip}
          title="Download all chunks as numbered .md files in one .zip"
        >
          <Archive className="size-3.5" aria-hidden />
          Chunks .zip
        </Button>
      )}
      <p className="w-full font-mono text-[11px] leading-relaxed text-muted-foreground">
        Counted with cl100k tokens · 10–20% overlap is the common range — one published benchmark
        found zero benefit, so treat it as cheap insurance, not a guarantee.
      </p>
    </div>
  );
}
