import type { NextConfig } from "next";

/**
 * docsmelt — fully static, zero-server app.
 *
 * - `output: 'export'` → `next build` emits `out/`; Vercel serves it directly.
 * - webpack mode is pinned via the `--webpack` flag in package.json scripts
 *   (dev AND build), because Turbopack's `.wasm` asset handling still has
 *   gaps for the wasm-bindgen web-target pattern and the worker chunk
 *   (see docs/architecture.md §Build mode). There is no config-file
 *   equivalent — the flag is the only opt-out.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
};

export default nextConfig;
