/**
 * Chunk-for-RAG — split converted markdown into fixed-token chunks for
 * LLM pipelines. Pure client-side text processing (zero-server by nature).
 *
 * Rules, in order of importance:
 * 1. Never split a code fence — a chunk boundary inside a fence is pushed
 *    past the closing marker (a giant fence becomes one oversized chunk,
 *    which is the correct trade).
 * 2. Prefer heading boundaries — when a heading arrives while the chunk is
 *    ≥50% full, the chunk closes BEFORE the heading (sections stay intact
 *    when the boundary is near).
 * 3. ~10% overlap at line granularity, re-seeded into the next chunk so
 *    RAG retrievers that cut context windows still see the tail.
 * 4. Fence integrity is guaranteed by a final state-machine pass: a chunk
 *    that ends inside a fence (malformed input) gets a closing marker.
 */
import JSZip from "jszip";

/** Standard heuristic: ≈4 characters per token (GPT-family, English). */
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
  tokens: number;
}

const FENCE_RE = /^(`{3,}|~{3,})/;
const HEADING_RE = /^#{1,6} /;

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

export function chunkMarkdown(markdown: string, options: ChunkOptions): RagChunk[] {
  const targetChars = options.targetTokens * CHARS_PER_TOKEN;
  const overlapChars =
    (options.overlapTokens ?? Math.max(1, Math.round(options.targetTokens * 0.1))) *
    CHARS_PER_TOKEN;

  const rawLines = markdown.replace(/\r\n/g, "\n").split("\n");
  if (rawLines.length === 0 || (rawLines.length === 1 && rawLines[0].trim() === "")) return [];

  // Pre-split long, breakable lines (paragraphs) at word boundaries so the
  // token budget is honored even when a single line exceeds it. Fence
  // markers and fence body are never touched — code stays intact.
  const lines: string[] = [];
  {
    let inFence = false;
    for (const raw of rawLines) {
      const fence = FENCE_RE.exec(raw.trimStart());
      if (fence) inFence = !inFence;
      if (!inFence && raw.length > targetChars && raw.includes(" ")) {
        let rest = raw;
        while (rest.length > targetChars) {
          const cut = rest.lastIndexOf(" ", targetChars);
          if (cut <= 0) break; // unbreakable segment — keep whole
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut + 1);
        }
        lines.push(rest);
      } else {
        lines.push(raw);
      }
    }
  }

  const chunks: RagChunk[] = [];
  let buffer: string[] = [];
  let bufferChars = 0;
  let inFence: string | null = null;
  let lastHeading = "";
  let pendingOverlap: string[] | null = null;

  /** Seed the next chunk with the previous chunk's tail (overlap). */
  const pushSeed = () => {
    if (!pendingOverlap) return;
    buffer = pendingOverlap;
    bufferChars = buffer.reduce((sum, line) => sum + line.length + 1, 0);
    inFence = scanFenceState(buffer, null);
    pendingOverlap = null;
    for (const line of buffer) if (HEADING_RE.test(line)) lastHeading = line;
  };

  const closeChunk = () => {
    let content = buffer.join("\n").trimEnd();
    if (content !== "") {
      if (inFence) content += `\n${inFence}`; // malformed input: close it
      chunks.push({
        index: chunks.length + 1,
        heading: lastHeading,
        content,
        tokens: estimateTokens(content),
      });
      if (overlapChars > 0 && content.length > overlapChars) {
        // Tail anchored at a line boundary — but only extend left when the
        // extension is cheap (≤ the window itself). A huge last line must
        // not bloat the seed to the whole line; a partial-line seed is fine
        // (it still overlaps the previous chunk's content).
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
    }
    buffer = [];
    bufferChars = 0;
    inFence = null;
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
    const lineCost = line.length + 1;
    if (buffer.length > 0 && !inFence && !closesFence) {
      const overflows = bufferChars + lineCost > targetChars;
      const headingNear = HEADING_RE.test(line) && bufferChars >= targetChars * 0.5;
      if (overflows || headingNear) {
        closeChunk();
        pushSeed();
      }
    }
    buffer.push(line);
    bufferChars += lineCost;
    if (HEADING_RE.test(line)) lastHeading = line;
  }
  closeChunk();
  return chunks;
}

/** One .zip per source: numbered chunks + an index file. */
export async function chunkZip(
  stem: string,
  chunks: RagChunk[],
  sourceName: string,
): Promise<Blob> {
  const zip = new JSZip();
  for (const chunk of chunks) {
    zip.file(`${stem}-${String(chunk.index).padStart(3, "0")}.md`, `${chunk.content}\n`);
  }
  const avg = Math.round(chunks.reduce((sum, c) => sum + c.tokens, 0) / Math.max(1, chunks.length));
  const index = [
    `# ${stem} — RAG chunks`,
    "",
    `Source: \`${sourceName}\` · ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} · ~${avg} tokens avg`,
    "",
    ...chunks.map(
      (c) =>
        `- \`${stem}-${String(c.index).padStart(3, "0")}.md\` — ${c.tokens} tokens${c.heading ? ` (${c.heading})` : ""}`,
    ),
    "",
    "_Chunked by docsmelt in your browser — headings preserved, code fences kept intact._",
  ].join("\n");
  zip.file(`${stem}-index.md`, index);
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
