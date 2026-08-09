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
  | { kind: "chunk"; index: number; tokens: number; heading: string };

export function buildContents(
  outline: DocOutline,
  chunks?: RagChunk[] | null,
): ContentsItem[] {
  const items: ContentsItem[] = [{ kind: "top" }];
  if (outline.preambleLines.length > 0) {
    items.push({ kind: "section", id: "preamble", text: "preamble", level: 0, index: 0 });
  }
  for (const section of outline.sections) {
    items.push({
      kind: "section",
      id: section.id,
      text: section.level > 0 ? section.text : "preamble",
      level: section.level,
      index: section.index,
    });
  }
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
  }
  return items;
}
