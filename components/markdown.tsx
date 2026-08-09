"use client";

/**
 * The ingot's markdown renderer. GFM (tables from xlsx/odp matter) styled
 * for the paper surface. Embedded images arrive as alt-only (the engine
 * keeps the bytes for the .zip) — those render as a chip, never a 404.
 */
import { Image } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const EMBEDDED_SRC = /^(assets\/|#|$)/;

export function MarkdownView({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("text-[15px] leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _n, ...p }) => <h1 className="mb-3 mt-6 text-2xl font-bold" {...p} />,
          h2: ({ node: _n, ...p }) => <h2 className="mb-2 mt-5 text-xl font-bold" {...p} />,
          h3: ({ node: _n, ...p }) => <h3 className="mb-2 mt-4 text-lg font-semibold" {...p} />,
          h4: ({ node: _n, ...p }) => <h4 className="mb-2 mt-4 text-base font-semibold" {...p} />,
          h5: ({ node: _n, ...p }) => <h5 className="mb-2 mt-4 text-sm font-semibold" {...p} />,
          h6: ({ node: _n, ...p }) => <h6 className="mb-2 mt-4 text-sm font-semibold" {...p} />,
          p: ({ node: _n, ...p }) => <p className="mb-4" {...p} />,
          a: ({ node: _n, ...p }) => (
            <a
              className="text-link underline underline-offset-2 hover:opacity-80"
              target="_blank"
              rel="noopener noreferrer"
              {...p}
            />
          ),
          ul: ({ node: _n, ...p }) => <ul className="mb-4 list-disc space-y-1 pl-6" {...p} />,
          ol: ({ node: _n, ...p }) => <ol className="mb-4 list-decimal space-y-1 pl-6" {...p} />,
          li: ({ node: _n, ...p }) => <li className="leading-relaxed" {...p} />,
          blockquote: ({ node: _n, ...p }) => (
            <blockquote className="mb-4 border-l-2 border-paper-line pl-4 text-paper-muted" {...p} />
          ),
          hr: ({ node: _n, ...p }) => <hr className="my-6 border-paper-line" {...p} />,
          strong: ({ node: _n, ...p }) => <strong className="font-semibold" {...p} />,
          em: ({ node: _n, ...p }) => <em {...p} />,
          code: ({ node: _n, className: c, ...p }) =>
            c?.includes("language-") ? (
              <code className={c} {...p} />
            ) : (
              <code className="rounded bg-[#e9ecee] px-1 py-0.5 font-mono text-[0.85em]" {...p} />
            ),
          pre: ({ node: _n, ...p }) => (
            <pre
              className="mb-4 overflow-x-auto rounded-lg border border-paper-line bg-[#f1f3f4] p-4 font-mono text-[13px] leading-relaxed scroll-thin"
              {...p}
            />
          ),
          table: ({ node: _n, ...p }) => (
            <div className="mb-4 overflow-x-auto scroll-thin">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          thead: ({ node: _n, ...p }) => <thead {...p} />,
          tbody: ({ node: _n, ...p }) => <tbody {...p} />,
          tr: ({ node: _n, ...p }) => <tr className="border-b border-paper-line" {...p} />,
          th: ({ node: _n, ...p }) => (
            <th className="border border-paper-line bg-[#eceef0] px-3 py-2 text-left font-semibold" {...p} />
          ),
          td: ({ node: _n, ...p }) => <td className="border border-paper-line px-3 py-2 align-top" {...p} />,
          img: ({ node: _n, src, alt, ...p }) => {
            // react-markdown types src/alt as string | Blob — a Blob or an
            // asset-reference src is an embedded image (alt-only in the md).
            const embedded =
              src instanceof Blob || EMBEDDED_SRC.test(typeof src === "string" ? src : "");
            return embedded ? (
              <span className="my-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-dashed border-paper-line bg-[#f1f3f4] px-3 py-2 text-sm text-paper-muted">
                <Image className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{typeof alt === "string" && alt ? alt : "Embedded image"}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide">in the .zip</span>
              </span>
            ) : (
              <img
                src={typeof src === "string" ? src : undefined}
                alt={typeof alt === "string" ? alt : ""}
                className="my-4 max-w-full rounded-lg border border-paper-line"
                {...p}
              />
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
