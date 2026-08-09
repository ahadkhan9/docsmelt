# docsmelt — Design Direction

**"The Foundry"** · dark night-shift floor, one molten interaction, one bright ingot.

---

## 1. Subject, audience, job

- **Subject**: a document smeltery. Documents are ore — heterogeneous, encrusted with
  proprietary formats, passwords, and binary sludge. Markdown is the pure metal.
  docsmelt runs the furnace: ore in, ingot out, everything in the visitor's own browser.
- **Audience**: developers, technical writers, and knowledge workers feeding docs into
  LLM pipelines, note systems, and static sites. They are format-weary and
  privacy-alert: the pitch is *"files never leave your browser"* and the proof is
  that the app works with no server at all.
- **The page's single job**: get a document into the furnace and out as markdown
  with as little friction as possible. Everything else — batch, zip, preview —
  serves that one motion.

## 2. The thesis (hero)

The drop zone **is** a furnace mouth. Dragging a document over it heats it:
the frame lines ignite molten, a glow rises from the lower edge. Releasing feeds
the document; the conversion is the smelt. The markdown result is presented as a
**cast ingot** — a deliberately bright, cool-white paper surface inside the dark
floor. Dark foundry, bright ingot: the value of the product is the contrast between
the two.

Headline (display face, sentence case):

> **Smelt documents into markdown.**
> *PDF, DOCX, XLSX, PPTX, RTF, EPUB, ODS, CSV — converted in your browser.
> Nothing is uploaded, so nothing can leak.*

## 3. Palette (6 named colors + neutrals + family colors)

Derived from the smelting metaphor: forge iron, furnace heat, quench, and cast paper.

| Token | Hex | Role |
|---|---|---|
| `foundry` | `#101418` | Page background — night-shift floor |
| `raised` | `#171C22` | Panels, queue rows, controls (1 step up) |
| `line` | `#28313C` | Hairlines, borders, separators |
| `ink` | `#E8ECF1` | Primary text on dark (≈15:1) |
| `steel` | `#9AA7B5` | Secondary text (≈7:1) |
| `mute` | `#7A8794` | Captions, metadata (≥4.6:1) |
| `molten` | `#FF9E3D` | **The only interaction accent.** Dropzone heat, primary CTA, active states, focus ring |
| `paper` | `#F7F7F5` | The ingot — markdown preview surface (cool white, not cream) |
| `ingot-ink` | `#1F2328` | Text on paper (≈14:1) |

**Format family colors** (muted; used as the colored dot + badge tint of the format
identity system, never as page chrome):

| Family | Formats | Hex |
|---|---|---|
| Word | doc, docx, docm, odt, rtf | `#7FA8F0` blue |
| PDF | pdf | `#F08A7C` red |
| Sheet | xls, xlsx, xlsm, xlsb, ods, csv | `#86CC8E` green |
| Slide | ppt, pps, pot, pptx, pptm, ppsx, ppsm, odp | `#B7A0F0` violet |
| Book | epub | `#6CC8CE` teal |

Success reuses sheet green, danger reuses pdf red, the ingot paper is the "done"
surface. No new colors for states — the palette stays a closed set.

**Deliberate abstentions**: no white-on-dark glass, no gradient blobs, no brand
rainbow, no per-format brand colors (Word blue ≠ Excel green ≠ PowerPoint orange).
One accent, five family tints, nothing else.

## 4. Typography (three roles, deliberately distinct)

Self-hosted via `next/font` (static-export safe, no FOUT, no CDN).

| Role | Face | Use |
|---|---|---|
| Display | **Big Shoulders Display** 600/700, caps allowed for the wordmark only | Wordmark `DOCSMELT` (the *smelt* in molten), headline, big stat numbers (conversion ms, chars) |
| Body | **IBM Plex Sans** 400/500/600 | All UI text, copy, buttons |
| Utility | **IBM Plex Mono** 400/500 | Format names, file names, eyebrow labels, raw-markdown pane, stats (`42 ms`), extension chips |

Scale: 15/16 px body · 13 px mono · hero `clamp(2rem, 4.5vw, 3.25rem)` · wordmark 22 px.
Sentence case everywhere in copy; mono eyebrows in caps are labels, not typography.

Rationale: Big Shoulders is a condensed industrial face — signage, machinery plates,
foundry stencils. IBM Plex is the instrument family: designed for screens that ship
with equipment. The trio reads as *workshop*, not *startup*.

## 5. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ DOCSMELT  (display)            privacy stamp: "in-browser"   │  ← top bar
├──────────────────────────────────────────────────────────────┤
│                      THE FURNACE                             │  ← hero = dropzone
│   [5 family glyphs]  Smelt documents into markdown.          │
│   drop anywhere · browse · paste      [Choose files]         │
│   drag-over → molten frame + rising glow                     │
├──────────────────────────────────────────────────────────────┤
│  QUEUE                    │  INGOT (preview of selection)    │
│  ┌──────────────────────┐ │  ┌────────────────────────────┐  │
│  │ file.docx ▓▓▓ smelt  │ │  │  # Heading        (rendered)│  │
│  │ file.pdf  ✓ done     │ │  │  body text…                │  │
│  │ …                     │ │  └────────────────────────────┘  │
│  └──────────────────────┘ │  raw ⇄ rendered toggle · copy ·   │
│                            │  download .md / .zip (images)    │
├──────────────────────────────────────────────────────────────┤
│ formats strip · engine credit · privacy note                 │  ← footer
└──────────────────────────────────────────────────────────────┘
```

- **Desktop**: queue (left, ~360 px) + ingot preview (right, fluid). Preview scrolls
  internally; the page never scrolls except under it on mobile.
- **Mobile (<768 px)**: single column — furnace, then queue, then preview below.
- **The furnace collapses** to a slim "add more" strip once the first file lands;
  the workspace takes over. The empty state *is* the hero — one element, two jobs
  is avoided: the transition is a real state change, not a crammed layout.
- Preview pane is internal-scroll (its own scrollbar) so long documents don't move
  the queue; CLS stays < 0.1 because the workspace frame has reserved dimensions.

## 6. Signature element — the furnace dropzone

Everything else is quiet; this is the one bold thing.

- **Idle**: raised panel, 1 px `line` border, family glyphs in a row, mono eyebrow
  `FEED THE FURNACE`, body copy, one molten primary button.
- **Drag-over** (`dragenter`): border → molten, a radial glow rises from the bottom
  edge (opacity/transform only), a mono line appears: `RELEASING FEEDS THE SMELT`.
  Transitions 200 ms `ease-out`.
- **Feed** (drop/click): 250 ms flash of the molten glow, then the file row appears
  in the queue with `smelting…` + elapsed time.
- **Engine loading** (first conversion ever): the furnace shows an honest state —
  `FIRING UP — loading the 6.5 MB conversion engine` with an indeterminate bar.
  This is real, necessary wait; the design says so instead of hiding it.
- **Done**: queue row flips to a checked state; the ingot pane ignites the preview.
- Hover/press on the button: 150 ms scale/color; active `scale(0.97)`.
- Reduced motion: glow and heat collapse to border-color + bg-color only.

## 7. Format identity system (every file type feels designed-for)

- **Color encodes family** (five tints above), **glyph encodes format**: a small
  hand-drawn SVG set — 5 family glyphs (document, sheet, deck, book, PDF) with
  format-specific variants only where the file shape demands (csv vs xlsx).
- **Badge** = family dot + mono format name in a `raised` chip
  (e.g. `● docx`). Detection is shown *before* conversion
  ("Detected: DOCX"), and the badge carries the family color through the queue.
- Unsupported drops show the badge in `mute` with the family color dropped —
  the system says "we don't smelt this" without shouting.
- Icons render as inline SVG (stroke = currentColor), 16/20/24 px grid, no emoji.

## 8. Motion spec (clamped to CLAUDE.md §8 — UI < 300 ms)

| Moment | Duration | Easing | Props |
|---|---|---|---|
| Button hover / press | 150 ms | `ease` / `ease-out` | color, `scale(0.97)` on active |
| Dropzone heat (drag-over) | 200 ms | `ease-out` | border-color, glow opacity |
| Drop flash | 250 ms | `ease-out` | glow opacity |
| Queue row enter | 200 ms | `ease-out` | opacity + `translateY(4px)` |
| Row status flip (smelt→done) | 200 ms | `ease-out` | color, opacity — no layout shift |
| Pane crossfade (furnace→workspace) | 250 ms | `ease-out` | opacity + transform |
| Indeterminate progress | linear | `linear` | translateX shimmer |

No motion on: status ticks, per-file elapsed counter (tens/day → near-imperceptible),
hover micro-feedback on queue rows (color only). `prefers-reduced-motion` drops all
transform-based motion, keeps color/opacity state changes.

## 9. Copy voice

Active, plain, industrial without cosplay. The user does the smelting; the app is
the furnace.

- Actions named by what they do: **Choose files**, **Copy markdown**, **Download .md**,
  **Download .zip with images**, **Cancel smelt**.
- Errors name the failure and the fix, in the product's voice, per the engine's
  error taxonomy (`lib/converter/errors.ts` — `unsupported`, `malformed`,
  `encrypted`, `resourceLimit`, `missingPart`, `engine`, plus the scanned-PDF
  refinement: "This PDF is scanned — the pages are images with no text layer.
  Firecrawl's Parse API can OCR it; a text-based PDF works here.").
- Empty states are invitations: the furnace copy *is* the empty state.
- Privacy is stated once, plainly, in the top bar: **"Converts in your browser —
  files never leave."** No padlock theater.

## 10. Critique pass (before building)

Checked against the three AI-slop clusters and the data-backed default:

- ❌ *Cream + serif + terracotta* — rejected: the ingot paper is cool white
  (`#F7F7F5`), the accent is molten amber, the display face is a condensed grotesque.
- ❌ *Near-black + acid green* — rejected: the dark floor is blue-gray iron
  (`#101418`), the accent is warm furnace orange, and — decisively — the page's
  center of gravity is a *bright paper surface*, not the dark chrome. Dark is the
  frame, not the mood.
- ❌ *Newspaper hairline broadsheet* — rejected: hairlines are `line` at 1 px but
  the layout is a tool workspace, not columns.
- ❌ *The generic converter* (per ui-ux-pro-max's own data-backed output for this
  brief: "document grey + scan blue, Plus Jakarta Sans, App Store hero") — rejected
  wholesale: no device mockups, no screenshots carousel, no ratings, no blue CTA.
  This brief is a *tool*, and the direction treats it as one.
- ✅ The direction survives: the furnace interaction is the product made visible;
  the dark/bright inversion encodes the conversion itself.

**Spend is in one place**: the furnace. Panels, type, and motion stay disciplined
and quiet around it.

## 11. Quality floor (non-negotiable)

- Responsive 375 → 1440 px; single column below 768 px.
- Keyboard: every control reachable, visible `molten` focus ring, 44×44 px targets
  (or 40 px with adequate spacing), Enter/Space on the dropzone, Escape cancels
  selection.
- `aria-*`: dropzone labelled + `aria-disabled` while the engine loads; queue rows
  `aria-busy` while smelting; progress uses `role="progressbar"` with
  `aria-valuetext` (indeterminate — never fake percentages); live regions for
  status flips and errors.
- `color-scheme: dark`; `prefers-reduced-motion` honored; contrast ≥4.5:1
  (all tokens above are verified).
- CLS < 0.1: reserved workspace dimensions, `min-height` on the ingot pane.
- No raw hexes in components — every value above lands as a Tailwind v4
  `@theme` token (`--color-foundry`, `--color-molten`, …) and shadcn semantic
  tokens where they map (background, foreground, ring, destructive).
