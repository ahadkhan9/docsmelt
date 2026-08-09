/**
 * PWA pieces that are unit-testable: the manifest shape and the shell
 * asset collector (the wasm must NOT be precached — it's a lazy cache).
 * The service worker itself is verified manually (README documents the
 * offline check steps).
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../app/manifest";
import { collectShellAssets } from "../../scripts/gen-sw-manifest.mjs";

describe("PWA manifest", () => {
  it("carries the foundry theme and the ingot icons", () => {
    const m = manifest();
    expect(m.name).toContain("docsmelt");
    expect(m.theme_color).toBe("#101418");
    expect(m.background_color).toBe("#101418");
    expect(m.display).toBe("standalone");
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.src === "/icon-192.png")).toBe(true);
    expect(icons.some((i) => i.src === "/icon-512.png")).toBe(true);
    expect(icons.some((i) => i.src === "/icon.svg")).toBe(true);
  });
});

describe("collectShellAssets", () => {
  it("lists hashed shell assets but never the wasm engine", () => {
    const dir = mkdtempSync(join(tmpdir(), "docsmelt-sw-"));
    mkdirSync(join(dir, "_next/static/chunks"), { recursive: true });
    mkdirSync(join(dir, "_next/static/media"), { recursive: true });
    writeFileSync(join(dir, "_next/static/chunks/main-app-abc.js"), "");
    writeFileSync(join(dir, "_next/static/chunks/815.def.js"), "");
    writeFileSync(join(dir, "_next/static/css/x.css"), "");
    writeFileSync(join(dir, "_next/static/media/font.woff2"), "");
    writeFileSync(join(dir, "_next/static/media/anydoc_wasm_bg.1234.wasm"), "");
    const assets = collectShellAssets(dir);
    expect(assets).toContain("/_next/static/chunks/main-app-abc.js");
    expect(assets).toContain("/_next/static/media/font.woff2");
    expect(assets.some((a) => a.endsWith(".wasm"))).toBe(false);
  });

  it("tolerates a missing static dir (pre-build)", () => {
    const dir = mkdtempSync(join(tmpdir(), "docsmelt-sw2-"));
    expect(collectShellAssets(dir)).toEqual([]);
  });
});
