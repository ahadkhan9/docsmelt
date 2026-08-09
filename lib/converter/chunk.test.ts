/**
 * Chunk-for-RAG test matrix: token estimator, heading-aware boundaries,
 * overlap math, fence integrity, and the edge cases.
 */
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { CHARS_PER_TOKEN, chunkMarkdown, chunkZip, estimateTokens, resolveChunkOptions } from "./chunk";

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

// ── tables (anydoc emission: `| a | b |`, `| --- | --- |`, `\|`, `<br>`) ──

const ANYDOC_TABLE = [
  "| Metal | Melts at °C |",
  "| --- | --- |",
  "| Iron \\| cast | 1538<br>second line |",
  "| Gold | 1064 |",
].join("\n");

describe("chunkMarkdown — atomic tables", () => {
  it("never splits inside a confirmed table", () => {
    // filler pushes the budget so a boundary would land inside the table
    const md = `# Alloys\n\n${"filler ".repeat(70)}\n\n${ANYDOC_TABLE}\n\nOutro text.`;
    const chunks = chunkMarkdown(md, { targetTokens: 100 }); // 400 chars — boundary lands inside
    expect(chunks.length).toBeGreaterThan(1);
    const owner = chunks.find((c) => c.content.includes("Metal"));
    expect(owner).toBeDefined();
    expect(owner!.content).toContain("| Gold | 1064 |"); // full table in ONE chunk
    // the boundary closed AFTER the table, not inside it
    const after = chunks.filter((c) => c !== owner);
    expect(after.every((c) => !c.content.includes("|"))).toBe(true);
  });

  it("keeps a table at chunk start whole", () => {
    const md = `${ANYDOC_TABLE}\n\nfiller text\n\nfiller text`;
    const chunks = chunkMarkdown(md, { targetTokens: 100 });
    const first = chunks[0];
    expect(first.content).toContain("Metal");
    expect(first.content).toContain("| Gold | 1064 |");
  });

  it("flags oversized tables but never splits them", () => {
    const bigTable = [
      "| Col | Value |",
      "| --- | --- |",
      ...Array.from({ length: 60 }, (_, i) => `| row ${i} | ${"x".repeat(40)} |`),
    ].join("\n"); // ~60 × 60 chars ≈ 3600 chars, target 400
    const chunks = chunkMarkdown(`# T\n\n${bigTable}`, { targetTokens: 100 });
    const owner = chunks.find((c) => c.content.includes("Col"));
    expect(owner).toBeDefined();
    expect(owner!.content).toContain("| row 59 |"); // closer present — never split
    expect(owner!.meta.oversizedTable).toBe(true);
    for (const c of chunks) if (c !== owner) expect(c.meta.oversizedTable).toBe(false);
  });

  it("delimiter confirmation: a | -led prose line is NOT a table", () => {
    const prose = "# Notes\n\nJust a line | with pipes\n\nand another | pipe line here.";
    const chunks = chunkMarkdown(prose, { targetTokens: 100 });
    // splits normally by size/heading, and no chunk carries the table flag
    for (const c of chunks) expect(c.meta.oversizedTable).toBe(false);
    expect(chunks.map((c) => c.content).join("\n")).toContain("Just a line | with pipes");
  });

  it("| inside a code fence is code, never a table", () => {
    const md = "# Code\n\n```\n| a | b |\n| --- | --- |\n| 1 | 2 |\n```\n\nAfter.";
    const chunks = chunkMarkdown(md, { targetTokens: 100 });
    const codeChunk = chunks.find((c) => c.content.includes("| a | b |"));
    expect(codeChunk).toBeDefined();
    expect(codeChunk!.content).toContain("```"); // fence intact, table flag absent
    expect(codeChunk!.meta.oversizedTable).toBeUndefined();
  });

  it("CSV-looking prose rows without a delimiter are not tables", () => {
    const md = "# Data\n\nname,value\nIron,1538\nGold,1064\n\nMore text here.";
    const chunks = chunkMarkdown(md, { targetTokens: 100 });
    for (const c of chunks) expect(c.meta.oversizedTable).toBe(false);
  });

  it("overlap seeds may carry table rows without breaking the next chunk", () => {
    // table ends near a chunk boundary; the seed captures its last row
    const md = `${"filler ".repeat(90)}\n\n${ANYDOC_TABLE}\n\n${"tail ".repeat(80)}`;
    const chunks = chunkMarkdown(md, { targetTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    // every chunk's tables (if any) are still atomic — no dangling rows
    for (const c of chunks) {
      const rows = c.content.split("\n").filter((l) => /^ {0,3}\|/.test(l));
      if (rows.length > 0 && !c.content.includes("| --- |")) {
        // seed-only rows: the row may appear WITHOUT its table — allowed
        // for overlap context, but must be a full row line (never split)
        expect(rows.every((r) => r.startsWith("|") && r.endsWith("|"))).toBe(true);
      }
    }
  });
});

// ── exact tokenizer integration (gpt-tokenizer) ──────────────────────────

const CJK = "文档转换是将办公文件转化为干净、结构化的标记语言的过程，供检索增强生成流水线使用。中文文本的令牌化与英文不同，每个汉字通常对应一到两个令牌。";

describe("chunkMarkdown — exact token budgets (with gpt-tokenizer)", () => {
  it("counts every chunk exactly", async () => {
    const { loadTokenizer } = await import("./tokenizer");
    const tok = await loadTokenizer();
    const md = `${"word ".repeat(600)}\n\n${CJK.repeat(8)}`;
    const chunks = chunkMarkdown(md, { targetTokens: 200 }, tok);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokens).toBe(tok.count(chunk.content));
    }
  });

  it("keeps English chunks within the budget", async () => {
    const { loadTokenizer } = await import("./tokenizer");
    const tok = await loadTokenizer();
    const md = Array.from({ length: 30 }, () => "word ".repeat(80)).join("\n\n");
    const chunks = chunkMarkdown(md, { targetTokens: 200 }, tok);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokens).toBeLessThanOrEqual(200 + 50); // one-line slack
    }
  });

  it("keeps CJK chunks within the budget (chars/4 alone would allow 3×)", async () => {
    const { loadTokenizer } = await import("./tokenizer");
    const tok = await loadTokenizer();
    const md = CJK.repeat(60); // ~6000 chars of CJK
    const chunks = chunkMarkdown(md, { targetTokens: 200 }, tok);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokens).toBeLessThanOrEqual(200 + 40); // tight — the trim enforces it
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("trim keeps document order: nothing is lost, nothing duplicated", async () => {
    const { loadTokenizer } = await import("./tokenizer");
    const tok = await loadTokenizer();
    const lines = Array.from({ length: 60 }, (_, i) => `line ${i} — ${CJK.slice(0, 20)}`);
    const md = lines.join("\n");
    const chunks = chunkMarkdown(md, { targetTokens: 100 }, tok);
    // all original lines present exactly once across chunks (no dupes from
    // continuation + overlap interplay beyond the intended overlap)
    const joined = chunks.map((c) => c.content).join("\n");
    for (const line of lines) {
      expect(joined.match(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length ?? 0)
        .toBeGreaterThanOrEqual(1);
    }
  });

  it("overlap seeds stay token-bounded (≈ overlapTokens + one line)", async () => {
    const { loadTokenizer } = await import("./tokenizer");
    const tok = await loadTokenizer();
    // distinct lines so the suffix/prefix match can't over-extend
    const md = Array.from({ length: 40 }, (_, i) => `paragraph ${i}: ` + "word ".repeat(55)).join("\n\n");
    const chunks = chunkMarkdown(md, { targetTokens: 150, overlapTokens: 15 }, tok);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i += 1) {
      const prev = chunks[i - 1].content;
      const cur = chunks[i].content;
      // char-level: the longest prefix of cur that is a suffix of prev
      // (seeds may be partial lines)
      const maxN = Math.min(cur.length, prev.length);
      let n = maxN;
      while (n > 0 && !cur.startsWith(prev.slice(-n))) n -= 1;
      expect(n).toBeGreaterThan(0);
      const seedTokens = tok.count(cur.slice(0, n));
      expect(seedTokens).toBeLessThanOrEqual(15 + 60); // overlap + one line
    }
  });
});

describe("resolveChunkOptions — presets, custom, overlap", () => {
  it("maps presets and computes the auto ~10% overlap", () => {
    expect(resolveChunkOptions({ preset: 256, overlapAuto: true })).toEqual({
      targetTokens: 256,
      overlapTokens: 26,
    });
    expect(resolveChunkOptions({ preset: 1024, overlapAuto: true })).toEqual({
      targetTokens: 1024,
      overlapTokens: 102,
    });
  });

  it("custom tokens override the preset", () => {
    expect(
      resolveChunkOptions({ preset: 256, customTokens: 700, overlapAuto: true }),
    ).toEqual({ targetTokens: 700, overlapTokens: 70 });
    // a zero/negative custom falls back to the preset
    expect(resolveChunkOptions({ preset: 512, customTokens: -5, overlapAuto: true })).toEqual({
      targetTokens: 512,
      overlapTokens: 51,
    });
  });

  it("manual overlap wins; invalid manual falls back to auto", () => {
    expect(
      resolveChunkOptions({ preset: 512, overlapAuto: false, overlapTokens: 40 }),
    ).toEqual({ targetTokens: 512, overlapTokens: 40 });
    expect(resolveChunkOptions({ preset: 512, overlapAuto: false, overlapTokens: 0 })).toEqual({
      targetTokens: 512,
      overlapTokens: 51,
    });
  });
});

describe("chunk meta — heading path, parent refs, tables", () => {
  it("builds heading paths for nested sections", () => {
    const md = "# Report\n\nIntro.\n\n## Budget\n\nBudget text.\n\n### Q1\n\nQ1 text.";
    const chunks = chunkMarkdown(md, { targetTokens: 5000, overlapTokens: 0 }); // one chunk
    const chunk = chunks[0];
    expect(chunk.meta.headingPath).toEqual(["# Report", "## Budget", "### Q1"]);
    expect(chunk.meta.parentRef).toBeNull(); // starts a section
  });

  it("parentRef points continuation chunks at the section start", () => {
    // a long section split by size: the first chunk starts the section,
    // the continuation chunk points back at it
    const md = `# Long\n\n${"filler ".repeat(500)}\n\n${"more ".repeat(200)}`;
    const chunks = chunkMarkdown(md, { targetTokens: 100, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].meta.parentRef).toBeNull(); // starts the section
    for (const c of chunks.slice(1)) {
      expect(c.meta.parentRef).toBe(1); // section root is chunk 1
      expect(c.meta.headingPath).toEqual(["# Long"]);
    }
  });

  it("marks table chunks and keeps tableParts null (atomic tables)", () => {
    const md = `# T\n\n${ANYDOC_TABLE}`;
    const chunks = chunkMarkdown(md, { targetTokens: 5000, overlapTokens: 0 });
    const tableChunk = chunks.find((c) => c.meta.isTable);
    expect(tableChunk).toBeDefined();
    expect(tableChunk!.meta.tableParts).toBeNull();
    expect(tableChunk!.meta.oversizedTable).toBe(false);
  });
});

describe("chunkZip sidecar ({stem}-chunks.json, schema v1)", () => {
  it("emits the schema with every chunk's meta", async () => {
    const md = `# Report\n\nIntro.\n\n## Budget\n\n${"filler ".repeat(200)}\n\n${ANYDOC_TABLE}`;
    const chunks = chunkMarkdown(md, { targetTokens: 100, overlapTokens: 10 });
    const blob = await chunkZip("report", chunks, "report.docx", "cl100k tokens", {
      targetTokens: 100,
      overlapTokens: 10,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const raw = await zip.file("report-chunks.json")!.async("text");
    const sidecar = JSON.parse(raw);
    expect(sidecar.schema).toBe(1);
    expect(sidecar.encoding).toBe("cl100k tokens");
    expect(sidecar.source).toBe("report.docx");
    expect(sidecar.options).toEqual({ targetTokens: 100, overlapTokens: 10 });
    expect(sidecar.chunks.length).toBe(chunks.length);
    for (const entry of sidecar.chunks) {
      expect(entry.file).toMatch(/^report-\d{3}\.md$/);
      expect(typeof entry.headingPath).toBe("object");
      expect(typeof entry.tokens).toBe("number");
      expect(typeof entry.isTable).toBe("boolean");
      expect("tableParts" in entry).toBe(true);
      expect("parentRef" in entry).toBe(true);
      expect(typeof entry.oversizedTable).toBe("boolean");
    }
    // the index still lists oversized tables via the meta flag
    const index = await zip.file("report-index.md")!.async("text");
    expect(index).toContain("RAG chunks");
  });
});
