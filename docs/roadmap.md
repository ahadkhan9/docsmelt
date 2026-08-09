# docsmelt — roadmap

Ranked by (impact × feasibility ÷ effort), grounded in the zero-server,
worker-pool, static-export architecture. Full comparison vs the official
anydoc demo: `/home/ahadk9/research/anydoc/docsmelt-vs-demo-and-roadmap.md`.

Tags: ⚡ quick win (<2 h) · 🔨 weekend build (3–6 h) · 🚀 moonshot (8+ h)

## Next 3 moves (build these first)

1. **Chunk-for-RAG preset + export-all-as-zip** (~8 h) — split converted
   markdown into fixed-token chunks (500/1000 tok, heading-aware, ~10%
   overlap) for LLM pipelines; download chunks or the whole batch as one
   zip. Pure client text processing — the differentiator no converter demo
   has. Reuses the existing jszip/download plumbing.
2. **Folder-drop + queue multi-select** (~5 h) — traverse dropped
   directories (`webkitGetAsEntry`) into the queue; checkboxes → batch
   delete/export/copy. Closes the real-world batch gap.
3. **Ingot favicon + OG image + benchmark page** (~5 h) — an SVG ingot
   mark (replaces the default favicon), a static social card for repo/link
   shares, and a page with measured conversion numbers (real engine runs,
   like the test suites) plus the 21-format table.

## Backlog

| Idea | Tag | Why |
|---|---|---|
| PWA / offline (manifest + hand-rolled SW, cache wasm after first visit) | 🔨 3–4 h | "No server, no network" completes the story |
| Conversion history (IndexedDB) — restore queue after reload | 🔨 4–6 h | Pairs with PWA; continuity |
| Keyboard-first (⌘O / ⌘⇧V / ⌘D / ⌘R / 1–9 row select) | 🔨 3–4 h | Dev audience; cheap |
| GitHub gist export (OAuth PKCE popup, token in memory) | 🔨 6–8 h | Zero-server-compatible if the secret never touches a server |
| OCR for scanned PDFs (user-pasted Firecrawl key, browser calls Parse) | 🔨 4–6 h | Only if Parse allows browser CORS — verify first; otherwise an optional single serverless function (secret stays server-side) |
| HTML export / copy as HTML | ⚡ 1–2 h | Reuse MarkdownView + template |
| Google Drive import/export (bring-your-own GCP client ID) | 🚀 10–12 h | Zero-server possible; setup friction high |
| PDF page-range extraction (pdf.js slicing → engine) | 🚀 10–12 h | One justified dep; memory care needed |

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
