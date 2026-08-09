/**
 * Keyboard shortcut mapping — the pure handler, all contexts.
 */
import { describe, expect, it } from "vitest";
import { handleShortcut } from "./shortcuts";

const rows = ["a", "b", "c"];
const ctx = (inEditable = false) => ({ inEditable, rowIds: rows });

const ev = (key: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {}) => ({
  key,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  shiftKey: mods.shift ?? false,
});

describe("handleShortcut", () => {
  it("maps ⌘O / ctrl+O to open-picker (even while editing)", () => {
    expect(handleShortcut(ev("o", { meta: true }), ctx())).toEqual({ type: "open-picker" });
    expect(handleShortcut(ev("O", { ctrl: true }), ctx())).toEqual({ type: "open-picker" });
    expect(handleShortcut(ev("o", { meta: true }), ctx(true))).toEqual({ type: "open-picker" });
  });

  it("maps ⌘⇧V to paste outside editing contexts only", () => {
    expect(handleShortcut(ev("v", { meta: true, shift: true }), ctx())).toEqual({ type: "paste" });
    expect(handleShortcut(ev("v", { ctrl: true, shift: true }), ctx())).toEqual({ type: "paste" });
    expect(handleShortcut(ev("v", { meta: true, shift: true }), ctx(true))).toBeNull();
    // plain ⌘V (no shift) is native paste — never hijacked
    expect(handleShortcut(ev("v", { meta: true }), ctx())).toBeNull();
  });

  it("maps ⌘D to download-active", () => {
    expect(handleShortcut(ev("d", { meta: true }), ctx())).toEqual({ type: "download-active" });
    expect(handleShortcut(ev("d", { ctrl: true }), ctx())).toEqual({ type: "download-active" });
  });

  it("maps Esc to escape outside editing contexts", () => {
    expect(handleShortcut(ev("Escape"), ctx())).toEqual({ type: "escape" });
    expect(handleShortcut(ev("Escape"), ctx(true))).toBeNull();
  });

  it("maps 1–9 to queue rows within range", () => {
    expect(handleShortcut(ev("1"), ctx())).toEqual({ type: "select-row", index: 0 });
    expect(handleShortcut(ev("3"), ctx())).toEqual({ type: "select-row", index: 2 });
    expect(handleShortcut(ev("4"), ctx())).toBeNull(); // only 3 rows
    expect(handleShortcut(ev("9"), ctx(true))).toBeNull(); // editing
    expect(handleShortcut(ev("0"), ctx())).toBeNull();
  });

  it("ignores plain typing and unknown combos", () => {
    expect(handleShortcut(ev("a"), ctx())).toBeNull();
    expect(handleShortcut(ev("Enter"), ctx())).toBeNull();
    expect(handleShortcut(ev("p", { meta: true }), ctx())).toBeNull();
  });
});
