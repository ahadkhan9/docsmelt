/**
 * Keyboard-first workflow — pure key-event → action mapping (unit-tested).
 *
 * Rules:
 *  - modifier combos (⌘O / ⌘⇧V / ⌘D) are global; plain keys (Esc, 1–9)
 *    yield to text-editing contexts so typing is never hijacked.
 *  - ⌘⇧V paste also yields to editing contexts (native paste wins there).
 */

export type ShortcutAction =
  | { type: "open-picker" }
  | { type: "paste" }
  | { type: "download-active" }
  | { type: "escape" }
  | { type: "select-row"; index: number };

export interface ShortcutContext {
  /** Focus is in an input/textarea/select/contenteditable. */
  inEditable: boolean;
  /** Queue row ids in order — 1–9 map to them. */
  rowIds: string[];
}

export function handleShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey">,
  ctx: ShortcutContext,
): ShortcutAction | null {
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (mod && key === "o") return { type: "open-picker" };
  if (mod && event.shiftKey && key === "v" && !ctx.inEditable) return { type: "paste" };
  if (mod && key === "d") return { type: "download-active" };
  if (!mod && !ctx.inEditable) {
    if (key === "escape") return { type: "escape" };
    if (/^[1-9]$/.test(key)) {
      const index = Number(key) - 1;
      if (index < ctx.rowIds.length) return { type: "select-row", index };
    }
  }
  return null;
}
