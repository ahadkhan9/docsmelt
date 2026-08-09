/**
 * Chunk-for-RAG test matrix: token estimator, heading-aware boundaries,
 * overlap math, fence integrity, and the edge cases.
 */
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { CHARS_PER_TOKEN, chunkMarkdown, chunkZip, estimateTokens } from "./chunk";

const fenceState = (content: string): "closed" | "open" => {
  let state: string | null = null;
  for (const line of content.split("\n")) {
    const m = /^(`{3,}|~{3,})/.exec(line.trimStart());
    if (!m) continue;
    if (state) {
      if (m[1][0] === state[0]) state = null;
    } else {
      state = m[1];
    }
  }
  return state ? "open" : "closed";
};

describe("estimateTokens", () => {
  it("uses the 4-char heuristic", () => {
    expect(estimateTokens("hello world")).toBe(Math.ceil(11 / CHARS_PER_TOKEN));
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("chunkMarkdown — basics", () => {
  it("empty and whitespace-only documents yield no chunks", () => {
    expect(chunkMarkdown("", { targetTokens: 500 })).toEqual([]);
    expect(chunkMarkdown("\n\n  \n", { targetTokens: 500 })).toEqual([]);
  });

  it("a single short document is one chunk", () => {
    const md = "# Title\n\nA short paragraph.";
    const chunks = chunkMarkdown(md, { targetTokens: 500 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain("A short paragraph");
    expect(chunks[0].heading).toBe("# Title");
    expect(chunks[0].index).toBe(1);
    expect(chunks[0].tokens).toBe(estimateTokens(chunks[0].content));
  });

  it("a long document with no headings splits by size", () => {
    const para = "lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(30); // ~1100 chars
    const md = Array.from({ length: 6 }, () => para).join("\n\n");
    const chunks = chunkMarkdown(md, { targetTokens: 100 }); // 400 chars target
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.content.length).toBeLessThanOrEqual(400 + 200); // one-line slack
    }
  });
});

describe("chunkMarkdown — heading awareness", () => {
  it("never splits a section when a heading boundary is near", () => {
    // Sections sized so the heading lands at ~60% of the budget — the
    // chunk must close BEFORE the heading, never mid-section.
    const section = (n: number) =>
      `## Section ${n}\n\n${"filler ".repeat(120)}`; // ~720 chars each
    const md = [1, 2, 3, 4].map(section).join("\n\n");
    // overlap off so chunk starts are unambiguous in this test
    const chunks = chunkMarkdown(md, { targetTokens: 500, overlapTokens: 0 }); // 2000 chars
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const first = chunk.content.split("\n").find((l) => l.trim() !== "");
      expect(first).toMatch(/^## /);
    }
    // all four headings appear exactly once across chunks
    const all = chunks.map((c) => c.content).join("\n");
    for (const n of [1, 2, 3, 4]) {
      expect(all.match(new RegExp(`## Section ${n}`, "g"))?.length).toBe(1);
    }
  });

  it("a section longer than the budget splits mid-section by size", () => {
    const md = `# Long\n\n${"filler ".repeat(600)}`; // ~3600 chars, no sub-headings
    const chunks = chunkMarkdown(md, { targetTokens: 500 }); // 2000 chars
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("chunkMarkdown — overlap", () => {
  it("seeds the next chunk with the previous tail at line granularity", () => {
    const para = "word ".repeat(200); // 1000 chars
    const md = Array.from({ length: 8 }, () => para).join("\n\n");
    const chunks = chunkMarkdown(md, { targetTokens: 100, overlapTokens: 10 }); // 400 chars, 40 overlap
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i += 1) {
      const prev = chunks[i - 1].content;
      const cur = chunks[i].content;
      // genuine content overlap: the next chunk starts with the previous
      // chunk's tail (at least the final 20 chars)
      expect(cur.includes(prev.slice(-20))).toBe(true);
      // and overlap stays bounded: seed ≈ overlapTokens + one line
      expect(cur.length).toBeLessThanOrEqual(400 + 400);
    }
  });
});

describe("chunkMarkdown — fence integrity", () => {
  it("never splits a code fence across chunks", () => {
    const code = Array.from({ length: 400 }, (_, i) => `line ${i}`).join("\n"); // ~2800 chars
    const md = `# Doc\n\nIntro.\n\n\`\`\`ts\n${code}\n\`\`\`\n\nOutro text after the fence.`;
    const chunks = chunkMarkdown(md, { targetTokens: 100 }); // 400 chars — boundary lands inside the fence
    expect(chunks.length).toBeGreaterThan(1);
    // the fence must be fully contained in ONE chunk
    const owners = chunks.filter((c) => c.content.includes("```ts"));
    expect(owners.length).toBe(1);
    expect(owners[0].content.includes("line 399")).toBe(true); // closer present
    for (const chunk of chunks) expect(fenceState(chunk.content)).toBe("closed");
  });

  it("a giant fence becomes one oversized chunk rather than splitting", () => {
    const code = "x".repeat(5000);
    const md = `\`\`\`\n${code}\n\`\`\``;
    const chunks = chunkMarkdown(md, { targetTokens: 100 });
    expect(chunks.length).toBe(1);
    expect(fenceState(chunks[0].content)).toBe("closed");
  });

  it("closes a dangling fence in malformed input", () => {
    const md = "Some text.\n\n```js\nnever closed";
    const chunks = chunkMarkdown(md, { targetTokens: 500 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].content.trimEnd().endsWith("```")).toBe(true);
    expect(fenceState(chunks[0].content)).toBe("closed");
  });

  it("fence integrity holds across overlap reseeding", () => {
    // sections with code blocks so overlap tails cross fence-adjacent lines
    const section = (n: number) =>
      `## S${n}\n\n\`\`\`js\nconst x${n} = ${n};\n\`\`\`\n\n${"filler ".repeat(80)}`;
    const md = [1, 2, 3, 4, 5].map(section).join("\n\n");
    const chunks = chunkMarkdown(md, { targetTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(fenceState(chunk.content)).toBe("closed");
  });
});

describe("chunkMarkdown — boundary precision", () => {
  it("a line that exactly fills the budget stays with its chunk", () => {
    const line = "a".repeat(400); // exactly 400 chars = the 100-token target
    const md = `${line}\n\nsecond line`;
    const chunks = chunkMarkdown(md, { targetTokens: 100 });
    expect(chunks[0].content.includes(line)).toBe(true);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("carriage returns are normalized", () => {
    const md = "# A\r\n\r\npara one\r\npara two";
    const chunks = chunkMarkdown(md, { targetTokens: 500 });
    expect(chunks[0].content).not.toContain("\r");
  });
});

describe("chunkZip", () => {
  it("packs numbered chunks plus an index", async () => {
    const chunks = chunkMarkdown("# A\n\n" + "word ".repeat(300), { targetTokens: 100 });
    const blob = await chunkZip("report", chunks, "report.docx");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names.some((n) => /^report-0\d\d\.md$/.test(n))).toBe(true);
    const index = await zip.file("report-index.md")!.async("text");
    expect(index).toContain("RAG chunks");
    expect(index).toContain("report.docx");
  });
});
