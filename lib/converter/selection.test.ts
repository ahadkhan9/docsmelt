/**
 * Queue multi-select state helpers.
 */
import { describe, expect, it } from "vitest";
import { checkedOf, rangeSelect, toggleChecked } from "./selection";

describe("toggleChecked", () => {
  it("adds and removes ids immutably", () => {
    const a = toggleChecked(new Set(), "x");
    expect([...a]).toEqual(["x"]);
    const b = toggleChecked(a, "x");
    expect([...b]).toEqual([]);
    expect([...a]).toEqual(["x"]); // original untouched
  });
});

describe("rangeSelect", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("selects the contiguous range in either direction", () => {
    expect([...rangeSelect(ids, "a", "d")]).toEqual(["a", "b", "c", "d"]);
    expect([...rangeSelect(ids, "d", "a")]).toEqual(["a", "b", "c", "d"]);
    expect([...rangeSelect(ids, "c", "c")]).toEqual(["c"]);
  });

  it("falls back to the target alone when the anchor is unknown", () => {
    expect([...rangeSelect(ids, "zz", "c")]).toEqual(["c"]);
  });
});

describe("checkedOf", () => {
  it("returns checked ids that still exist, in row order", () => {
    const checked = new Set(["b", "zz", "a"]);
    expect(checkedOf(checked, ["a", "b", "c"])).toEqual(["a", "b"]);
  });
});
