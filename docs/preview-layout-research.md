# md preview layout v2 — mobile-first chunk-selector research

> Analysis-only brief (round 6). Grounded in the current components
> (mobile-preview.tsx, preview-blocks.tsx, ingot-preview.tsx,
> lib/converter/contents.ts), the shipped research notes
> (preview-research.md, preview-design.md, mobile-preview.md), the
> modern-web-guidance guides (custom-select-picker-layouts,
> animated-select-picker, scroll-position-aware-elements,
> scrollability-affordance-hints), and the fetched web-design-guidelines.
> Two web searches for third-party chunk-selector/e-reader patterns
> returned empty this session — where general product knowledge is used
> (Kindle/MarginNote pagination, native mobile selects), it is marked as
> such rather than cited.

## 1. TL;DR

Put a **chunk/section selector + prev/next pager in a slim toolbar at the
top of the mobile preview pane**, using a **native `<select>`** — on a
phone a native select opens the OS picker, which is the only pattern that
handles 500-chunk lists with zero deps, perfect a11y, and no overlay
risks. The toolbar also surfaces the **currently-active chunk** (number ·
tokens · heading) from the existing scroll-spy — that visibility is the
real gap today. Keep the Contents drawer as the overview; the result is a
three-layer mobile model: **scroll (continuity) + select/pager (precise
jump) + drawer (map)**.

## 2. The current state (grounded)

- Mobile preview (`mobile-preview.tsx`): 60dvh inner scroller, fixed
  bottom-left Contents button, TOC drawer ordered Top → Chunks →
  Sections with roving ArrowUp/Down, scroll-spy driving the active item.
- Flow B renders a continuous stack of stamped chunk blocks; the ONLY
  chunk-level navigation is the drawer (tap → jump → close).
- The active chunk is computed (scroll-spy) but only visible *inside the
  drawer* — nothing on the reading surface says "you are in chunk 12 of
  512".

## 3. Options menu

### Chunk-selection patterns

**A. Native `<select>` in a pane toolbar — ⚡ fast-simple (~1–2 h)**
A mono-styled select in the mobile pane header ("Chunk: 12/512 ▾"),
options = `Chunk 12 · 512 tok · Budget` (heading from the chunk's
headingPath tail). On mobile the OS picker opens — the wheel/table is the
best long-list touch pattern that exists, and it is free (no runtime deps,
native keyboard/a11y, no overlay, no scroll-swallow). Closed-state styling
is fully foundry-controllable (the select itself is `bg-background
border-border font-mono`). Flow A uses the same control with sections.
Tradeoffs: the OS picker is unstyled (accepted — it is the platform's
own chrome), and a 500-item wheel is long (mitigated by the pager for
adjacent moves + the drawer for the map). **This is the "dropdown to
select chunks" the user asked for, done right.**

**B. Custom combobox with a filter — 🔨 balanced (4–6 h)**
A custom listbox (the custom-select guides' territory) with a text filter
("12" or "budget") — genuinely useful past ~100 chunks. But on mobile,
custom dropdowns over long lists are the classic failure class we have
been fighting (floating overlays, focus traps, nested scroll, tap
swallows); it needs `role="listbox"` + arrow-key roving + click-outside +
Esc. Verdict: build only if real-phone testing shows the native wheel is
too slow at 500+ chunks.

**C. Prev/next pager — ⚡ fast-simple (~1 h)**
`‹ Chunk 12/512 ›` — arrow buttons + a counter, in the same toolbar as A.
Adjacent-chunk moves (the most common chunk-to-chunk action) become one
tap instead of drawer→tap→close. Pairs with A (select for the destination,
pager for neighbors). Zero risk (plain buttons, 44px, disabled at the
ends). **Take it with A.**

**D. Horizontal chunk rail — 🔨 balanced (3 h) — REJECT**
A scrollable chip rail above the pane. We shipped exactly this in round 2
and it failed on phones (nested horizontal scroller swallowing taps). A
rail of 500 chips is also unusable — it only works for ≤~30 items. The
drawer already provides the overview; a rail adds a third overview with
worse ergonomics.

**E. Swipe-through chunks (story/Kindle pagination) — 🐢 accurate-heavy (8 h) — DEFER**
On a 375px phone a 512-token chunk is roughly 1–2 screens — pagination is
*viable* (this is the Kindle/MarginNote model, general product knowledge:
page-flip for screen-sized units, continuous scroll for flowing text).
But: the app's job is scan-and-verify (check tables, copy sections), not
read-through; horizontal snap gestures fight the vertical reading scroll;
momentum + snap + the existing scroll-spy = real gesture complexity.
The pager (C) delivers 80% of the value at 10% of the cost. Revisit only
if user feedback says "I want to read chunk by chunk".

**F. Bottom-sheet chunk picker — 🔨 balanced (3 h) — REJECT as redundant**
A dedicated chunk sheet duplicates the Contents drawer, which already
lists chunks first with the same active state. Two sheets for one job is
discoverability noise.

### Mobile layout patterns

**G. Toolbar + scroller (the chosen shape) — ⚡ (2–3 h total with A+C)**
A slim toolbar row inside MobilePreview, above the scroller (part of the
preview's own chrome, below the ingot header — no nesting in the
scroller, no sticky): [Chunk: select ▾] [‹ ›] [counter]. 44px targets,
foundry tokens, the active chunk label fed by the existing scroll-spy.
The scroller keeps 60dvh flex-1. This is the standard mobile "toolbar +
reading pane" shape (general product knowledge: chat apps, readers,
notebook tools all anchor navigation at the pane's top edge — the
thumb-reachable zone below the browser chrome).

**H. Sticky mini-toolbar overlay — 🔨 balanced (3–4 h) — REJECT**
A floating toolbar hovering over the content (like the Contents button).
It would fight the existing fixed button (two floating controls), cover
content, and add z-index/overlay complexity for no gain over a
non-scrolling toolbar row that is always in place.

**I. Scroll-driven affordance hints — ⚡ (~1 h, polish)**
The scrollability-affordance-hints guide: a bottom fade on the pane when
more content exists below. Cheap, CSS-only, pairs with the level rail.
Optional; do if the toolbar lands cleanly.

## 4. Decision matrix (1–5, higher better)

| Option | Mobile ergonomics | Discoverability | A11y | Zero-server fit | Cost | Risk to current design |
|---|---|---|---|---|---|---|
| A. Native select toolbar | 5 | 5 (always visible) | 5 (native) | 5 | 1–2 h | very low (new row, no touch to existing flows) |
| C. Prev/next pager | 5 | 4 | 5 | 5 | 1 h | very low (plain buttons) |
| A+C toolbar (recommended) | 5 | 5 | 5 | 5 | 2–3 h | very low |
| B. Custom combobox+filter | 4 | 4 | 3 (focus/overlay) | 5 | 4–6 h | medium (the round-2 failure class) |
| D. Horizontal rail | 2 (round-2 evidence) | 3 | 3 | 5 | 3 h | medium (regression risk) |
| E. Swipe-through | 4 | 3 | 3 | 5 | 8 h | high (gesture complexity) |
| F. Bottom-sheet picker | 4 | 3 (duplicate) | 4 | 5 | 3 h | low (redundant) |
| G. Toolbar+scroller shape | 5 | 5 | 5 | 5 | base | very low |
| H. Floating mini-toolbar | 3 | 3 | 3 | 5 | 3–4 h | medium (two floating controls) |
| I. Scroll affordance hints | 4 | 3 | 4 | 5 | 1 h | none |

## 5. Phased plan

**Do-now (⚡, one focused pass ~3 h):**
1. The mobile toolbar (A+C): native `<select>` (Flow B: chunks, Flow A:
   sections) + `‹ ›` pager + the active-chunk/section label from the
   scroll-spy. Foundry closed-state styling; 44px; disabled ends;
   reduced-motion irrelevant (native). The select opens the OS picker —
   zero overlay code, zero deps, the existing 157 tests untouched (the
   builder/contents logic is unchanged — the select is a view over
   `buildContents`).
2. Optional polish: bottom fade (I) if the toolbar lands cleanly.

**Later (🔨):** a filtered custom listbox only if real-phone testing shows
the native wheel is too slow past ~500 chunks; the same toolbar on
desktop (the rail stays; the select adds precise jumps + the always-visible
active-chunk label — the user said desktop is fine, so this is optional
and low-priority).

**Never (with reasons):** swipe-through pagination (the pager delivers its
value at a tenth of the risk); a second bottom sheet (duplicates the
drawer); a horizontal rail (the round-2 failure class); a floating
mini-toolbar (two floating controls, content coverage).

## 6. Sources

- modern-web-guidance (2026_05_16-c5e78707): `custom-select-picker-layouts`,
  `animated-select-picker`, `scroll-position-aware-elements`,
  `scrollability-affordance-hints` — via `npx modern-web-guidance search`,
  retrieved this session.
- web-design-guidelines (vercel-labs command.md, fetched fresh): touch
  targets, touch-action, no hover-only, focus, dialog semantics — applied
  in the evaluation.
- In-repo research: `docs/preview-research.md` (chunk-visualization
  patterns: inline bounded blocks, rails — none of the surveyed RAG tools
  use a dropdown selector; the block+rail model is the established one),
  `docs/preview-design.md` (the Cargo Manifest), `docs/mobile-preview.md`
  (the Contents Pouch + the round-2 strip failure analysis — the evidence
  that nested horizontal scrollers fail on iOS).
- General product knowledge, marked as such: Kindle/MarginNote-style
  page-flip for screen-sized units vs continuous scroll for flowing text;
  native mobile selects as the platform's long-list picker; the
  toolbar+reading-pane shape in mobile readers/chat/notebook tools.
- Two WebSearch attempts for third-party chunk-selector and e-reader
  pattern articles returned empty this session — those claims rest on the
  general-knowledge marker above and the in-repo research, not on
  unverifiable links.
