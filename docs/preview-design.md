# Preview v2 — design: "The Cargo Manifest"

> Companion: `docs/preview-research.md`. Two-pass design per the
> frontend-design process: plan → critique → build.

## 1. The model

The preview is no longer a scrolling wall. It is a **cargo manifest**: the
document's structure is the primary surface. Left rail = the outline
(heading tree, scroll-spy, one-click jumps); content = **bounded section
blocks** (heading bar with section numeral + per-section copy, content
below, hairline separators); a **molten progress rail** on the pane's
right edge tracks position. When chunking is on, the content switches to
**chunk blocks** — each chunk a bounded unit with a foundry-stamped
divider (number · tokens · heading) — with a chunk rail, click-to-jump,
and per-chunk copy/download.

Why: the audience (devs feeding docs into pipelines) navigates by heading
and checks tables. The outline is the check; the chunk view is the
extraction. Grounded in the docs-site TOC pattern they already know and
the RAG tools' inline-chunk-block pattern (research note §2, §5).

## 2. Palette / type / motion

No new palette: the foundry tokens carry it (§3 of design-direction.md).
New roles: **section numerals in Big Shoulders** (display numerals for the
manifest index — "02" not "2"), chunk stamps in IBM Plex Mono, the
progress rail in molten. Motion: outline highlight crossfade 150 ms,
chunk-block enter 200 ms ease-out, progress rail is scroll-driven (CSS,
`@supports` + reduced-motion gated; JS fallback) — all transform/opacity,
≤300 ms.

## 3. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ header: [glyph] name · chars/ms  [raw⇄rendered] [copy] [md]  │
│         [Chunking off/on] ── when on: [summary · settings]   │
├────────────┬─────────────────────────────────────────────────┤
│ OUTLINE    │  §01  # Smelted sample               ▍progress   │
│ # Report   │  §02  ## Budget                      ▍rail       │
│   ## Budget│  §03  ## Q1 · [copy section]         ▍(molten,   │
│   ### Q1   │  ...                                ▍scroll-    │
│ ## Summary │  (sections scroll; spy highlights   ▍driven)    │
│            │   the active outline item)          ▍           │
├────────────┴─────────────────────────────────────────────────┤
│ Flow B: content = CHUNK 01 · 512 tok · # Budget …            │
│         CHUNK 02 · 508 tok · # Budget … (stamped dividers)   │
└──────────────────────────────────────────────────────────────┘
```

- Desktop: rail (≈200 px) + content. Mobile (<768 px): rail becomes a
  horizontal scrollable chip strip under the header (touch-scrollable,
  no hover-only).
- Sections: `scroll-margin-top`, anchors from slugified headings
  (duplicate-safe), `content-visibility: auto` on section blocks.
- The pane keeps internal scroll — but it is *navigated*: every section
  reachable from the rail, position always visible on the progress rail.

## 4. Signature element — the molten level rail

A hairline on the content pane's right edge fills top-to-bottom with
molten as the pane scrolls — the ingot's "pour level". Pure CSS
(`animation-timeline: scroll()` on the pane scroller) where supported,
transform-only JS fallback otherwise, disabled under reduced motion.
One bold element; everything else quiet.

## 5. Chunk visualization (Flow B)

- **Chunk blocks**: each chunk renders as its own bounded block on the
  paper surface. Divider header (molten left rule + mono stamp):
  `CHUNK 04 · 512 cl100k tokens · # Budget` — the chunk's own heading from
  its `headingPath` tail. Blocks enter with a 200 ms ease-out fade.
- **Chunk rail**: a thin strip next to the progress rail showing chunk
  extents (segments) with the active chunk highlighted (molten);
  click jumps to the block; keyboard: ArrowUp/Down moves between chunks
  (focus on the rail, `aria-label="Chunk navigation"`).
- **Per-chunk actions**: copy chunk, download chunk as `.md`
  (`{stem}-{NNN}.md`) — in the divider header (44×44 targets).
- **Summary** in the preview header when on: `N chunks · ~avg tokens ·
  X tables kept whole · overlap ~10%`.
- **The outline stays the section map**: the active chunk's
  `headingPath` drives which outline item is highlighted — one map, two
  granularities.

## 6. Two-flow state machine

```
chunkSettings (global, in useConverter):
  { enabled, preset, customTokens?, overlapAuto, overlapTokens? }

drop ──► convert ──► done ──► chunkSettings.enabled?
                                  │ no → Flow A (clean preview)
                                  ▼ yes
                  compute chunks (in-memory markdown, cheap:
                  ~170 ms/MB warm, worker >1 MB) → job.chunks
                  → Flow B (chunked preview)

toggle "Chunking" in the preview header at any time:
  on  → re-chunk the selected done job from its markdown
  off → clear the chunk overlay (job.chunks kept for re-enable)
settings edit → re-chunk selected (instant)
```

- JobView gains `chunks?: RagChunk[]` and `chunkEncoding?: string`.
- The per-row Scissors panel stays as the per-file zip/custom path and
  inherits the global settings when enabled.

## 7. Mobile row layout (the reported bugs)

- The `ms` text moves OUT of the action cluster into the info column's
  status line (`3.2 KB · 42 ms`), single truncated mono line — the
  overlap is structurally impossible.
- Action cluster: on ≥sm the icons stay inline; below sm the row shows
  ONE primary action (cancel / download .md) + a "more" control that
  expands an inline action strip under the row (text+icon buttons,
  44×44, keyboard/touch friendly — no popover, no hover-only).
- Row grid: `[checkbox][glyph][info min-w-0][actions]` with truncation.

## 8. Critique pass (before building)

- ❌ "TOC sidebar + scroll-spy" is the docs-site default — generic on its
  own. The execution must be docsmelt: section numerals in Big Shoulders,
  the molten level rail, foundry-stamped chunk dividers. The chunk view
  (bounded stamped blocks + rail + per-chunk actions) is not a template
  answer — it is the product's RAG workflow made visible.
- ❌ Chunk blocks as "cards" would read as a dashboard — they are blocks
  on the same paper surface with hairline + molten stamp, not cards.
- ❌ A bottom sheet or popover menu for row actions would add overlay
  complexity — the inline expandable strip keeps everything on the page
  and keyboard-accessible.
- ✓ The design survives: one signature (the level rail), quiet everything
  else, foundry tokens throughout, both flows feel like one product.
