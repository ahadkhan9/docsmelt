/**
 * Benchmark — measures the REAL engine on the forged samples and writes
 * lib/benchmark/data.json, which the /benchmark page renders.
 * Run: node scripts/benchmark.mjs   (re-run to refresh the numbers)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import init, { formatFromBytes, formatFromPath, toMarkdownBytes } from "@firecrawl/anydoc-wasm";

const RUNS = 20;
const SAMPLES = [
  { format: "docx", file: "sample.docx" },
  { format: "xlsx", file: "sample.xlsx" },
  { format: "epub", file: "sample.epub" },
  { format: "csv", file: "sample.csv" },
  { format: "rtf", file: "sample.rtf" },
  { format: "pdf", file: "sample.pdf" },
  { format: "docx (image)", file: "sample-image.docx" },
];

await init({
  module_or_path: readFileSync("node_modules/@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm"),
});

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const results = {};
for (const { format, file } of SAMPLES) {
  const bytes = new Uint8Array(readFileSync(`samples/${file}`));
  const detected = formatFromBytes(bytes) ?? formatFromPath(file);
  // warmup
  toMarkdownBytes(bytes, detected);
  const timings = [];
  let chars = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const started = performance.now();
    chars = toMarkdownBytes(bytes, detected).length;
    timings.push(Math.max(0.05, performance.now() - started));
  }
  results[format] = {
    file,
    detected,
    medianMs: Number(median(timings).toFixed(2)),
    minMs: Number(Math.min(...timings).toFixed(2)),
    chars,
    runs: RUNS,
  };
}

mkdirSync("lib/benchmark", { recursive: true });
const payload = {
  generated: new Date().toISOString().slice(0, 10),
  engine: "anydoc-wasm 0.1.7",
  runsPerSample: RUNS,
  samples: results,
};
writeFileSync("lib/benchmark/data.json", JSON.stringify(payload, null, 2) + "\n");
console.log("benchmark written:", JSON.stringify(results, null, 1));
