<div align="center">

# docsmelt

**Smelt documents into markdown — in your browser. Nothing is uploaded, so nothing can leak.**

[![Live](https://img.shields.io/website?url=https%3A%2F%2Fdocsmelt.vercel.app&label=live&color=FF9E3D)](https://docsmelt.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org)
[![Engine](https://img.shields.io/badge/engine-Firecrawl%20AnyDoc%20WASM-FF9E3D)](https://github.com/firecrawl/anydoc)
[![Stars](https://img.shields.io/github/stars/ahadkhan9/docsmelt)](https://github.com/ahadkhan9/docsmelt)

[Features](#features) • [Supported formats](#supported-formats) • [How it works](#how-it-works) • [Development](#development) • [Privacy](#privacy)

</div>

Drop a document on the page and it converts to clean, GitHub-flavored Markdown while the file stays on your machine. The whole conversion engine — [Firecrawl AnyDoc](https://github.com/firecrawl/anydoc), compiled to WebAssembly — runs in a worker inside your tab. There is no server, no upload, no account.

## Features

- **21 office formats, one output.** DOC/DOCX, PPT/PPTX, XLS/XLSX, ODF, RTF, EPUB, PDF and more all parse into the same clean Markdown pipeline — tables, headings, lists, footnotes, embedded images included.
- **Files never leave the browser.** Conversion is a 6.5 MB WASM module running client-side. The privacy guarantee is the architecture, not a policy page.
- **No frozen tabs.** A lazy pool of module workers shares one compiled `WebAssembly.Module`; the main thread never blocks. Cancel a conversion by terminating the worker, and a crashed one respawns in ~100–200 ms.
- **Markdown pass-through.** Drop a `.md`, `.markdown` or plain-text `.txt` file and it's recognized instantly — preview, copy, download, no conversion involved.
- **Batch, paste, queue.** Add many files at once (folders included — dropped directories are walked recursively), paste from the clipboard, watch per-file status, download each result as `.md` or a `.zip` with all embedded images, or **Export all** as one archive.
- **Chunk for RAG.** Any converted document splits into LLM-ready chunks — 500/1000-token presets, heading-aware boundaries, ~10% overlap, code fences never split — downloadable as numbered `.md` files plus an index.
- **Multi-select.** Checkboxes with shift-range select → batch delete, export as `.zip`, copy all markdown.
- **History & offline.** Done jobs persist to IndexedDB (restore banner after reload, 50 MB cap); the app is a PWA — installable, and converts fully offline after one online visit.
- **Keyboard-first.** `⌘O` open, `⌘⇧V` paste, `⌘D` download, `Esc` cancel/clear, `1–9` select rows.
- **Honest errors.** The engine's error taxonomy (`unsupported`, `malformed`, `encrypted`, `resourceLimit`, `missingPart`) maps to copy that names the problem and the way out — including a dedicated "scanned PDF needs OCR" hint.
- **Every format is designed-for.** Each format family has its own color and glyph, shown as a badge before conversion even starts.
- **Measured, not promised.** A [benchmark page](https://docsmelt.vercel.app/benchmark) reports real median conversion times from the actual wasm binary.

## Supported formats

| Family | Formats |
| --- | --- |
| Word | `.doc` `.docx` `.docm` `.odt` `.rtf` |
| PDF | `.pdf` (text-based; scanned/image-only PDFs are detected and reported) |
| Spreadsheet | `.xls` `.xlsx` `.xlsm` `.xlsb` `.ods` `.csv` |
| Presentation | `.ppt` `.pps` `.pot` `.pptx` `.pptm` `.ppsx` `.ppsm` `.odp` |
| Book | `.epub` |
| Plain text | `.md` `.markdown` `.txt` (pass-through, no conversion) |

> [!TIP]
> Format detection is content-based, so a mislabeled file still converts. The exception is CSV, which carries no signature — it needs a `.csv` name (or the format passed explicitly) to be recognized.

> [!NOTE]
> Scanned and image-only PDFs have no text layer, so they can't be converted locally. Firecrawl's hosted [Parse API](https://firecrawl.dev/parse) handles OCR for those.

## How it works

The engine (AnyDoc) is synchronous and single-threaded, so the app runs it inside disposable Web Workers:

- The pool compiles the WASM module **once** on the main thread, then instantiates workers from it on demand — ~100–200 ms per worker instead of re-downloading the 6.5 MB module.
- Pre-flight size caps (100 MB desktop / 40 MB mobile) plus a pool memory guard keep the tab alive. WASM out-of-memory is not catchable, so the caps are the graceful "file too large" path.
- Markdown pass-through and unsupported-type detection happen before the engine is ever loaded — a Markdown-only session never downloads the WASM at all.

See [`docs/architecture.md`](docs/architecture.md) for the full protocol, pool mechanics, and memory model. The visual direction — "The Foundry": a dark night-shift floor, one molten interaction, one bright ingot — is documented in [`docs/design-direction.md`](docs/design-direction.md).

## Development

```bash
npm install
npm run dev      # webpack mode — pinned deliberately (Turbopack has a .wasm asset gap)
npm test         # vitest suite: protocol, error mapping, formats, edge cases (63 tests)
npm run build    # static export → out/
```

Test fixtures are forged by `node scripts/make-samples.mjs` (hand-written OOXML/EPUB, a hand-computed-xref PDF), so the edge-case suite runs without downloading anything.

## Privacy

The app is a static site. There is no backend, no telemetry, no API key. Every conversion happens in a WASM worker inside your tab, and the resulting Markdown is yours to copy or download. "Files never leave the browser" is a statement of architecture, not a marketing claim.

## Acknowledgements

Built on [Firecrawl AnyDoc](https://github.com/firecrawl/anydoc) (MIT) — the same engine that powers Firecrawl's Parse API, running fully client-side.
