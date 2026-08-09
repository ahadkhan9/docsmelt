import type { Metadata } from "next";
import Link from "next/link";
import bench from "@/lib/benchmark/data.json";
import {
  FAMILY_FORMATS,
  FAMILY_LABEL,
  FAMILY_OF,
  FAMILY_TOKEN,
  type FormatFamily,
} from "@/lib/converter/formats";

export const metadata: Metadata = {
  title: "Benchmarks — docsmelt",
  description:
    "Measured conversion times for the docsmelt in-browser engine — the real WebAssembly binary, median of 20 runs per sample.",
};

const FAMILIES: FormatFamily[] = ["word", "pdf", "sheet", "slide", "book"];

export default function BenchmarkPage() {
  const samples = bench.samples as Record<
    string,
    { file: string; detected: string; medianMs: number; minMs: number; chars: number; runs: number }
  >;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-10 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Measured, not promised
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-foreground sm:text-5xl">
        The furnace, benchmarked.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">
        These are real runs of{" "}
        <span className="font-mono text-[13px] text-foreground">@firecrawl/anydoc-wasm</span>{" "}
        ({bench.engine}) on the forged sample documents in this repo — median of{" "}
        {bench.runsPerSample} conversions per file, measured in Node on this
        machine. In the browser the same binary runs in a worker; your
        mileage varies with hardware, but the engine is the point: pure Rust,
        no services, single-digit milliseconds.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse font-mono text-[13px]">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Format</th>
              <th className="px-4 py-3 font-medium">Sample</th>
              <th className="px-4 py-3 text-right font-medium">Median</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Min</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Chars</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(samples).map(([label, s]) => (
              <tr key={label} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{label}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.file}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-molten">
                  {s.medianMs.toFixed(2)} ms
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {s.minMs.toFixed(2)} ms
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {s.chars.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        Regenerate with <span className="text-steel">node scripts/benchmark.mjs</span> — the
        numbers in <span className="text-steel">lib/benchmark/data.json</span> are committed
        outputs of that script, never hand-written.
      </p>

      <h2 className="mt-10 font-display text-2xl font-semibold text-foreground">
        All 21 formats
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FAMILIES.map((family) => (
          <div key={family} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: `var(--${FAMILY_TOKEN[family]})` }}
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">{FAMILY_LABEL[family]}</p>
            </div>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {FAMILY_FORMATS[family]}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        Formats without a forged sample here (legacy binaries, slides, ODP) are detected and
        converted by the same binary — the sample set is what this page can measure honestly.
        ({Object.keys(FAMILY_OF).length} formats total.)
      </p>

      <div className="mt-10 rounded-xl border border-border bg-card p-5">
        <p className="text-sm leading-relaxed text-steel">
          Every number above was produced in your browser's engine class: the same WebAssembly
          binary ships to visitors, runs single-threaded in a worker, and never sends a byte
          anywhere. <Link href="/" className="text-molten underline underline-offset-2 hover:opacity-80">Back to the furnace →</Link>
        </p>
      </div>
    </main>
  );
}
