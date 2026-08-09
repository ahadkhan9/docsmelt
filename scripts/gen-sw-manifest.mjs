/**
 * Post-build service-worker manifest. Walks out/_next/static and writes
 * out/sw-manifest.json — the list of hashed shell assets the SW precaches
 * at install. The wasm engine is deliberately EXCLUDED: it is cached
 * lazily on first fetch (a repeat visitor converts fully offline after one
 * online visit; first-time installs don't pay 6.5 MB up front).
 * Run automatically after `next build` (see package.json "build").
 */
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function collectShellAssets(outDir) {
  const assets = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (name.endsWith(".wasm")) {
        // engine → lazy runtime cache, not precache
      } else {
        assets.push("/" + full.split(/[\\/]/).slice(1).join("/"));
      }
    }
  };
  const staticDir = join(outDir, "_next", "static");
  if (existsSync(staticDir)) walk(staticDir);
  return assets;
}

export function main(outDir) {
  const assets = collectShellAssets(outDir);
  const payload = { version: 1, assets };
  writeFileSync(join(outDir, "sw-manifest.json"), JSON.stringify(payload));
  console.log(`sw-manifest.json: ${assets.length} shell assets (wasm excluded → lazy cache)`);
}

if (process.argv[1] && process.argv[1].endsWith("gen-sw-manifest.mjs")) {
  main(process.argv[2] ?? "out");
}
