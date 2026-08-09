/**
 * Tiny screen-reader announcement bus. Actions (copy, export, etc.) fire a
 * CustomEvent; the app shell listens and feeds the existing aria-live
 * region — so sighted AND screen-reader users get copy/export feedback
 * (B-6 from the audit).
 */

export const ANNOUNCE_EVENT = "docsmelt:announce";

export function announce(message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail: message }));
}
