# Mobile preview — the dedicated component ("The Contents Pouch")

> Design note for the mobile preview rework. The round-2 sticky chip strip
> is replaced by a dedicated touch-first component.

## 1. Why the phone controls failed (evidence)

document-preview.tsx:228 — the mobile strip is `position: sticky` AND
`overflow-x: auto` on the SAME element. An element with a non-visible
overflow is a scroll container, and a scroll container's sticky position
sticks within ITS OWN scrollport — the strip never actually sticks inside
the preview scroller (it scrolls away; the round-2 escape affordance was
ineffective on every browser). Worse on iOS: a horizontal scroll container
nested inside a vertical scroller is precisely where Safari's gesture
recognition swallows taps on child buttons — "taps don't respond." The
fix is structural, not cosmetic: a fixed-position control outside any
scroll container.

## 2. The pattern

- **A fixed bottom-left button** (`position: fixed`, above `env(safe-area-
  inset-bottom)`): a 48px rounded button with a list glyph + "Contents".
  Thumb-reachable, never scrolls away (the trap is over by construction),
  `aria-expanded`, keyboard focusable.
- **A bottom-sheet TOC drawer** rising over the preview: header
  ("Contents · N sections · M chunks" + Close), a scrollable body with
  `overscroll-behavior: contain`, `role="dialog" aria-modal` + focus
  management (focus the close on open, Esc closes, backdrop tap closes),
  safe-area padding.
- **The TOC content**: a leading "Top" item (the escape affordance
  survives), the heading tree (indent by level, from parseSections), and —
  when chunking is on — a "Chunks" section (number · tokens · heading
  label). The active item reflects the mobile scroll-spy; tapping jumps
  (reduced-motion-aware) and closes the drawer.
- **The scroller**: plain paper surface with the shared section/chunk
  blocks + the molten level rail (unchanged CSS timeline). No sticky, no
  nested scroll containers.
- Motion: drawer slides up 200 ms ease-out (`transform` only; reduced
  motion → fade), button press 150 ms. 44px+ targets throughout.

## 3. Critique pass

- "Bottom sheet TOC" is a common mobile pattern — the execution must be
  foundry: mono chips, molten active state, Big-Shoulders section
  numerals in the tree, the level rail beside the content, the drawer's
  surface in the paper tones with the dark chrome outside.
- The fixed button could cover content — it sits at the bottom-left over
  the paper pane; the pane's right-edge rail stays clear; the drawer
  overlays it entirely when open (modal).
- Removing the sticky strip is a regression of nothing: it never worked
  (above), and the drawer + Top cover both escape guarantees.
- ✓ Design survives: one fixed control, one modal, both flows, no
  hover-only, no nested scroll traps.
