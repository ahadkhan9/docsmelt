"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, List, X } from "lucide-react";
import { ChunkBlock, SectionBlock } from "./preview-blocks";
import { MarkdownView } from "./markdown";
import { chunkSummary, type RagChunk } from "@/lib/converter/chunk";
import { buildContents, rovingIndex } from "@/lib/converter/contents";
import { PreviewSelectorBar } from "./preview-selector-bar";
import { buildSelectorModel } from "@/lib/converter/selector";
import { parseSections, sectionForHeading } from "@/lib/converter/sections";
import { cn } from "@/lib/utils";

const supportsScrollDriven =
  typeof CSS !== "undefined" && typeof CSS.supports === "function"
    ? CSS.supports("animation-timeline", "scroll()")
    : false;

/**
 * The dedicated mobile preview — "The Contents Pouch"
 * (docs/mobile-preview.md). A fixed bottom-left Contents button opens a
 * TOC drawer (headings + chunks + Top). No sticky elements, no nested
 * scroll containers — the phone's ONLY navigation, always reachable.
 * The desktop navigated preview is untouched.
 */
export function MobilePreview({
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
  const contents = useMemo(() => buildContents(outline, chunks), [outline, chunks]);
  const selector = useMemo(() => buildSelectorModel(outline, chunks, tokenLabel), [outline, chunks, tokenLabel]);
  const paneRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeChunk, setActiveChunk] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  const chunkMode = Boolean(chunks && chunks.length > 0);

  // Scroll-spy on the pane (sections in Flow A, chunk blocks in Flow B).
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

  const goTop = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    paneRef.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    setOpen(false);
  }, []);

  const go = useCallback(
    (selector: string) => {
      jumpTo(selector);
      setOpen(false);
    },
    [jumpTo],
  );

  // Focus the close button on open; Esc closes.
  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(listRef.current?.querySelectorAll("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = rovingIndex(index < 0 ? 0 : index, buttons.length, event.key === "ArrowDown" ? 1 : -1);
    buttons[next]?.focus();
  };

  const spyValue = chunkMode
    ? activeChunk
      ? `chunk:${activeChunk}`
      : null
    : activeId
      ? `section:${activeId}`
      : null;

  const activeOutlineId =
    chunkMode && activeChunk && chunks
      ? (sectionForHeading(outline, chunks[activeChunk - 1]?.meta.headingPath ?? [])?.id ??
        activeId)
      : activeId;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* the Selector Bar — native select + pager + counter (Flow B: chunks,
          Flow A: sections); gated to ≥2 items */}
      <PreviewSelectorBar
        model={selector}
        value={spyValue ?? ""}
        kind={chunkMode ? "chunk" : "section"}
        onJump={jumpTo}
      />
      {/* content scroller — plain, no sticky, no nested scroll containers */}
      <div
        ref={paneRef}
        className="scroll-pane relative flex-1 touch-manipulation overflow-y-auto overscroll-contain scroll-thin bg-paper text-paper-foreground"
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
                <ChunkBlock key={chunk.index} chunk={chunk} stem={stem} tokenLabel={tokenLabel} />
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
              {outline.sections.map((section) => (
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

      {/* the fixed Contents button — thumb-reachable, never scrolls away */}
      <button
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open contents"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 z-40 flex h-12 items-center gap-2 rounded-full border border-molten/60 bg-background/95 px-4 font-mono text-[12px] uppercase tracking-wider text-foreground shadow-lg transition-colors duration-150 active:scale-[0.97]"
      >
        <List className="size-4 text-molten" aria-hidden />
        Contents
      </button>

      {/* the TOC drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-foundry/60"
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Contents"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-hidden rounded-t-2xl border-t border-border bg-card"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Contents
                  {summary ? ` · ${summary.count} chunks` : ` · ${outline.sections.length} sections`}
                </p>
                <button
                  ref={closeBtnRef}
                  onClick={() => setOpen(false)}
                  aria-label="Close contents"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <ul ref={listRef} onKeyDown={onListKeyDown} className="max-h-[calc(75dvh-3.5rem)] touch-manipulation overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] scroll-thin">
                {contents.map((item, i) => {
                  if (item.kind === "top") {
                    return (
                      <li key="top">
                        <button
                          onClick={goTop}
                          className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 font-mono text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                        >
                          <ArrowUp className="size-4" aria-hidden />
                          Top
                        </button>
                      </li>
                    );
                  }
                  if (item.kind === "chunks-head" || item.kind === "sections-head") {
                    return (
                      <li key={item.kind}>
                        <p className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {item.kind === "chunks-head" ? "Chunks" : "Sections"}
                        </p>
                      </li>
                    );
                  }
                  if (item.kind === "section") {
                    const active = activeOutlineId === item.id;
                    return (
                      <li key={`s-${item.id}`}>
                        <button
                          onClick={() => go(`[data-section="${item.id}"]`)}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] transition-colors duration-150",
                            active
                              ? "border-l-2 border-molten bg-molten/10 font-medium text-foreground"
                              : "border-l-2 border-transparent text-muted-foreground hover:text-foreground",
                          )}
                          style={{ paddingLeft: `${12 + (Math.min(item.level, 4) - 1) * 12}px` }}
                        >
                          <span className="font-display text-sm font-semibold leading-none text-muted-foreground/70">
                            {String(item.index).padStart(2, "0")}
                          </span>
                          <span className="truncate">{item.text}</span>
                        </button>
                      </li>
                    );
                  }
                  const active = activeChunk === item.index;
                  return (
                    <li key={`c-${item.index}`}>
                      <button
                        onClick={() => go(`[data-chunk="${item.index}"]`)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left font-mono text-[12px] transition-colors duration-150",
                          active
                            ? "border-l-2 border-molten bg-molten/10 font-medium text-foreground"
                            : "border-l-2 border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="tabular-nums">{String(item.index).padStart(2, "0")}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {item.tokens}
                        </span>
                        {item.heading && (
                          <span className="truncate text-muted-foreground">{item.heading}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
