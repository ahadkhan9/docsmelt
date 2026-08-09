/**
 * Section model tests — the navigated preview's parser.
 */
import { describe, expect, it } from "vitest";
import { parseSections, sectionForHeading, slugify } from "./sections";

describe("slugify", () => {
  it("lowercases, dashes non-alnum, trims, and falls back", () => {
    expect(slugify("Budget Report")).toBe("budget-report");
    expect(slugify("  Q1  ")).toBe("q1");
    expect(slugify("!!!")).toBe("section");
    expect(slugify("预算")).toBe("预算"); // CJK preserved
  });
});

describe("parseSections", () => {
  it("splits at ATX headings and numbers sections", () => {
    const { sections, preambleLines } = parseSections(
      "Preamble line.\n\n# Report\n\nIntro.\n\n## Budget\n\nNumbers.\n\n## Summary\n\nDone.",
    );
    expect(preambleLines.join("\n").trim()).toBe("Preamble line.");
    expect(sections.map((s) => s.text)).toEqual(["Report", "Budget", "Summary"]);
    expect(sections.map((s) => s.level)).toEqual([1, 2, 2]);
    expect(sections.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(sections[1].lines.join("\n")).toContain("Numbers.");
  });

  it("handles documents without headings (single section) and empty docs", () => {
    const noHeading = parseSections("Just prose.\n\nMore prose.");
    expect(noHeading.sections.length).toBe(1);
    expect(noHeading.sections[0].level).toBe(0);
    expect(noHeading.preambleLines.length).toBe(0);
    expect(parseSections("").sections.length).toBe(0);
  });

  it("dedupes repeated heading slugs", () => {
    const { sections } = parseSections("# Intro\n\n# Intro\n\n# Intro");
    expect(sections.map((s) => s.id)).toEqual(["intro", "intro-2", "intro-3"]);
  });

  it("never treats headings inside code fences as sections", () => {
    const { sections } = parseSections(
      "# Real\n\n```md\n# Fake heading\n\n## Also fake\n```\n\n## Real two",
    );
    expect(sections.map((s) => s.text)).toEqual(["Real", "Real two"]);
    expect(sections[0].lines.join("\n")).toContain("# Fake heading");
  });

  it("keeps table rows out of headings", () => {
    const { sections } = parseSections("# T\n\n| # Not a heading |\n| --- |");
    expect(sections.length).toBe(1);
    expect(sections[0].lines.join("\n")).toContain("| # Not a heading |");
  });
});

describe("sectionForHeading", () => {
  it("maps a chunk's headingPath tail to its outline section", () => {
    const outline = parseSections("# Report\n\n## Budget\n\nx\n\n## Budget\n\ny");
    expect(sectionForHeading(outline, ["# Report", "## Budget"])?.id).toBe("budget-2");
    expect(sectionForHeading(outline, ["# Report"])?.id).toBe("report");
    expect(sectionForHeading(outline, [])).toBeNull();
    expect(sectionForHeading(outline, ["### Missing"])).toBeNull();
  });
});
