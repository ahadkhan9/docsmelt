/**
 * Mobile TOC drawer contents — headings + chunks, pure.
 */
import { describe, expect, it } from "vitest";
import { buildContents } from "./contents";
import type { RagChunk } from "./chunk";
import { parseSections } from "./sections";

const fakeChunk = (index: number, headingPath: string[], tokens = 512): RagChunk => ({
  index,
  heading: headingPath[headingPath.length - 1] ?? "",
  content: `# chunk ${index}`,
  tokens,
  meta: {
    headingPath,
    isTable: false,
    tableParts: null,
    parentRef: null,
    oversizedTable: false,
  },
});

describe("buildContents", () => {
  it("always leads with the Top escape item", () => {
    const outline = parseSections("# A\n\nx");
    expect(buildContents(outline, null)[0]).toEqual({ kind: "top" });
    expect(buildContents(outline, [])[0]).toEqual({ kind: "top" });
  });

  it("lists sections in order with level + numeral, preamble labelled", () => {
    const outline = parseSections("Lead.\n\n# Report\n\n## Budget");
    const items = buildContents(outline, null);
    expect(items.map((i) => i.kind)).toEqual(["top", "section", "section", "section"]);
    expect(items[1]).toMatchObject({ text: "preamble", level: 0, index: 0 });
    expect(items[2]).toMatchObject({ text: "Report", level: 1, index: 1 });
    expect(items[3]).toMatchObject({ text: "Budget", level: 2, index: 2 });
  });

  it("adds the Chunks section only when chunks exist", () => {
    const outline = parseSections("# A");
    const withChunks = buildContents(outline, [fakeChunk(1, ["# A"]), fakeChunk(2, ["# A"])]);
    expect(withChunks.map((i) => i.kind)).toEqual([
      "top", "section", "chunks-head", "chunk", "chunk",
    ]);
    expect(withChunks[3]).toMatchObject({ index: 1, tokens: 512, heading: "A" });
    expect(buildContents(outline, []).some((i) => i.kind === "chunks-head")).toBe(false);
    expect(buildContents(outline, null).some((i) => i.kind === "chunk")).toBe(false);
  });
});
