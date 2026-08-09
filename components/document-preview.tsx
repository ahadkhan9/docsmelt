"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "./markdown";
import { chunkSummary, type RagChunk } from "@/lib/converter/chunk";
import { parseSections, sectionForHeading, type DocSection } from "@/lib/converter/sections";
import { cn, downloadBlob } from "@/lib/utils";

const supportsScrollDriven =
  typeof CSS !== "undefined" && typeof CSS.supports === "function"
    ? CSS.supports("animation-timeline", "scroll()")
    : false;

/**
 * The document preview — "The Cargo Manifest" (docs/preview-design.md).
 * One shell, two granularities:
 *  - Flow A (no chunks): bounded section blocks + outline rail (scroll-spy)
 *    + the molten level rail.
 *  - Flow B (chunks present): the same shell with chunk blocks — stamped
 *    dividers (number · tokens · heading), a chunk rail with keyboard
 *    navigation, per-chunk copy/download — and the outline still highlights
 *    the section the active chunk belongs to (via its headingPath).
 */
export function DocumentPreview({
  markdown,
  chunks,
  stem,
  tokenLabel = "cl100k tokens",
}: {
  markdown: string;
  chunks?: RagChunk[] | null;
  stem: string;
  tokenLabel?: string;
}) {
  const outline = useMemo(() => parseSections(markdown), [markdown]);
  const summary = useMemo(() => (chunks ? chunkSummary(chunks) : null), [chunks]);
  const paneRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLUListElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeChunk, setActiveChunk] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const chunkMode = Boolean(chunks && chunks.length > 0);

  // Scroll-spy: sections in Flow A, chunk blocks in Flow B. The active
  // chunk maps back to its section via headingPath (one map, two levels).
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const targets = pane.querySelectorAll<HTMLElement>("[data-section], [data-chunk]");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        let best = visible[0];
        for (const entry of visible) {
          if (entry.boundingClientRect.top < best.boundingClientRect.top) best = entry;
        }
        const el = best.target;
        if (el.hasAttribute("data-chunk")) {
          const chunkIndex = Number(el.getAttribute("data-chunk"));
          setActiveChunk(chunkIndex);
          const chunk = chunks?.[chunkIndex - 1];
          if (chunk) {
            const section = sectionForHeading(outline, chunk.meta.headingPath);
            setActiveId(section?.id ?? null);
          }
        } else {
          setActiveId(el.getAttribute("data-section"));
        }
      },
      { root: pane, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [outline, chunks]);

  // Progress rail: CSS scroll-driven where supported, transform-only JS.
  useEffect(() => {
    if (supportsScrollDriven) return;
    const pane = paneRef.current;
    if (!pane) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = pane.scrollHeight - pane.clientHeight;
        setProgress(max > 0 ? pane.scrollTop / max : 0);
      });
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      pane.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const jumpTo = useCallback((selector: string) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    paneRef.current
      ?.querySelector(selector)
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, []);

  const onRailKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(railRef.current?.querySelectorAll("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    if (next >= 0 && next < buttons.length) buttons[next].focus();
  };

  const outlineItems = outline.sections;
  const activeOutlineId =
    chunkMode && activeChunk && chunks
      ? (sectionForHeading(outline, chunks[activeChunk - 1]?.meta.headingPath ?? [])?.id ??
        activeId)
      : activeId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* mobile navigation — chips, touch-scrollable, no hover-only */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-paper-line bg-[#f1f3f4] p-2 scroll-thin md:hidden">
        {chunkMode && chunks ? (
          chunks.map((chunk) => (
            <button
              key={chunk.index}
              onClick={() => jumpTo(`[data-chunk="${chunk.index}"]`)}
              aria-current={activeChunk === chunk.index ? "true" : undefined}
              className={cn(
                "min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 font-mono text-[11px] transition-colors duration-150",
                activeChunk === chunk.index
                  ? "border-molten bg-molten/10 text-paper-foreground"
                  : "border-paper-line text-paper-muted hover:text-paper-foreground",
              )}
            >
              {chunk.index}
            </button>
          ))
        ) : (
          outlineItems.map((section) => (
            <button
              key={section.id}
              onClick={() => jumpTo(`[data-section="${section.id}"]`)}
              aria-current={activeOutlineId === section.id ? "true" : undefined}
              className={cn(
                "min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 font-mono text-[11px] transition-colors duration-150",
                activeOutlineId === section.id
                  ? "border-molten bg-molten/10 text-paper-foreground"
                  : "border-paper-line text-paper-muted hover:text-paper-foreground",
              )}
            >
              {section.level > 0 ? section.text : "preamble"}
            </button>
          ))
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* left rail — outline (Flow A) or chunks (Flow B) */}
        <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-paper-line bg-[#f1f3f4] p-3 scroll-thin md:block">
          <p className="font-mono text-[10px] uppercase tracking-wider text-paper-muted">
            {chunkMode ? "Chunks" : "Outline"}
          </p>
          {chunkMode && chunks ? (
            <ul ref={railRef} onKeyDown={onRailKeyDown} className="mt-2 space-y-0.5">
              {chunks.map((chunk) => (
                <li key={chunk.index}>
                  <button
                    onClick={() => jumpTo(`[data-chunk="${chunk.index}"]`)}
                    aria-current={activeChunk === chunk.index ? "true" : undefined}
                    className={cn(
                      "flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150",
                      activeChunk === chunk.index
                        ? "bg-[#e4e8ea] font-medium text-paper-foreground"
                        : "text-paper-muted hover:text-paper-foreground",
                    )}
                  >
                    <span className="font-mono text-[11px] tabular-nums">
                      {String(chunk.index).padStart(2, "0")}
                    </span>
                    <span className="truncate font-mono text-[11px]">{chunk.tokens}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-2 space-y-0.5">
              {outlineItems.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => jumpTo(`[data-section="${section.id}"]`)}
                    aria-current={activeOutlineId === section.id ? "true" : undefined}
                    className={cn(
                      "min-h-10 w-full truncate rounded-md px-2 py-1.5 text-left transition-colors duration-150",
                      section.level === 0 && "font-mono text-[11px]",
                      activeOutlineId === section.id
                        ? "bg-[#e4e8ea] font-medium text-paper-foreground"
                        : "text-paper-muted hover:text-paper-foreground",
                    )}
                    style={{
                      paddingLeft: `${10 + (Math.min(section.level, 4) - 1) * 12}px`,
                    }}
                  >
                    {section.level > 0 ? section.text : "preamble"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* content scroller */}
        <div
          ref={paneRef}
          className="scroll-pane relative flex-1 overflow-y-auto overscroll-contain scroll-thin bg-paper text-paper-foreground"
        >
          <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
            {chunkMode && chunks ? (
              <>
                {summary && (
                  <p className="mb-4 font-mono text-[11px] text-paper-muted">
                    {summary.count} chunks · ~{summary.avgTokens} {tokenLabel} avg
                    {summary.tablesKept > 0
                      ? ` · ${summary.tablesKept} table${summary.tablesKept === 1 ? "" : "s"} kept whole`
                      : ""}
                    {summary.oversized > 0 ? ` · ${summary.oversized} oversized` : ""}
                  </p>
                )}
                {chunks.map((chunk) => (
                  <ChunkBlock
                    key={chunk.index}
                    chunk={chunk}
                    stem={stem}
                    tokenLabel={tokenLabel}
                  />
                ))}
              </>
            ) : (
              <>
                {outline.preambleLines.length > 0 && (
                  <section
                    data-section="preamble"
                    className="scroll-mt-4 border-b border-paper-line/70 pb-6 pt-2 last:border-0 [content-visibility:auto] [contain-intrinsic-size:auto_200px]"
                  >
                    <MarkdownView source={outline.preambleLines.join("\n")} />
                  </section>
                )}
                {outlineItems.map((section) => (
                  <SectionBlock key={section.id} section={section} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* the molten level rail */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-0 w-0.5 bg-paper-line/70"
        >
          <div
            className={cn(
              "h-full w-full origin-top bg-molten",
              supportsScrollDriven ? "level-rail-fill" : "",
            )}
            style={supportsScrollDriven ? undefined : { transform: `scaleY(${progress})` }}
          />
        </div>
      </div>
    </div>
  );
}

function SectionBlock({ section }: { section: DocSection }) {
  const [copied, setCopied] = useState(false);

  const copySection = async () => {
    try {
      await navigator.clipboard.writeText(section.lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — .md download is the fallback
    }
  };

  return (
    <section
      data-section={section.id}
      className="scroll-mt-4 border-b border-paper-line/70 pb-6 pt-2 last:border-0 [content-visibility:auto] [contain-intrinsic-size:auto_320px]"
    >
      {section.level > 0 && (
        <div className="mb-2 flex items-center gap-2.5">
          <span className="font-display text-lg font-semibold leading-none text-paper-muted/80">
            {String(section.index).padStart(2, "0")}
          </span>
          <span aria-hidden className="h-px flex-1 bg-paper-line" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="min-h-10 min-w-10 text-paper-muted"
            aria-label={`Copy section: ${section.text}`}
            title="Copy section"
            onClick={copySection}
          >
            {copied ? <Check className="size-3.5 text-fam-sheet" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      )}
      <MarkdownView source={section.lines.join("\n")} />
    </section>
  );
}

function ChunkBlock({
  chunk,
  stem,
  tokenLabel,
}: {
  chunk: RagChunk;
  stem: string;
  tokenLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyChunk = async () => {
    try {
      await navigator.clipboard.writeText(chunk.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — .md download is the fallback
    }
  };
  const downloadChunk = () => {
    downloadBlob(
      new Blob([`${chunk.content}\n`], { type: "text/markdown;charset=utf-8" }),
      `${stem}-${String(chunk.index).padStart(3, "0")}.md`,
    );
  };

  const headingTail = chunk.meta.headingPath[chunk.meta.headingPath.length - 1] ?? "";

  return (
    <section
      data-chunk={chunk.index}
      className="scroll-mt-4 pb-6 pt-2 [content-visibility:auto] [contain-intrinsic-size:auto_320px]"
    >
      <div className="mb-3 flex items-center gap-2.5 rounded-r-md border-l-2 border-molten bg-[#f1f3f4] py-1.5 pl-3 pr-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-paper-muted">
          Chunk {String(chunk.index).padStart(2, "0")}
        </span>
        <span className="font-mono text-[10px] text-paper-muted">
          · {chunk.tokens} {tokenLabel}
        </span>
        {headingTail && (
          <span className="truncate font-mono text-[10px] text-paper-muted">
            · {headingTail.replace(/^#{1,6} +/, "")}
          </span>
        )}
        {chunk.meta.oversizedTable && (
          <span className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">
            · oversized table
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="min-h-10 min-w-10 text-paper-muted"
            aria-label={`Copy chunk ${chunk.index}`}
            title="Copy chunk"
            onClick={copyChunk}
          >
            {copied ? (
              <Check className="size-3.5 text-fam-sheet" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="min-h-10 min-w-10 text-paper-muted"
            aria-label={`Download chunk ${chunk.index} as .md`}
            title="Download chunk"
            onClick={downloadChunk}
          >
            <Download className="size-3.5" />
          </Button>
        </span>
      </div>
      <MarkdownView source={chunk.content} />
    </section>
  );
}
