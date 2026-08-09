/**
 * The Selector Bar model — optgroups, labels, gating, pager, value map.
 */
import { describe, expect, it } from "vitest";
import {
  activeValue,
  buildSelectorModel,
  pagerFor,
  targetSelector,
} from "./selector";
import type { RagChunk } from "./chunk";
import { parseSections } from "./sections";

const chunk = (index: number, headingPath: string[], tokens = 512): RagChunk => ({
  index,
  heading: headingPath[headingPath.length - 1] ?? "",
  content: "# c",
  tokens,
  meta: { headingPath, isTable: false, tableParts: null, parentRef: null, oversizedTable: false },
});

describe("buildSelectorModel — Flow B (chunks)", () => {
  it("groups chunks by top-level heading in first-appearance order", () => {
    const outline = parseSections("# Intro\n\n# Chapter 1\n\n# Chapter 2");
    const model = buildSelectorModel(outline, [
      chunk(1, ["# Intro"]),
      chunk(2, ["# Intro"]),
      chunk(3, ["# Chapter 1", "## Deep"]),
      chunk(4, ["# Chapter 2"]),
    ]);
    expect(model.groups.map((g) => g.label)).toEqual(["Intro", "Chapter 1", "Chapter 2"]);
    expect(model.groups[0].options.map((o) => o.value)).toEqual(["chunk:1", "chunk:2"]);
    expect(model.items.map((o) => o.value)).toEqual([
      "chunk:1", "chunk:2", "chunk:3", "chunk:4",
    ]);
    expect(model.visible).toBe(true);
  });

  it("puts heading-less chunks under Preamble and labels with tail + tokens", () => {
    const outline = parseSections("plain");
    const model = buildSelectorModel(outline, [
      chunk(1, []),
      chunk(2, ["# Report", "## Budget"]),
    ]);
    expect(model.groups.map((g) => g.label)).toEqual(["Preamble", "Report"]);
    expect(model.items[0].label).toBe("Chunk 1 · 512 tok");
    expect(model.items[1].label).toBe("Chunk 2 · 512 tok · Budget");
  });

  it("truncates long heading tails", () => {
    const outline = parseSections("# A");
    const long = "# " + "x".repeat(80);
    const model = buildSelectorModel(outline, [chunk(1, [long])]);
    expect(model.items[0].label.length).toBeLessThan(60);
    expect(model.items[0].label.endsWith("…")).toBe(true);
  });
});

describe("buildSelectorModel — Flow A (sections)", () => {
  it("flattens sections with numeral + heading labels", () => {
    const outline = parseSections("Lead.\n\n# Report\n\n## Budget");
    const model = buildSelectorModel(outline, null);
    expect(model.groups).toEqual([]);
    expect(model.items.map((o) => o.label)).toEqual([
      "00 · Preamble", "01 · Report", "02 · Budget",
    ]);
    expect(model.items.map((o) => o.value)).toEqual([
      "section:preamble", "section:report", "section:budget",
    ]);
  });
});

describe("gating", () => {
  it("renders only with ≥2 selectable items", () => {
    const one = parseSections("# Only");
    expect(buildSelectorModel(one, null).visible).toBe(false);
    expect(buildSelectorModel(one, [chunk(1, ["# Only"])]).visible).toBe(false);
    expect(buildSelectorModel(one, [chunk(1, ["# Only"]), chunk(2, ["# Only"])]).visible).toBe(true);
    expect(buildSelectorModel(parseSections(""), null).visible).toBe(false);
  });
});

describe("targetSelector — value → pane jump", () => {
  it("maps chunk and section values, rejects junk", () => {
    expect(targetSelector("chunk:12")).toBe('[data-chunk="12"]');
    expect(targetSelector("section:budget-2")).toBe('[data-section="budget-2"]');
    expect(targetSelector("chunk:abc")).toBeNull();
    expect(targetSelector("section:")).toBeNull();
    expect(targetSelector("")).toBeNull();
  });
});

describe("pagerFor — no wrap, ends disabled", () => {
  const model = buildSelectorModel(
    parseSections("# A"),
    [chunk(1, ["# A"]), chunk(2, ["# A"]), chunk(3, ["# A"])],
  );

  it("moves to neighbours within bounds", () => {
    expect(pagerFor(model, "chunk:2", 1)).toEqual({ value: "chunk:3", index: 2 });
    expect(pagerFor(model, "chunk:2", -1)).toEqual({ value: "chunk:1", index: 0 });
  });

  it("stays at the ends (no wrap) and reports the index", () => {
    expect(pagerFor(model, "chunk:1", -1)).toEqual({ index: 0 });
    expect(pagerFor(model, "chunk:3", 1)).toEqual({ index: 2 });
    expect(pagerFor(model, "chunk:3", 1).value).toBeUndefined();
  });

  it("falls back to the first item for unknown values", () => {
    expect(pagerFor(model, "nope", 1)).toEqual({ value: "chunk:1", index: 0 });
  });
});

describe("activeValue", () => {
  it("prefers the spy's value and falls back to the first item", () => {
    const model = buildSelectorModel(
      parseSections("# A"),
      [chunk(1, ["# A"]), chunk(2, ["# A"])],
    );
    expect(activeValue(model, "chunk:2")).toBe("chunk:2");
    expect(activeValue(model, null)).toBe("chunk:1");
    expect(activeValue(model, "stale")).toBe("chunk:1");
  });
});
