/**
 * Error taxonomy → user-facing copy. The `code` from the worker is the
 * contract (pinned by the engine's own tests). No raw error strings reach
 * the user — these titles/hints are the voice of the app.
 */
import type { AnyFormat, ConvertErrorCode } from "./protocol";

export type ErrorKind = ConvertErrorCode | "engine" | "fileTooLarge";

export const ERROR_UX: Record<ErrorKind, { title: string; hint: string }> = {
  unsupported: {
    title: "We can’t smelt this file",
    hint: "The format is unrecognized or unsupported. CSV needs a .csv name; text-based PDFs work, scanned ones need OCR.",
  },
  malformed: {
    title: "File is corrupt or unreadable",
    hint: "No meaningful content could be extracted. Try re-saving it from the source app.",
  },
  encrypted: {
    title: "Password-protected file",
    hint: "Remove the password or encryption in the source app, then convert again. Decryption keys can never leave your browser.",
  },
  resourceLimit: {
    title: "File exceeds safety limits",
    hint: "Too large, too many parts, or too deeply nested for in-browser conversion. Try a smaller file.",
  },
  missingPart: {
    title: "File is incomplete",
    hint: "A required internal part is missing — the file may be truncated or corrupt.",
  },
  engine: {
    title: "Converter crashed",
    hint: "The in-browser engine hit a hard error. Retry — the worker restarts automatically.",
  },
  fileTooLarge: {
    title: "File too large for in-browser conversion",
    hint: "The cap is 100 MB on desktop and 40 MB on mobile, because your browser’s memory is the limit. Try a smaller file.",
  },
};

/** Refinements the code alone doesn't cover. */
export function refine(
  fileName: string,
  format: AnyFormat | undefined,
  code: ErrorKind,
): { title: string; hint: string } {
  if (code === "unsupported" && format === "pdf") {
    return {
      title: "Scanned PDF — no text layer",
      hint: "The pages are images with no extractable text. Firecrawl's Parse API can OCR them; a text-based PDF converts right here.",
    };
  }
  if (code === "unsupported" && /\.csv$/i.test(fileName)) {
    return {
      title: "CSV needs its format named",
      hint: "CSV has no file signature. Make sure the file ends in .csv and retry.",
    };
  }
  return ERROR_UX[code];
}
