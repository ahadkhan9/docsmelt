/**
 * Mobile TOC drawer contents — headings + chunks, pure.
 */
import { describe, expect, it } from "vitest";
import { buildContents, rovingIndex } from "./contents";
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
      "top", "chunks-head", "chunk", "chunk", "sections-head", "section",
    ]);
    expect(withChunks[2]).toMatchObject({ index: 1, tokens: 512, heading: "A" });
    expect(buildContents(outline, []).some((i) => i.kind === "chunks-head")).toBe(false);
    expect(buildContents(outline, null).some((i) => i.kind === "chunk")).toBe(false);
  });
});

describe("rovingIndex", () => {
  it("wraps around at both ends and stays safe on tiny lists", () => {
    expect(rovingIndex(0, 5, 1)).toBe(1);
    expect(rovingIndex(4, 5, 1)).toBe(0);
    expect(rovingIndex(0, 5, -1)).toBe(4);
    expect(rovingIndex(2, 5, 3)).toBe(0);
    expect(rovingIndex(0, 1, 1)).toBe(0);
    expect(rovingIndex(0, 0, 1)).toBe(0);
  });
});

describe("buildContents — Flow B puts chunks first", () => {
  it("orders Top → Chunks → Sections when chunking is on", () => {
    const outline = parseSections("# Report\n\n## Budget");
    const withChunks = buildContents(outline, [fakeChunk(1, ["# Report"]), fakeChunk(2, ["# Report", "## Budget"])]);
    expect(withChunks.map((i) => i.kind)).toEqual([
      "top", "chunks-head", "chunk", "chunk", "sections-head", "section", "section",
    ]);
    expect(withChunks[4]).toEqual({ kind: "sections-head" });
    expect(withChunks[5]).toMatchObject({ text: "Report", level: 1 });
  });

  it("skips the Sections head when the document has no headings", () => {
    const outline = parseSections("plain prose only");
    const withChunks = buildContents(outline, [fakeChunk(1, [])]);
    expect(withChunks.map((i) => i.kind)).toEqual(["top", "chunks-head", "chunk"]);
  });
});
