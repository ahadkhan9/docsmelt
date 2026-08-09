# Mobile outline navigation — rethink ("the one-way trap")

> Design doc for the mobile navigation flaw: jumping to a section (or
> chunk) deep in a document strands the user — the chip strip scrolled
> away, no way back, no way to the top.

## 1. The flaw

On mobile (<768 px) the outline is a horizontal chip strip ABOVE the
preview scroller (document-preview.tsx). Tapping a chip jumps deep into
the document; the strip is not sticky, so it scrolls out of view the
moment the jump lands. The user is stranded: no outline, no chunk rail,
no scroll-to-top. Same trap in chunk mode (chunk-number chips).

## 2. The guarantee

From ANY section deep in a document, in ≤1 tap the user can (a) return
to the outline/jump UI and (b) reach the top of the document. Both must
hold in section mode AND chunk mode. 44px targets, no hover-only, no
overlay chrome, keyboard + reduced-motion respected, ≤300 ms
transform/opacity motion.

## 3. Candidates (evaluated)

| Pattern | Verdict |
|---|---|
| Sticky top nav bar (chips + leading "Top" control) | ✅ **Chosen** — the strip stays pinned at the top of the preview body; the leading control scrolls to the top. Both guarantees in one always-visible element, zero overlay, keyboard-first (the buttons are in the DOM tab order). |
| Floating action button (back-to-top FAB) | ❌ Overlay chrome; a second affordance for outline-vs-top multiplies; overlaps the molten level rail; "floating" is hover-adjacent on touch. |
| Bottom sheet outline | ❌ Hidden behind a trigger — the trap recurs if the trigger scrolls away; adds sheet chrome, `overscroll-behavior` handling, and focus management for a single strip. |
| Scroll-driven collapse/peek | ❌ The nav disappears exactly when the user is deep — the trap again, with extra motion complexity. |
| In-content "back to outline" link at section starts | ❌ N links instead of one control; only helps after a jump, not during browsing. |

## 4. The chosen design

- The mobile nav container becomes **sticky** (`position: sticky; top: 0;
  z-index` above the scroller, own background so chips don't show through)
  — it never leaves the viewport, in either mode.
- A leading control in the strip: **↑ Top** (ArrowUp icon + label, 44px
  min-height) — scrolls the pane to the top (`scrollIntoView` on the
  pane's first block, reduced-motion-aware). One tap, always visible.
- The strip keeps its horizontal scroll (touch-native), the chips keep
  `aria-current`, and the chunk chips keep the roving ArrowUp/Down
  keyboard behavior where applicable.
- Desktop unchanged (the rail is persistent by design).
- Motion: none needed beyond the existing 150 ms color transitions —
  stickiness is layout, not animation.

## 5. Critique pass

- Is "sticky bar" the generic answer? It is the *minimal* answer — and
  the alternative "patterns" (FAB, sheet) are the generic ones for this
  problem class. The foundry execution carries it: mono chips, molten
  active state, the Big-Shoulders section numerals, the level rail still
  tracking beside it.
- The Top control could be seen as a band-aid — but with the strip
  sticky, Top is one control completing the loop (jump → read → top →
  outline again), not a separate rescue button.
- Chunk mode: the same strip with chunk numbers + Top gives per-chunk
  jumps the same guarantees.
- ✓ The design survives: one sticky element, one control, both
  guarantees, no overlay, no new motion.
