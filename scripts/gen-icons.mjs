/**
 * Generates the PWA install icons (192/512 PNG) — the ingot mark drawn
 * pixel by pixel with 4× supersampling for smooth edges. Pure Node (zlib),
 * no deps. Run: node scripts/gen-icons.mjs  → writes public/icon-192.png,
 * public/icon-512.png.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

// ── tiny PNG encoder ─────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const encodePng = (width, height, rgba) => {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

// ── the ingot, in normalized coordinates (0..1) ──────────────────────────
const FOUNDRY = [0x10, 0x14, 0x18, 255];
const PAPER = [0xf7, 0xf7, 0xf5, 255];
const MOLTEN = [0xff, 0x9e, 0x3d, 255];
const INK = [0x1f, 0x23, 0x28, 165];

const inRoundedRect = (x, y, rx, ry, r) => {
  const cx = Math.min(Math.max(x, rx + r), 1 - rx - r);
  const cy = Math.min(Math.max(y, ry + r), 1 - ry - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r || (x >= rx && x <= 1 - rx && y >= ry && y <= 1 - ry);
};

/** Sample the ingot at (x, y) in 0..1 space → [r,g,b,a]. */
const sample = (x, y) => {
  // backdrop: full-bleed foundry rounded square
  if (!inRoundedRect(x, y, 0.06, 0.06, 0.16)) return [0, 0, 0, 0];
  const body = inRoundedRect(x, y, 0.24, 0.4, 0.09);
  if (!body) return FOUNDRY;
  const moltenBand = inRoundedRect(x, y, 0.24, 0.4, 0.09) && y <= 0.55;
  if (moltenBand) return MOLTEN;
  // stamp lines on the paper body
  const line = (y0) => Math.abs(y - y0) < 0.012 && x > 0.33 && x < 0.67;
  if (line(0.72) || line(0.8)) return INK;
  return PAPER;
};

function drawIcon(size) {
  const scale = 4; // supersample
  const big = size * scale;
  const rgba = Buffer.alloc(big * big * 4);
  for (let py = 0; py < big; py += 1) {
    for (let px = 0; px < big; px += 1) {
      const [r, g, b, a] = sample((px + 0.5) / big, (py + 0.5) / big);
      const i = (py * big + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
  // box downsample
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const i = ((y * scale + sy) * big + x * scale + sx) * 4;
          r += rgba[i];
          g += rgba[i + 1];
          b += rgba[i + 2];
          a += rgba[i + 3];
        }
      }
      const n = scale * scale;
      const i = (y * size + x) * 4;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
      out[i + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, size, out);
}

mkdirSync("public", { recursive: true });
writeFileSync("public/icon-192.png", drawIcon(192));
writeFileSync("public/icon-512.png", drawIcon(512));
console.log("icons written: public/icon-192.png, public/icon-512.png");
