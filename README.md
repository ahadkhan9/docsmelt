# docsmelt 🔥

**Smelt documents into markdown.** Drag-drop (or click, or paste) any office
document — PDF, DOCX, XLSX, PPTX, RTF, EPUB, ODS, CSV and more — and it
converts to clean Markdown in your browser via WebAssembly. Nothing is
uploaded, so nothing can leak. No server, no accounts, no files on disk
anywhere but yours.

Built on [Firecrawl AnyDoc](https://github.com/firecrawl/anydoc) (MIT) —
the same engine that powers their Parse API, running fully client-side.

## The foundry

Dark night-shift floor, one molten interaction, one bright ingot. The drop
zone is a furnace mouth — dragging a document over it heats the frame, and
the markdown result lands as a cast ingot of paper. Full direction:
[`docs/design-direction.md`](docs/design-direction.md).

## How it works

- Conversion runs in a **lazy pool of module workers** sharing one
  main-thread-compiled `WebAssembly.Module` — the UI never blocks.
- The engine is **synchronous and single-threaded**, so each worker is a
  disposable executor: cancel = terminate, crash = respawn
  (~100–200 ms from the cached Module).
- Pre-flight caps (100 MB desktop / 40 MB mobile) and a pool memory guard
  keep the browser alive — wasm OOM is not catchable, so the caps are the
  graceful "too large" path.
- Every format gets a badge (family color + glyph), per-file progress
  (indeterminate — a sync wasm call can't be chunked), and honest
  per-error copy (`unsupported`, `malformed`, `encrypted`,
  `resourceLimit`, `missingPart` — plus a scanned-PDF "needs OCR" hint).
- The `.zip` download runs `toDocument` lazily and packs the markdown with
  all embedded images.
- Architecture: [`docs/architecture.md`](docs/architecture.md).

## Development

```bash
npm install
npm run dev        # webpack mode (Turbopack has a .wasm asset gap — pinned deliberately)
npm test           # 21 unit + real-engine smoke tests
npm run build      # static export → out/  (next build --webpack)
```

Samples for testing are forged by `node scripts/make-samples.mjs`
(hand-written OOXML/EPUB, a hand-computed-xref PDF).

## Privacy

The app is a static site. There is no backend, no telemetry, no API key —
the conversion engine is a 6.5 MB `.wasm` module compiled into your tab.
"Files never leave the browser" is not a promise, it's an architecture.
