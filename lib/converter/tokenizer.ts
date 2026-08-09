/**
 * Tokenizer facade — gpt-tokenizer (pure JS BPE, tiktoken-validated,
 * ships its vocab in the bundle: zero fetch at runtime, zero-server
 * intact). Lazy-loaded on first use inside the chunk panel; the ~1 MB
 * gzipped vocab never touches first paint.
 *
 * If the dynamic import ever fails (code bug / exotic bundler), the
 * fallback degrades to the chars/4 estimate and labels itself honestly —
 * chunking still works, counts are approximate.
 */
import { CHARS_PER_TOKEN } from "./chunk";

export interface Tokenizer {
  /** Exact token count for the encoding. */
  count(text: string): number;
  /** Exact budget check: true ≤ limit, false > limit, null undecidable.
   *  (gpt-tokenizer's isWithinTokenLimit returns the token count when
   *  within the limit — normalized to true here.) */
  withinLimit(text: string, limit: number): boolean | null;
  /** Encoding name for honest UI/index labels. */
  encoding: string;
}

export const FALLBACK_ENCODING = "chars/4 estimate";

export function createFallbackTokenizer(): Tokenizer {
  return {
    count: (text) => Math.ceil(text.length / CHARS_PER_TOKEN),
    withinLimit: (text, limit) => Math.ceil(text.length / CHARS_PER_TOKEN) <= limit,
    encoding: FALLBACK_ENCODING,
  };
}

let cached: Promise<Tokenizer> | null = null;

export function loadTokenizer(): Promise<Tokenizer> {
  cached ??= import("gpt-tokenizer")
    .then(
      (gpt): Tokenizer => ({
        // gpt-tokenizer's default encoding is cl100k_base (GPT-4-class).
        // allowedSpecial: real documents can literally contain the reserved
        // tokens (<|im_start|>, <|im_end|>, <|noise|> … — e.g. books about
        // LLM prompts) and the default THROWS on them ('Disallowed special
        // token found'), which surfaced as a bogus 'tokenizer failed' on a
        // 10 MB AI-agents PDF. Counting them as their token IDs is the
        // correct behavior.
        count: (text) => gpt.countTokens(text, { allowedSpecial: gpt.ALL_SPECIAL_TOKENS }),
        withinLimit: (text, limit) => {
          const result = gpt.isWithinTokenLimit(text, limit, {
            allowedSpecial: gpt.ALL_SPECIAL_TOKENS,
          });
          if (typeof result === "number") return result <= limit;
          return result;
        },
        encoding: "cl100k_base",
      }),
    )
    .catch(() => createFallbackTokenizer());
  return cached;
}
