"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "./markdown";
import type { RagChunk } from "@/lib/converter/chunk";
import type { DocSection } from "@/lib/converter/sections";
import { MAX_TEXT_NODE_CHARS } from "@/lib/converter/preview";
import { cn, downloadBlob } from "@/lib/utils";

/** The section block — shared by the desktop and mobile previews. */
export function SectionBlock({ section }: { section: DocSection }) {
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
            {copied ? <Check className="size-3.5 text-paper-ok" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      )}
      <MarkdownView source={section.lines.join("\n")} />
    </section>
  );
}

/** The chunk block with its foundry-stamped divider — shared too. */
export function ChunkBlock({
  chunk,
  stem,
  tokenLabel,
  showHeading = true,
}: {
  chunk: RagChunk;
  stem: string;
  tokenLabel: string;
  /** Stamp the divider heading only on the first chunk of a same-heading run. */
  showHeading?: boolean;
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
      <div className="mb-3 flex items-center gap-2.5 rounded-r-md border-l-2 border-molten bg-paper-chip py-1.5 pl-3 pr-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-paper-muted">
          Chunk {String(chunk.index).padStart(2, "0")}
        </span>
        <span className="font-mono text-[11px] text-paper-muted">
          · {chunk.tokens} {tokenLabel}
        </span>
        {showHeading && headingTail && (
          <span className="truncate font-mono text-[11px] text-paper-muted">
            · {headingTail.replace(/^#{1,6} +/, "")}
          </span>
        )}
        {chunk.meta.oversizedTable && (
          <span className="font-mono text-[11px] uppercase tracking-wide text-paper-muted">
            · oversized table
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("min-h-10 min-w-10 text-paper-muted")}
            aria-label={`Copy chunk ${chunk.index}`}
            title="Copy chunk"
            onClick={copyChunk}
          >
            {copied ? (
              <Check className="size-3.5 text-paper-ok" />
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
      {chunk.content.length > MAX_TEXT_NODE_CHARS ? (
        <>
          <p className="mb-2 rounded-lg border border-dashed border-paper-line bg-paper-chip px-3 py-2 font-mono text-xs text-paper-muted">
            Chunk {chunk.index} is {chunk.content.length.toLocaleString()} chars — showing the
            first {MAX_TEXT_NODE_CHARS.toLocaleString()}. Use Copy or Download for the full chunk.
          </p>
          <pre className="my-0 whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
            {chunk.content.slice(0, MAX_TEXT_NODE_CHARS)}
          </pre>
        </>
      ) : (
        <MarkdownView source={chunk.content} />
      )}
    </section>
  );
}
