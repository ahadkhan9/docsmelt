/**
 * The mobile TOC drawer's contents — headings + chunks combined (pure,
 * unit-tested). The drawer is the phone's only navigation: a leading Top
 * item (the escape affordance), the heading tree, and — when chunking is
 * on — a Chunks section.
 */
import type { RagChunk } from "./chunk";
import type { DocOutline } from "./sections";

export type ContentsItem =
  | { kind: "top" }
  | { kind: "section"; id: string; text: string; level: number; index: number }
  | { kind: "chunks-head" }
  | { kind: "sections-head" }
  | { kind: "chunk"; index: number; tokens: number; heading: string };

/** In Flow B the chunks ARE the document — they lead the TOC; the heading
 *  tree follows as the section map. Flow A is headings-only. */
export function buildContents(
  outline: DocOutline,
  chunks?: RagChunk[] | null,
): ContentsItem[] {
  const items: ContentsItem[] = [{ kind: "top" }];
  if (chunks && chunks.length > 0) {
    items.push({ kind: "chunks-head" });
    for (const chunk of chunks) {
      const tail = chunk.meta.headingPath[chunk.meta.headingPath.length - 1] ?? "";
      items.push({
        kind: "chunk",
        index: chunk.index,
        tokens: chunk.tokens,
        heading: tail.replace(/^#{1,6} +/, ""),
      });
    }
    // Flow B: only real heading sections are jump targets — the synthetic
    // level-0 section (heading-less docs) is covered by the chunks.
    if (outline.sections.some((sec) => sec.level > 0)) items.push({ kind: "sections-head" });
  } else if (outline.preambleLines.length > 0) {
    items.push({ kind: "section", id: "preamble", text: "preamble", level: 0, index: 0 });
  }
  for (const section of outline.sections) {
    if (chunks && chunks.length > 0 && section.level === 0) continue;
    items.push({
      kind: "section",
      id: section.id,
      text: section.level > 0 ? section.text : "preamble",
      level: section.level,
      index: section.index,
    });
  }
  return items;
}

/** Roving-index helper for the drawer's ArrowUp/Down navigation. */
export function rovingIndex(current: number, total: number, delta: number): number {
  if (total <= 1) return 0;
  return (current + delta + total) % total;
}
