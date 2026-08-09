/**
 * Chunk-for-RAG — split converted markdown into fixed-token chunks for
 * LLM pipelines. Pure client-side text processing (zero-server by nature).
 *
 * Rules, in order of importance:
 * 1. Never split a code fence — a chunk boundary inside a fence is pushed
 *    past the closing marker.
 * 2. Never split a table — GFM tables (anydoc emits `| a | b |` rows with
 *    a plain `| --- | --- |` delimiter, `\|`-escaped pipes, single-line
 *    rows with literal `<br>` for multi-line cells) are confirmed by the
 *    delimiter row and treated like fences: one atomic block. A table
 *    larger than the target becomes one chunk flagged `oversizedTable`.
 * 3. Prefer heading boundaries — when a heading arrives while the chunk is
 *    ≥50% full, the chunk closes BEFORE the heading.
 * 4. Token budget is EXACT when a Tokenizer is provided: chars/4 remains
 *    only as the cheap walk gate, with an adaptive chars-per-token ratio
 *    learned per document (so CJK and tables close near the budget instead
 *    of 3× over); the exact check runs at the gate; chunks that still
 *    overshoot are trimmed to the budget at close (tables and fences
 *    exempt — atomicity wins, oversizedTable reports it).
 * 5. ~10% overlap at line granularity, re-seeded into the next chunk.
 * 6. Fence integrity is guaranteed by a final state-machine pass.
 */
import JSZip from "jszip";
import type { Tokenizer } from "./tokenizer";

/** Internal char gate — the walk uses chars as the cheap pre-filter;
 *  exact token checks happen at the gate (see tokenizer.ts). */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface ChunkOptions {
  targetTokens: number;
  /** Defaults to 10% of the target. */
  overlapTokens?: number;
}

export interface RagChunk {
  /** 1-based. */
  index: number;
  /** Last ATX heading line seen ("# Section"), "" if none. */
  heading: string;
  content: string;
  /** Exact tokens when a Tokenizer was provided, else the chars/4 estimate. */
  tokens: number;
  /** True when the chunk contains a table larger than the target. */
  oversizedTable?: boolean;
}

const FENCE_RE = /^(`{3,}|~{3,})/;
const HEADING_RE = /^#{1,6} /;
/** anydoc emits rows at column 0; be lenient to ≤3 spaces of indent. */
const TABLE_ROW_RE = /^ {0,3}\|/;
/** `| --- | --- |` — plain pipes, optionally colon-aligned for other
 *  producers. The delimiter row is what CONFIRMS a table (anti-false-
 *  positive guard for `|`-led prose lines). */
const TABLE_DELIM_RE = /^\|(\s*:?-{3,}:?\s*\|)+\s*$/;
/** Safety cap for the trim scan. */
const TRIM_MAX_STEPS = 200;

/** Track fence state across lines. A closing fence must match the opener's
 *  character; stray closers are ignored (treated as body text). */
function scanFenceState(lines: string[], initialState: string | null): string | null {
  let state = initialState;
  for (const line of lines) {
    const match = FENCE_RE.exec(line.trimStart());
    if (!match) continue;
    const marker = match[1];
    if (state) {
      if (marker[0] === state[0]) state = null;
    } else {
      state = marker;
    }
  }
  return state;
}

/** Whether a set of lines contains at least one table row (for overlap
 *  seeds — the seed's table already closed in the previous chunk, so only
 *  the flag carries over, never the active state). */
function seedHasTableRows(lines: string[]): boolean {
  return lines.some((line) => TABLE_ROW_RE.test(line));
}

/**
 * Move the content's tail out until the kept prefix fits the token budget.
 * Linear scan from the end (the overshoot is small once the gate adapts;
 * capped for pathological cases). Returns the kept and moved line lists.
 * Never called for table/fence chunks — atomicity wins there.
 */
function trimToBudget(
  lines: string[],
  targetTokens: number,
  tokenizer: Tokenizer,
): { kept: string[]; moved: string[] } {
  let kept = lines.length;
  let steps = 0;
  while (kept > 1 && steps < TRIM_MAX_STEPS) {
    const content = lines.slice(0, kept).join("\n");
    const tokens = tokenizer.count(content);
    if (tokens <= targetTokens) break;
    // drop whole trailing lines (never mid-row)
    kept -= 1;
    steps += 1;
  }
  return { kept: lines.slice(0, kept), moved: lines.slice(kept) };
}

export function chunkMarkdown(
  markdown: string,
  options: ChunkOptions,
  tokenizer?: Tokenizer,
): RagChunk[] {
  const targetTokens = options.targetTokens;
  const overlapTokens =
    options.overlapTokens ?? Math.max(1, Math.round(targetTokens * 0.1));
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  // Adaptive gate: learned chars-per-token, seeded at the chars/4 guess.
  let charsPerToken = CHARS_PER_TOKEN;
  let gateChars = targetTokens * charsPerToken;

  const rawLines = markdown.replace(/\r\n/g, "\n").split("\n");
  if (rawLines.length === 0 || (rawLines.length === 1 && rawLines[0].trim() === "")) return [];

  // Pre-split long, breakable lines so the token budget is honored even
  // when a single line exceeds it. Fence markers, fence body, and table
  // rows are never touched — code and tables stay intact. Word boundaries
  // are preferred; CJK text (no spaces) splits at character boundaries,
  // nudged to punctuation; unbreakable ASCII blobs stay whole.
  const lines: string[] = [];
  {
    let inFence = false;
    const splitLimit = targetTokens * 4;
    for (const raw of rawLines) {
      const fence = FENCE_RE.exec(raw.trimStart());
      if (fence) inFence = !inFence;
      if (!inFence && !TABLE_ROW_RE.test(raw) && raw.length > splitLimit) {
        if (raw.includes(" ")) {
          let rest = raw;
          while (rest.length > splitLimit) {
            const cut = rest.lastIndexOf(" ", splitLimit);
            if (cut <= 0) break; // unbreakable segment — keep whole
            lines.push(rest.slice(0, cut));
            rest = rest.slice(cut + 1);
          }
          lines.push(rest);
        } else if (/[一-鿿㐀-䶿]/.test(raw)) {
          // CJK: no word boundaries — split at characters with a smaller
          // window (~1.2× target tokens, since CJK ≈ 0.74 tokens/char —
          // the 4-char gate would allow 3× over), preferring a punctuation
          // nudge so fragments end at sentence-ish points.
          const cjkLimit = Math.max(64, Math.round(targetTokens * 1.2));
          let rest = raw;
          while (rest.length > cjkLimit) {
            let cut = cjkLimit;
            for (let i = cut; i > cut - 20 && i > 0; i -= 1) {
              if ("，。！？；：、".includes(rest[i])) {
                cut = i + 1;
                break;
              }
            }
            if (cut <= 0) break;
            lines.push(rest.slice(0, cut));
            rest = rest.slice(cut);
          }
          lines.push(rest);
        } else {
          lines.push(raw); // unbreakable ASCII blob
        }
      } else {
        lines.push(raw);
      }
    }
  }

  const chunks: RagChunk[] = [];
  let buffer: string[] = [];
  let bufferChars = 0;
  let inFence: string | null = null;
  let pendingTable = false;
  let inTable = false;
  let chunkHasTable = false;
  let lastHeading = "";
  let pendingOverlap: string[] | null = null;
  let pendingContinuation: string[] | null = null;

  /** Seed the next chunk with the previous chunk's overlap tail + the
   *  trimmed continuation lines (document order preserved). */
  const pushSeed = () => {
    const seed = [...(pendingOverlap ?? []), ...(pendingContinuation ?? [])];
    pendingOverlap = null;
    pendingContinuation = null;
    if (seed.length === 0) return;
    buffer = seed;
    bufferChars = buffer.reduce((sum, line) => sum + line.length + 1, 0);
    inFence = scanFenceState(buffer, null);
    chunkHasTable = seedHasTableRows(buffer);
    for (const line of buffer) if (HEADING_RE.test(line)) lastHeading = line;
  };

  const closeChunk = () => {
    let content = buffer.join("\n").trimEnd();
    if (content !== "") {
      if (inFence) content += `\n${inFence}`; // malformed input: close it
      let moved: string[] = [];
      if (tokenizer && !chunkHasTable && !inFence) {
        // Enforce the exact budget; atomic tables/fences are exempt.
        const trimmed = trimToBudget(content.split("\n"), targetTokens, tokenizer);
        if (trimmed.moved.length > 0) {
          content = trimmed.kept.join("\n").trimEnd();
          moved = trimmed.moved;
        }
      }
      const tokens = tokenizer ? tokenizer.count(content) : estimateTokens(content);
      chunks.push({
        index: chunks.length + 1,
        heading: lastHeading,
        content,
        tokens,
        oversizedTable: chunkHasTable && content.length > gateChars ? true : undefined,
      });
      // Learn the doc's real chars-per-token so the next gate closes near
      // the budget instead of 3× over (CJK/tables).
      if (tokens > 0) {
        const ratio = content.length / tokens;
        charsPerToken = Math.min(8, Math.max(0.6, ratio * 0.5 + charsPerToken * 0.5));
        gateChars = Math.max(1, Math.round(targetTokens * charsPerToken));
      }
      if (overlapChars > 0 && content.length > overlapChars) {
        const windowStart = content.length - overlapChars;
        const nlBefore = content.lastIndexOf("\n", windowStart);
        let tailStart = windowStart;
        if (nlBefore >= 0 && windowStart - nlBefore <= overlapChars) {
          tailStart = nlBefore + 1;
        } else if (nlBefore >= 0) {
          const nlAfter = content.indexOf("\n", windowStart);
          if (nlAfter >= 0) tailStart = nlAfter + 1;
        }
        pendingOverlap = content.slice(tailStart).split("\n");
      }
      pendingContinuation = moved.length > 0 ? moved : null;
    }
    buffer = [];
    bufferChars = 0;
    inFence = null;
    pendingTable = false;
    inTable = false;
    chunkHasTable = false;
  };

  for (const line of lines) {
    const fence = FENCE_RE.exec(line.trimStart());
    // A closing marker must join its fence: compute the pre-toggle state so
    // the boundary check never splits the closer into its own chunk.
    const closesFence = fence !== null && inFence !== null && fence[1][0] === inFence[0];
    if (fence) {
      if (inFence) {
        if (fence[1][0] === inFence[0]) inFence = null;
      } else {
        inFence = fence[1];
      }
    }

    // Table state machine (fence-priority: no detection inside fences).
    if (!inFence) {
      if (inTable) {
        if (!TABLE_ROW_RE.test(line)) inTable = false;
        else chunkHasTable = true;
      } else if (pendingTable) {
        if (TABLE_DELIM_RE.test(line)) {
          inTable = true;
          chunkHasTable = true;
        }
        pendingTable = false;
      } else if (TABLE_ROW_RE.test(line)) {
        pendingTable = true;
      }
    }

    const lineCost = line.length + 1;
    const gateActive = bufferChars >= gateChars;
    // No boundary inside a fence, a table, or an unconfirmed table header
    // (the delimiter must land with its header row).
    if (buffer.length > 0 && !inFence && !inTable && !pendingTable && !closesFence) {
      if (tokenizer && gateActive) {
        // Exact budget check at the gate (and per line while the gate is
        // active — the adaptive ratio keeps this window small).
        const within = tokenizer.withinLimit(buffer.join("\n"), targetTokens);
        if (within === false || within === null) {
          closeChunk();
          pushSeed();
        }
      } else {
        const overflows = bufferChars + lineCost > gateChars;
        const headingNear = HEADING_RE.test(line) && bufferChars >= gateChars * 0.5;
        if (overflows || headingNear) {
          closeChunk();
          pushSeed();
        }
      }
    }
    buffer.push(line);
    bufferChars += lineCost;
    if (HEADING_RE.test(line)) lastHeading = line;
  }
  closeChunk();
  return chunks;
}

/** One .zip per source: numbered chunks + an index file (encoding-honest). */
export async function chunkZip(
  stem: string,
  chunks: RagChunk[],
  sourceName: string,
  encodingLabel = "tokens",
): Promise<Blob> {
  const zip = new JSZip();
  for (const chunk of chunks) {
    zip.file(`${stem}-${String(chunk.index).padStart(3, "0")}.md`, `${chunk.content}\n`);
  }
  const avg = Math.round(chunks.reduce((sum, c) => sum + c.tokens, 0) / Math.max(1, chunks.length));
  const index = [
    `# ${stem} — RAG chunks`,
    "",
    `Source: \`${sourceName}\` · ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} · ~${avg} ${encodingLabel} avg`,
    "",
    ...chunks.map(
      (c) =>
        `- \`${stem}-${String(c.index).padStart(3, "0")}.md\` — ${c.tokens} ${encodingLabel}${c.heading ? ` (${c.heading})` : ""}${c.oversizedTable ? " — oversized table" : ""}`,
    ),
    "",
    "_Chunked by docsmelt in your browser — headings preserved, code fences and tables kept intact._",
  ].join("\n");
  zip.file(`${stem}-index.md`, index);
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
