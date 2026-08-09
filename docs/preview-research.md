# Preview & chunk-visualization — research note

> Date: 2026-08-09. Grounds the design in `docs/preview-design.md`. Sources
> fetched fresh: web-design-guidelines (vercel-labs command.md),
> modern-web-guidance guides (scroll-progress-indicator, css,
> content-visibility patterns), and a scan of RAG chunking UIs.

## 1. The problem with the current preview

The ingot pane renders the full markdown in one scrolling column
(`overflow-y-auto` + `max-w-3xl`, ingot-preview.tsx). For a 500 KB
document that is a wall: no map, no structure, no way to find a table, and
— when chunking — no way to see where the chunker actually cut. The user
explicitly rejects this.

## 2. What production tools do with long documents

- **Docs sites (Docusaurus, GitBook, MDN, Tailwind docs)** — the
  established pattern devs know: left TOC rail + scroll-spy (active
  section highlighted) + heading anchors with `scroll-margin-top`. This is
  the navigated-scroll model: the scroll exists, but the outline is the
  map and every section is reachable in one click.
- **Obsidian / VS Code outline** — the same outline concept as a side
  panel over an editor document. Familiar to the target audience (devs).
- **The RAG chunking tools** (rag-chunking-playground, m-ric
  chunk_visualizer, rag-tui) — chunks are shown as **inline bounded
  blocks**: numbered segments with token counts, hover/click to highlight
  the segment in the source, quality coloring. The consistent pattern:
  *chunks are visible units with numbers + stats*, not invisible cuts.
- What none of these do well for a *converter* is the verification
  workflow: check the conversion (tables intact, structure preserved),
  then extract. The outline is the check; the chunk view is the
  extraction.

## 3. Platform APIs (modern-web-guidance)

- **Scroll-driven animations** — `animation-timeline: scroll()` (the
  scroll-progress-indicator guide) gives a pure-CSS progress rail: an
  element inside the pane animates `transform: scaleX` from the pane's own
  scroll. Must be gated on `@supports (animation-timeline: scroll())` AND
  `prefers-reduced-motion: no-preference`, with a JS fallback
  (passive scroll listener + rAF + `transform` only).
- **`content-visibility: auto` + `contain-intrinsic-size`** — already used
  on queue rows; applies to section blocks in very long documents (skip
  rendering off-screen sections). Pair with an estimated size to avoid
  scrollbar jumping.
- **Heading anchors** — `scroll-margin-top` on headings (web-design-
  guidelines), `scroll-behavior: smooth` with `prefers-reduced-motion`
  respected (use `scrollIntoView({ behavior: "smooth" })` gated, or CSS
  with the media query).
- **Container queries** — available for the preview pane's layout switch
  (rail vs no-rail); a simple breakpoint suffices at this scale.

## 4. Key web-design-guidelines rules this work must satisfy

- `scroll-margin-top` on heading anchors; visible focus; `aria-current`
  on the active outline item; buttons not divs; `touch-action:
  manipulation`; no hover-only affordances (the outline must work on
  touch); 44×44 targets; curly quotes/… in the new copy; `content-
  visibility` for long section lists; no layout reads in render
  (scroll-spy via IntersectionObserver, not `getBoundingClientRect` in
  render).

## 5. Chunk-visualization synthesis

The chunking tools' inline-block pattern is the strongest signal: render
each chunk as its own bounded block with a numbered divider (chunk N ·
tokens · heading), plus a chunk rail showing extents with the active
chunk highlighted, click-to-jump, and per-chunk copy/download. The
chunk's own `meta.headingPath` (already in the sidecar schema) ties the
chunk view back to the outline: the outline highlights the section the
active chunk belongs to — one map, two granularities.

## 6. The two-flow requirement

Flow A (no settings): clean sectioned preview, zero chunk noise. Flow B
(settings active): chunked view + summary + per-chunk actions. The switch
is a visible "chunking: off/on" control; re-chunking from in-memory
markdown is cheap (measured: ~170 ms/MB warm, worker offload >1 MB) so
editing settings re-computes instantly.
