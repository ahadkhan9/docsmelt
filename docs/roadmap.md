# docsmelt — roadmap

Ranked by (impact × feasibility ÷ effort), grounded in the zero-server,
worker-pool, static-export architecture. Full comparison vs the official
anydoc demo: `/home/ahadk9/research/anydoc/docsmelt-vs-demo-and-roadmap.md`.

Tags: ⚡ quick win (<2 h) · 🔨 weekend build (3–6 h) · 🚀 moonshot (8+ h)

## Shipped ✓

- ✓ **Chunk-for-RAG preset + export-all-as-zip** — heading-aware
  fixed-token chunks (500/1000, ~10% overlap, fences intact) with per-row
  panel + stats + numbered zip; Export all packs every done job (md +
  embedded assets + index) into one archive.
- ✓ **Navigated preview + chunk visualization (The Cargo Manifest)** —
  bounded section blocks, outline rail with scroll-spy, per-section copy,
  molten scroll-driven level rail; chunk blocks with stamped dividers,
  chunk rail (keyboard nav), per-chunk copy/download; the visible
  Chunking off/on switch is the Flow A/B state machine (settings edits
  re-chunk the selected job from in-memory markdown); mobile queue rows
  redesigned (ms into the status line, two-tier actions with a More
  strip).
- ✓ **Chunker v2** — atomic tables (delimiter-confirmed, fence-priority,
  oversized-flag), exact token budgets via gpt-tokenizer (cl100k, lazy
  ~1 MB gz vocab, adaptive chars-per-token gate + trim-to-budget,
  CJK character-boundary pre-splitting), presets 256/512/1024 + custom +
  honest overlap UX, `chunks.json` metadata sidecar (heading paths,
  parent refs, table flags), one-shot worker offload above 1 MB.
- ✓ **Folder-drop + queue multi-select** — recursive directory walking
  (entry API, cycle-safe, Firefox fallback with honest messaging);
  checkboxes with shift-range select and batch delete / export / copy.
- ✓ **Branding bundle** — ingot favicon (SVG + 192/512 PNG install icons),
  The-Foundry OG card (1200×630, built at export), and a `/benchmark`
  page with real measured numbers (scripts/benchmark.mjs → committed
  data.json — never hand-written).
- ✓ **PWA / offline** — manifest, hand-rolled service worker (shell
  precache from a post-build sw-manifest; the 6.5 MB wasm caches lazily on
  first use → repeat visitors convert fully offline).
- ✓ **Conversion history (IndexedDB)** — restore banner, 50 MB cap with
  honest trimming, Clear history control; restored jobs keep preview/copy/
  .md (retry/zip need the original file and are disabled).
- ✓ **Keyboard-first** — ⌘O / ⌘⇧V / ⌘D / Esc / 1–9 with editing-context
  guards, kbd hints hidden on touch.

## Next up (backlog)

| Idea | Tag | Why |
|---|---|---|
| GitHub gist export (OAuth PKCE popup, token in memory) | 🔨 6–8 h | Zero-server-compatible if the secret never touches a server |
| OCR for scanned PDFs (user-pasted Firecrawl key, browser calls Parse) | 🔨 4–6 h | Only if Parse allows browser CORS — verify first; otherwise an optional single serverless function |
| HTML export / copy as HTML | ⚡ 1–2 h | Reuse MarkdownView + template |
| PDF page-range extraction (pdf.js slicing → engine) | 🚀 10–12 h | One justified dep; memory care needed |
| Google Drive import/export (bring-your-own GCP client ID) | 🚀 10–12 h | Zero-server possible; setup friction high |

## Rejected (with reasons)

- **Light mode** — "The Foundry" is dark by design; the paper ingot already
  carries the reading surface; a light chrome dilutes the brand.
- **Tesseract.js local OCR** — multi-MB, slow, worse quality than Parse.
- **Side-by-side source diff** — needs client-side rendering of the
  original; heavy, low marginal value over the raw⇄rendered toggle.
- **"Open in" (VS Code/Obsidian/Notion)** — Blob downloads can't open in
  local apps; URIs are fragile; copy/download already feeds those tools.
- **Docs site** — README + architecture.md cover it for now.
- **i18n** — copy is woven through errors/aria; English-dev audience;
  defer until traction demands it.
