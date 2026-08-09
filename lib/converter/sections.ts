/**
 * Section model for the navigated preview ("The Cargo Manifest").
 * The document is split at ATX headings into bounded blocks; each section
 * carries a duplicate-safe anchor id, its heading, and its source lines
 * (for per-section copy and isolated rendering). Fence-priority: heading
 * markers inside code fences are code, never sections.
 */

export interface DocSection {
  /** Anchor id — slugified heading, deduped with -2/-3 suffixes. */
  id: string;
  /** 1-6; 0 for the preamble (content before the first heading). */
  level: number;
  /** The heading line ("## Budget") or "" for the preamble. */
  heading: string;
  /** The heading text ("Budget") or "" for the preamble. */
  text: string;
  /** Source lines INCLUDING the heading line. */
  lines: string[];
  /** 1-based section number. */
  index: number;
}

export interface DocOutline {
  sections: DocSection[];
  /** Source lines before the first heading. */
  preambleLines: string[];
}

const HEADING_RE = /^(#{1,6}) +(.*)$/;
const FENCE_RE = /^(`{3,}|~{3,})/;

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "section";
}

export function parseSections(markdown: string): DocOutline {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: DocSection[] = [];
  const preambleLines: string[] = [];
  const usedIds = new Set<string>();

  const uniqueId = (text: string): string => {
    const base = slugify(text);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    return id;
  };

  let current: DocSection | null = null;
  let inFence: string | null = null;

  const flush = () => {
    if (current) sections.push(current);
    current = null;
  };

  for (const line of lines) {
    const fence = FENCE_RE.exec(line.trimStart());
    if (fence) {
      if (inFence) {
        if (fence[1][0] === inFence[0]) inFence = null;
      } else {
        inFence = fence[1];
      }
    }
    const heading = !inFence ? HEADING_RE.exec(line) : null;
    if (heading) {
      flush();
      const text = heading[2].trim();
      current = {
        id: uniqueId(text),
        level: heading[1].length,
        heading: line,
        text,
        lines: [line],
        index: sections.length + 1,
      };
    } else if (current) {
      current.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  }
  flush();
  return { sections, preambleLines };
}

/** The section a chunk belongs to (by its headingPath tail) — lets the
 *  outline highlight the section containing the active chunk. */
export function sectionForHeading(
  outline: DocOutline,
  headingPath: string[],
): DocSection | null {
  if (headingPath.length === 0) return null;
  const tail = headingPath[headingPath.length - 1];
  const match = tail.match(/^#{1,6} +(.*)$/);
  const text = match ? match[1].trim() : tail;
  // last matching section wins (a heading may repeat)
  let found: DocSection | null = null;
  for (const section of outline.sections) {
    if (section.text === text) found = section;
  }
  return found;
}
