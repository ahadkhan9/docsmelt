"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "./markdown";
import { parseSections, type DocSection } from "@/lib/converter/sections";
import { cn } from "@/lib/utils";

const supportsScrollDriven =
  typeof CSS !== "undefined" && typeof CSS.supports === "function"
    ? CSS.supports("animation-timeline", "scroll()")
    : false;

/**
 * The navigated preview — "The Cargo Manifest" (docs/preview-design.md).
 * Bounded section blocks + an outline rail with scroll-spy + the molten
 * level rail (pure CSS scroll-driven where supported, transform-only JS
 * fallback). The pane scrolls, but it is navigated: every section is one
 * click away and position is always visible.
 */
export function NavigatedPreview({ markdown }: { markdown: string }) {
  const outline = useMemo(() => parseSections(markdown), [markdown]);
  const paneRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Scroll-spy: IntersectionObserver against the pane (no layout reads in
  // render; the entry nearest the top of the spy band wins).
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const sections = pane.querySelectorAll<HTMLElement>("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        let best = visible[0];
        for (const entry of visible) {
          if (entry.boundingClientRect.top < best.boundingClientRect.top) best = entry;
        }
        setActiveId(best.target.getAttribute("data-section"));
      },
      { root: pane, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [outline]);

  // Progress rail: CSS scroll-driven where supported, JS fallback otherwise.
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

  const jumpTo = useCallback((id: string) => {
    const el = paneRef.current?.querySelector(`[data-section="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const renderOutline = (compact: boolean) =>
    outline.sections.map((section) => (
      <button
        key={section.id}
        onClick={() => jumpTo(section.id)}
        aria-current={activeId === section.id ? "true" : undefined}
        className={cn(
          "min-h-9 w-full truncate rounded-md px-2 py-1.5 text-left transition-colors duration-150",
          section.level === 0 && "font-mono text-[11px]",
          activeId === section.id
            ? "bg-[#e4e8ea] font-medium text-paper-foreground"
            : "text-paper-muted hover:text-paper-foreground",
          compact ? "shrink-0 w-auto rounded-full border px-3 text-[11px]" : "",
        )}
        style={compact ? undefined : { paddingLeft: `${10 + (Math.min(section.level, 4) - 1) * 12}px` }}
      >
        {section.level > 0 ? section.text : "preamble"}
      </button>
    ));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* mobile outline — horizontal chips, no hover-only affordances */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-paper-line bg-[#f1f3f4] p-2 scroll-thin md:hidden">
        {renderOutline(true)}
      </div>
      <div className="relative flex min-h-0 flex-1">
        {/* outline rail (desktop) */}
        <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-paper-line bg-[#f1f3f4] p-3 scroll-thin md:block">
          <p className="font-mono text-[10px] uppercase tracking-wider text-paper-muted">
            Outline
          </p>
          <ul className="mt-2 space-y-0.5">{renderOutline(false)}</ul>
        </aside>
        {/* content scroller */}
        <div
          ref={paneRef}
          className="scroll-pane relative flex-1 overflow-y-auto overscroll-contain scroll-thin bg-paper text-paper-foreground"
        >
          <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
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
            className="min-h-9 min-w-9 text-paper-muted"
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
