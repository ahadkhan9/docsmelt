/**
 * Large-doc preview helpers — bounded text segmentation (no giant text nodes).
 */
import { describe, expect, it } from "vitest";
import { MAX_TEXT_NODE_CHARS, RAW_PREVIEW_CHARS, segmentText } from "./preview";

describe("segmentText", () => {
  it("splits into ≤max segments", () => {
    expect(segmentText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("returns a single segment when within the cap", () => {
    expect(segmentText("hi", 4)).toEqual(["hi"]);
  });

  it("returns [] for empty input", () => {
    expect(segmentText("", 4)).toEqual([]);
  });

  it("never yields a segment larger than MAX_TEXT_NODE_CHARS", () => {
    const text = "x".repeat(RAW_PREVIEW_CHARS + 123);
    const segs = segmentText(text.slice(0, RAW_PREVIEW_CHARS), MAX_TEXT_NODE_CHARS);
    expect(segs.every((s) => s.length <= MAX_TEXT_NODE_CHARS)).toBe(true);
  });
});
