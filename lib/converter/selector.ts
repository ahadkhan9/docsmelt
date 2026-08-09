/**
 * The Selector Bar model — chunks/sections as a native-select option set
 * with optgroups, plus pager boundaries (docs/preview-layout-research.md,
 * round 7 build). Pure and unit-tested; the bar component renders this.
 */
import type { RagChunk } from "./chunk";
import type { DocOutline } from "./sections";

export interface SelectorOption {
  /** `chunk:12` (Flow B) or `section:<id>` (Flow A). */
  value: string;
  /** `Chunk 12 · 512 tok · Budget` / `03 · Budget`. */
  label: string;
  /** Optgroup label (Flow B: the chunk's top-level heading). */
  group?: string;
}

export interface SelectorModel {
  /** Flow B: one group per top-level heading (first-appearance order);
   *  chunks without a heading path go under "Preamble". */
  groups: Array<{ label: string; options: SelectorOption[] }>;
  /** Flattened, document order — for the pager + counter + value lookup. */
  items: SelectorOption[];
  /** Gating: the bar renders only with ≥2 selectable items. */
  visible: boolean;
}

const HEADING_STRIP = /^#{1,6} +/;
const LABEL_MAX = 36;

const truncate = (text: string): string =>
  text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text;

const chunkTopHeading = (chunk: RagChunk): string => {
  const top = chunk.meta.headingPath[0];
  return top ? top.replace(HEADING_STRIP, "").trim() : "";
};

export function buildSelectorModel(
  outline: DocOutline,
  chunks?: RagChunk[] | null,
  tokenLabel = "cl100k tokens",
): SelectorModel {
  if (chunks && chunks.length > 0) {
    // Flow B: chunks grouped by top-level heading.
    const items: SelectorOption[] = chunks.map((chunk) => {
      const path = chunk.meta.headingPath;
      const tail = path.length > 0 ? path[path.length - 1].replace(HEADING_STRIP, "").trim() : "";
      return {
        value: `chunk:${chunk.index}`,
        label: `Chunk ${chunk.index} · ${chunk.tokens} tok${tail ? ` · ${truncate(tail)}` : ""}`,
        group: chunkTopHeading(chunk) || "Preamble",
      };
    });
    const groups: SelectorModel["groups"] = [];
    for (const item of items) {
      const last = groups[groups.length - 1];
      if (last && last.label === item.group) last.options.push(item);
      else groups.push({ label: item.group ?? "Preamble", options: [item] });
    }
    return { groups, items, visible: items.length >= 2 };
  }

  // Flow A: the preamble (when present) then sections, flat.
  const items: SelectorOption[] = [];
  if (outline.preambleLines.length > 0) {
    items.push({ value: "section:preamble", label: "00 · Preamble" });
  }
  for (const section of outline.sections) {
    items.push({
      value: `section:${section.id}`,
      label:
        section.level > 0
          ? `${String(section.index).padStart(2, "0")} · ${truncate(section.text)}`
          : "00 · Preamble",
    });
  }
  return { groups: [], items, visible: items.length >= 2 };
}

/** The pane jump selector for a value (tested — the only value→target map). */
export function targetSelector(value: string): string | null {
  if (value.startsWith("chunk:")) {
    const index = Number(value.slice("chunk:".length));
    if (Number.isFinite(index)) return `[data-chunk="${index}"]`;
  }
  if (value.startsWith("section:")) {
    const id = value.slice("section:".length);
    if (id) return `[data-section="${id}"]`;
  }
  return null;
}

/** Pager boundaries — no wrap; undefined at the ends (disabled). */
export function pagerFor(
  model: SelectorModel,
  value: string,
  delta: -1 | 1,
): { value?: string; index: number } {
  const index = model.items.findIndex((o) => o.value === value);
  if (index < 0) return { value: model.items[0]?.value, index: 0 };
  const next = index + delta;
  if (next < 0 || next >= model.items.length) return { index };
  return { value: model.items[next].value, index: next };
}

/** The select's displayed value from the scroll-spy (falls back to the
 *  first item — the pane starts there). */
export function activeValue(model: SelectorModel, active: string | null): string {
  if (active && model.items.some((o) => o.value === active)) return active;
  return model.items[0]?.value ?? "";
}
