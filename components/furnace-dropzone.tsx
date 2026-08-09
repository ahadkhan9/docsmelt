"use client";

import { useCallback, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FAMILY_FORMATS,
  FAMILY_LABEL,
  FAMILY_TOKEN,
  FamilyGlyph,
  type FormatFamily,
} from "@/lib/converter/formats";
import { cn } from "@/lib/utils";

const FAMILIES: FormatFamily[] = ["word", "pdf", "sheet", "slide", "book"];

/**
 * THE FURNACE — the signature element (design direction §6).
 * Dragging over it heats the frame; releasing feeds the smelt.
 * Keyboard: Enter/Space opens the picker. Paste works anywhere over it.
 */
export function FurnaceDropzone({
  compact = false,
  engine,
  onFiles,
}: {
  compact?: boolean;
  engine: "cold" | "loading" | "ready" | "error";
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const openPicker = useCallback(() => inputRef.current?.click(), []);
  const handleFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length > 0) handleFiles(e.clipboardData.files);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const glow = (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_100%,rgba(255,158,61,0.16),transparent_70%)] transition-opacity duration-200",
        dragActive ? "opacity-100" : "opacity-0",
      )}
    />
  );

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        if (e.target.files) handleFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <section
        role="button"
        tabIndex={0}
        aria-label="Add more documents — drop files here, paste, or choose files"
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openPicker}
        className={cn(
          "relative cursor-pointer select-none overflow-hidden rounded-xl border bg-card outline-none transition-colors duration-200",
          dragActive ? "border-molten" : "border-border",
        )}
      >
        {glow}
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Flame className="size-5 shrink-0 text-molten" aria-hidden />
            <p className="text-sm text-muted-foreground">Drop more documents to smelt, or</p>
            <Button
              variant="outline"
              size="sm"
              className="min-h-9"
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
            >
              Choose files
            </Button>
          </div>
          {engine === "loading" && (
            <div className="flex items-center gap-2" role="progressbar" aria-valuetext="Loading the conversion engine">
              <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 rounded-full bg-molten animate-shimmer" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                firing up
              </span>
            </div>
          )}
        </div>
        {input}
      </section>
    );
  }

  return (
    <section
      role="button"
      tabIndex={0}
      aria-label="Add documents — drop files here, paste, or choose files"
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={openPicker}
      className={cn(
        "relative cursor-pointer select-none overflow-hidden rounded-2xl border bg-card outline-none transition-colors duration-200",
        dragActive ? "border-molten" : "border-border",
      )}
    >
      {glow}
      <div className="relative flex flex-col items-center px-6 py-14 text-center sm:py-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Feed the furnace
        </p>
        <h1 className="mt-4 max-w-2xl text-balance font-display text-4xl font-semibold text-foreground sm:text-5xl">
          Smelt documents into markdown.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-steel">
          PDF, DOCX, XLSX, PPTX, RTF, EPUB, ODS, CSV — converted in your browser.
          Nothing is uploaded, so nothing can leak.
        </p>
        <div className="mt-8 flex items-center gap-2" aria-hidden>
          {FAMILIES.map((family) => (
            <span
              key={family}
              className="flex size-11 items-center justify-center rounded-xl border border-border bg-background"
              style={{ color: `var(--${FAMILY_TOKEN[family]})` }}
            >
              <FamilyGlyph family={family} />
            </span>
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground" aria-hidden>
          {FAMILIES.map((f) => FAMILY_LABEL[f]).join("  ·  ")}
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground" aria-hidden>
          {FAMILIES.map((f) => FAMILY_FORMATS[f]).join("  ·  ")}
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
          <Button
            size="lg"
            className="min-h-11 px-6"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
          >
            Choose files
          </Button>
          <p className="font-mono text-xs text-muted-foreground">or drop anywhere · paste</p>
        </div>
        {engine === "loading" && (
          <div className="mt-8 w-full max-w-sm">
            <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuetext="Loading the conversion engine">
              <div className="h-full w-1/3 rounded-full bg-molten animate-shimmer" />
            </div>
            <p className="mt-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Firing up — loading the conversion engine (one-time, ~6&nbsp;MB)
            </p>
          </div>
        )}
      </div>
      {input}
    </section>
  );
}
