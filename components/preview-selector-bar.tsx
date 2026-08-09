"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  activeValue,
  pagerFor,
  targetSelector,
  type SelectorModel,
} from "@/lib/converter/selector";

/**
 * The Selector Bar — a native <select> (optgrouped chunks / sections)
 * with a ‹ › pager and an always-visible counter, at the top of the
 * preview pane (mobile AND desktop). The open picker is the platform's
 * own chrome; the closed state is foundry. Gated: renders only with ≥2
 * selectable items.
 */
export function PreviewSelectorBar({
  model,
  value,
  kind,
  onJump,
}: {
  model: SelectorModel;
  value: string;
  kind: "chunk" | "section";
  onJump: (selector: string) => void;
}) {
  if (!model.visible) return null;

  const noun = kind === "chunk" ? "chunk" : "section";
  const current = activeValue(model, value);
  const index = model.items.findIndex((o) => o.value === current);
  const total = model.items.length;
  const prev = pagerFor(model, current, -1);
  const next = pagerFor(model, current, 1);

  const go = (v: string) => {
    const selector = targetSelector(v);
    if (selector) onJump(selector);
  };

  const arrow = (dir: "prev" | "next") => {
    const target = dir === "prev" ? prev : next;
    return (
      <button
        type="button"
        disabled={target.value === undefined}
        onClick={() => target.value && go(target.value)}
        aria-label={dir === "prev" ? `Previous ${noun}` : `Next ${noun}`}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:text-muted-foreground"
      >
        {dir === "prev" ? (
          <ChevronLeft className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-background px-3 py-1.5">
      {arrow("prev")}
      <select
        value={current}
        onChange={(e) => go(e.target.value)}
        aria-label={`Jump to ${noun}`}
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 font-mono text-[12px] text-foreground focus:border-ring focus:outline-none"
      >
        {model.groups.length > 0
          ? model.groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))
          : model.items.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
      </select>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {index + 1} / {total}
      </span>
      {arrow("next")}
    </div>
  );
}
