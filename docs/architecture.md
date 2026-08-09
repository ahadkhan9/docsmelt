# docsmelt — Architecture

A zero-server document converter: office files in, Markdown out, entirely in
the visitor's browser via Firecrawl's AnyDoc engine compiled to WebAssembly.

```
┌───────────── main thread ─────────────┐     ┌──── converter worker (×1–4) ────┐
│ dropzone → useConverter (hook)        │     │                                 │
│   │                                   │ RPC │  init({ module_or_path })       │
│   ▼                                   │────►│  formatFromBytes / formatFromPath│
│ ConverterPool ── FIFO queue ──────────┤     │  toMarkdownBytes / toDocument   │
│   │ memory guard · cancel · respawn   │◄────│  reply(jobId, result|error)     │
│   └─ WebAssembly.Module (compiled 1×) ┘     │  (assets transferred, 0-copy)   │
└───────────────────────────────────────────────┴────────────────────────────────┘
```

## Build mode — webpack, deliberately

`next build --webpack` (and `next dev --webpack`) are pinned in
`package.json` scripts. There is **no config-file equivalent** — the flag is
the only way to opt out of Turbopack, and scripts are exactly what Vercel
runs. Rationale: Turbopack's `.wasm` asset story (vercel/next.js #84972 and
discussion #75430) still lacks webpack-style asset rules; the wasm-bindgen
web-target pattern (`new URL('*.wasm', import.meta.url)` + fetch) happens to
work on Turbopack today, but webpack mode covers the worker chunk and the
emitted wasm asset with zero config. `output: 'export'` keeps the zero-server
story; Vercel serves `out/` with the right `application/wasm` MIME out of
the box.

## The protocol (`lib/converter/protocol.ts`)

One shared contract, ~60 lines, job-id based — the pool can grow to N
workers without touching the worker file. Both directions are validated by
runtime guards (`isWorkerRequest` / `isWorkerResponse`, unit-tested).

| Direction | Type | Payload |
|---|---|---|
| main → worker | `module` | a compiled `WebAssembly.Module` (structured-cloneable, refcounted) |
| main → worker | `detect` | file bytes + name → returns the format (`formatFromBytes ?? formatFromPath`) |
| main → worker | `convert` | bytes + optional format + `wantDocument` → markdown string **or** `Document` (blocks + assets) |
| main → worker | `ping` | liveness (unused in prod) |
| worker → main | `ready` | the instance is initialized with the shared Module |
| worker → main | `detected` | `{ format }` |
| worker → main | `result` | `{ ok: true, format, result }` or `{ ok: false, code, message }` |
| worker → main | `fatal` | poisoned worker — main thread terminates + respawns |

Transfer semantics:

- **Input bytes are transferred**, never copied (`postMessage(msg, [buffer])`
  — ~45× cheaper than structured clone; the main-thread copy detaches, which
  is intended).
- **Asset bytes are transferred** out of the worker (they are serde-built
  copies, detachable). Markdown strings clone directly — for 50 MB that is
  still faster than any encode/transfer round-trip.
- **Views over wasm linear memory can never be transferred** (engines refuse
  with `DataCloneError`) — the worker only ever transfers buffers it owns.

## The pool (`lib/converter/pool.ts`)

- **Lazy, never at module scope** — created on the first convert gesture.
  Module-scope workers break static prerender (`Worker is not defined` on
  Node during `next build`).
- **One compile, many instances**: the main thread compiles the ~6.5 MB
  module once (`compileStreaming`, off-main-thread, with a byte-compile
  fallback for MIME mismatches) and hands the `WebAssembly.Module` to each
  worker. Instantiation is ~100–200 ms per worker; compilation is ~3–6 s and
  happens exactly once per session. If the compile ever fails, workers fall
  back to self-fetching (`init()` without a module).
- **Size is a memory decision**: `min(hardwareConcurrency, 4)` workers on
  desktop, 1 on mobile. Each worker owns a grow-only linear memory that
  never shrinks.
- **Memory guard**: a job starts only if `fitsBudget(in-flight, next)`, where
  `estimatePeak = size × 6 + 256 MiB` and budget is 1.5 GiB desktop /
  700 MiB mobile (both exported and unit-tested). The queue scans for the
  first job that fits, so a small file behind a huge one isn't starved.
  Per-file cap: 100 MB desktop, 40 MB mobile. These caps exist because
  **OOM is not catchable** — the engine's own limits (128 MiB/entry,
  512 MiB total, 2M XML nodes) can legally sum to ~1.5–2 GB and Safari
  kills the tab with no error surface.
- **Cancel = terminate** — a synchronous wasm call has no other abort
  primitive. The in-flight worker is killed and respawned from the cached
  Module (~100–200 ms); queued jobs are simply dropped.
- **Workers are disposable, not resettable** — panics/traps poison the
  instance (`catch_unwind` can't help). Any engine-level failure terminates
  and respawns; the failed job is rejected with `code: 'engine'` and a retry.
- **Idle teardown**: 60 s after the last job, workers are terminated but the
  compiled Module is kept — a cold respawn costs only instantiation.
  `terminate()` is the only reliable way to release wasm linear memory.
- `pagehide` releases everything (WebKit leaks worker memory across
  reloads).
- **Startup robustness**: `ensure()` re-pumps the queue after workers spawn
  (jobs enqueued while the engine was loading must not sit forever), waits
  for each worker's `ready` with a 15 s timeout (rejecting on `fatal`), and
  retries the whole spawn once before surfacing an engine error.

## Errors → UX (`lib/converter/errors.ts`)

The engine publishes stable machine-readable codes (`error.code`, pinned by
its own tests). The app maps them to copy and never shows raw strings:

| code | meaning → title |
|---|---|
| `unsupported` | unknown/unconvertible → "We can't smelt this file" |
| `malformed` | structurally unusable → "File is corrupt or unreadable" |
| `encrypted` | password-protected → "Password-protected file" |
| `resourceLimit` | engine safety cap → "File exceeds safety limits" |
| `missingPart` | required part absent → "File is incomplete" |
| `engine` | wasm trap/poison → "Converter crashed" (auto-restarts) |
| `fileTooLarge` | app-side pre-flight cap → "File too large for in-browser conversion" |

Refinements: `unsupported` + `pdf` → "Scanned PDF — no text layer" (OCR via
Firecrawl's Parse API is the hint, with a note that it's the only path that
would leave the browser); `unsupported` + `.csv` name → "CSV needs its
format named" (CSV has no signature; the extension names it).

## Conversion flow (per file)

1. **Detect** — bytes are read and transferred to a worker; the format is
   returned for the badge before any conversion work starts.
2. **Convert** — a fresh read of the file (the first read was transferred)
   goes to `toMarkdownBytes` (or `toDocument` when the .zip is asked for).
3. **Result** — the markdown lands in the ingot pane; the row shows honest
   elapsed time (a synchronous wasm call can't be chunked — progress is
   indeterminate by design, never fake percentages). Empty documents show
   "No text content was extracted"; outputs over 1 MB render raw-only
   (react-markdown's parse is synchronous — a multi-MB document would
   freeze the main thread). A cancel during packing keeps the markdown
   visible and its download buttons available.
4. **.zip** — `toDocument` runs lazily only when the user asks (double
   clicks are guarded), then jszip packs `{name}.md` + `assets/{id}.{ext}`
   (mediaType → extension map). PDF has no document model, so it's
   `.md`-only.

## Verified engine behavior (edge-case suite)

The smoke + edge-case suites run the real wasm binary against forged
samples (`scripts/make-samples.mjs`): zero-byte files land in the error
taxonomy; empty-but-valid docx yields empty markdown; truncated zips →
`malformed`; image-only PDFs → `unsupported` with the OCR message; a file
renamed with a wrong extension still converts via content detection;
`.png` → `unsupported`; a hand-forged OLE compound file naming
`EncryptedPackage` → `encrypted` (detection deliberately returns
`undefined` so the app can report the precise code); a docx with an
embedded PNG round-trips through `toDocument` assets byte-for-byte.

## Files

| Path | Role |
|---|---|
| `lib/converter/protocol.ts` | message union + runtime guards |
| `lib/converter/converter.worker.ts` | the dumb executor (one instance per worker) |
| `lib/converter/pool.ts` | pool, queue, memory guard, lifecycle |
| `lib/converter/useConverter.ts` | React hook — job state, downloads |
| `lib/converter/errors.ts` | error taxonomy → UX copy |
| `lib/converter/formats.tsx` | 20 formats → 5 families (color + glyph) |
| `lib/converter/zip.ts` | markdown + assets → .zip |
| `components/converter-app.tsx` | shell: top bar, furnace, queue, ingot, footer |
| `components/furnace-dropzone.tsx` | the furnace — drag/paste/click/keyboard |
| `components/file-queue.tsx` | per-file status + actions |
| `components/ingot-preview.tsx` | the paper markdown surface |

## Deployment

Static export → Vercel, zero config. `vercel link` + `vercel --prod`; the
build runs `next build --webpack` via the package.json script. `.wasm` is
served as `application/wasm` (Vercel default) with hashed `_next` asset
caching. No COOP/COEP, no SharedArrayBuffer, no CSP changes needed — the
single-threaded wasm demands none of them.
