/**
 * Format identity system — per the design direction (§7).
 * Color encodes family, glyph encodes format. All 20 supported formats
 * map to one of five families; each family has a muted token color.
 */
import type { AnyFormat } from "./protocol";

export type FormatFamily = "word" | "pdf" | "sheet" | "slide" | "book";

export const FAMILY_OF: Record<AnyFormat, FormatFamily> = {
  doc: "word", docx: "word", docm: "word", odt: "word", rtf: "word",
  pdf: "pdf",
  xls: "sheet", xlsx: "sheet", xlsm: "sheet", xlsb: "sheet", ods: "sheet", csv: "sheet",
  ppt: "slide", pps: "slide", pot: "slide", pptx: "slide", pptm: "slide",
  ppsx: "slide", ppsm: "slide", odp: "slide",
  epub: "book",
};

export const EXT_TO_FORMAT: Record<string, AnyFormat> = {
  doc: "doc", docx: "docx", docm: "docm", odt: "odt", rtf: "rtf",
  pdf: "pdf",
  xls: "xls", xlsx: "xlsx", xlsm: "xlsm", xlsb: "xlsb", ods: "ods", csv: "csv",
  ppt: "ppt", pps: "pps", pot: "pot", pptx: "pptx", pptm: "pptm",
  ppsx: "ppsx", ppsm: "ppsm", odp: "odp",
  epub: "epub",
};

/** Extension of a file name → format (mirrors the engine's formatFromPath). */
export function formatFromFileName(name: string): AnyFormat | undefined {
  return EXT_TO_FORMAT[name.slice(name.lastIndexOf(".") + 1).toLowerCase()];
}

/** Only document-model formats can carry embedded assets (PDF has none). */
export function supportsZip(format: AnyFormat | undefined): boolean {
  return format !== undefined && format !== "pdf";
}

export const FAMILY_LABEL: Record<FormatFamily, string> = {
  word: "Word documents",
  pdf: "PDF",
  sheet: "Spreadsheets",
  slide: "Presentations",
  book: "Books",
};

export const FAMILY_FORMATS: Record<FormatFamily, string> = {
  word: "doc · docx · docm · odt · rtf",
  pdf: "pdf",
  sheet: "xls · xlsx · xlsm · xlsb · ods · csv",
  slide: "ppt · pps · pot · pptx · pptm · ppsx · ppsm · odp",
  book: "epub",
};

/** Token name for the family color (defined in globals.css @theme). */
export const FAMILY_TOKEN: Record<FormatFamily, string> = {
  word: "fam-word",
  pdf: "fam-pdf",
  sheet: "fam-sheet",
  slide: "fam-slide",
  book: "fam-book",
};

/** Hand-drawn 20×20 glyphs — one per family, stroke = currentColor. */
export function FamilyGlyph({ family, className }: { family: FormatFamily; className?: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (family) {
    case "word":
      return (
        <svg {...common}>
          <path d="M6 3h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" />
        </svg>
      );
    case "pdf":
      return (
        <svg {...common}>
          <path d="M6 3h7l3 3v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M13 3v3h3M8 11.5h4M8 13.5h4M8 9.5h1.5" />
        </svg>
      );
    case "sheet":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="13" height="13" rx="1" />
          <path d="M3.5 8h13M3.5 12h13M8 3.5v13M12 3.5v13" />
        </svg>
      );
    case "slide":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="14" height="9" rx="1" />
          <path d="M7 16.5h6" />
          <path d="M10 13v3.5" />
          <path d="M8.2 7.2 12 9.5l-3.8 2.3Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M10 5.5C8.8 4.3 6.8 4 4 4v11c2.8 0 4.8.3 6 1.5 1.2-1.2 3.2-1.5 6-1.5V4c-2.8 0-4.8.3-6 1.5Z" />
          <path d="M10 5.5V16.5" />
        </svg>
      );
  }
}
