/**
 * Regression pin for the "Chunk for RAG panel collapses on click" bug.
 * The old condition was `open && (chunks || loading)` — an async failure
 * (worker onerror, tokenizer import) left chunks null with loading false,
 * unmounting the panel the instant the failure landed. The error state
 * must keep the panel visible.
 */
import { describe, expect, it } from "vitest";
import { CHUNK_PANEL_ERROR, chunkPanelVisible } from "./chunk-panel";

describe("chunkPanelVisible", () => {
  it("stays closed when closed", () => {
    expect(chunkPanelVisible(false, false, false, false)).toBe(false);
    expect(chunkPanelVisible(false, true, true, false)).toBe(false);
  });

  it("shows while loading and once chunks are ready", () => {
    expect(chunkPanelVisible(true, false, true, false)).toBe(true); // loading
    expect(chunkPanelVisible(true, true, false, false)).toBe(true); // done
  });

  it("REGRESSION: stays open when the computation failed", () => {
    // old condition `open && (chunks || loading)` → false here → collapse
    expect(chunkPanelVisible(true, false, false, true)).toBe(true);
  });

  it("carries an honest error message", () => {
    expect(CHUNK_PANEL_ERROR).toContain("Try again");
  });
});

describe("collapse-bug recreation — the full click → failure/success sequences", () => {
  it("failure sequence: click → loading → error, panel STAYS OPEN", () => {
    // click: chunkOpen true, computeChunks starts (loading)
    expect(chunkPanelVisible(true, false, true, false)).toBe(true);
    // the async path fails: chunks null, loading ends, error lands
    expect(chunkPanelVisible(true, false, false, true)).toBe(true); // no collapse
    // user closes explicitly → gone
    expect(chunkPanelVisible(false, false, false, true)).toBe(false);
  });

  it("success sequence: click → loading → chunks render", () => {
    expect(chunkPanelVisible(true, false, true, false)).toBe(true);
    expect(chunkPanelVisible(true, true, false, false)).toBe(true);
  });
});
