/**
 * Tokenizer facade — exact counts (hardcoded, verified against the lib
 * and the dev.to-verified tiktoken values), the short-circuit budget
 * check, and the honest fallback.
 */
import { describe, expect, it } from "vitest";
import { createFallbackTokenizer, FALLBACK_ENCODING, loadTokenizer } from "./tokenizer";

const CJK = "文档转换是将办公文件转化为干净、结构化的标记语言的过程。";

describe("loadTokenizer (gpt-tokenizer, cl100k_base)", () => {
  it("counts exactly — known verified values", async () => {
    const tok = await loadTokenizer();
    expect(tok.encoding).toBe("cl100k_base");
    expect(tok.count("Hello, world!")).toBe(4);
    expect(tok.count("The quick brown fox jumps over the lazy dog.")).toBe(10);
    expect(tok.count(CJK)).toBe(22); // hardcoded, verified against the lib
    expect(tok.count("| Iron | 1538 |")).toBe(7);
  });

  it("short-circuits budget checks", async () => {
    const tok = await loadTokenizer();
    expect(tok.withinLimit("Hello, world!", 512)).toBe(true);
    // huge text → false (over) or null (undecidable) — never true
    expect(tok.withinLimit(CJK.repeat(2000), 512)).not.toBe(true);
  });
});

describe("createFallbackTokenizer (honest degrade)", () => {
  it("uses the chars/4 estimate and labels itself", () => {
    const fallback = createFallbackTokenizer();
    expect(fallback.encoding).toBe(FALLBACK_ENCODING);
    expect(fallback.count("hello world")).toBe(Math.ceil(11 / 4));
    expect(fallback.withinLimit("hello world", 512)).toBe(true);
    expect(fallback.withinLimit("x".repeat(3000), 512)).toBe(false);
  });
});

describe("special tokens in real documents (the 10MB PDF bug)", () => {
  it("counts text containing reserved special tokens instead of throwing", async () => {
    const tok = await loadTokenizer();
    // Books about LLM prompts literally contain these (reproduced from a
    // real 10 MB PDF): the default would throw 'Disallowed special token'.
    const md = "System: <|im_start|> assistant <|im_end|> <|noise|> tokens.";
    expect(tok.count(md)).toBeGreaterThan(0);
    expect(tok.withinLimit(md, 512)).toBe(true);
  });
});
