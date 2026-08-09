"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export const QUEUE_W_DEFAULT = 340;
export const QUEUE_W_MIN = 280;
export const QUEUE_W_MAX = 520;
export const INGOT_H_DEFAULT = 600;
export const INGOT_H_MIN = 480;
/** 85% of viewport height — keeps the pane reachable on short screens. */
export const INGOT_H_MAX = () => Math.max(INGOT_H_MIN, Math.round(window.innerHeight * 0.85));

/**
 * Single corner grip on the preview pane. Horizontal drag → queue column
 * width; vertical drag → ingot pane height. lg-only (mobile is single-column
 * and never renders this). Pointer capture keeps the drag alive off-handle;
 * arrow keys adjust both axes by 16 px so the resize is never keyboard-locked.
 */
export function PreviewResizeHandle({
  gridRef,
  queueW,
  setQueueW,
  ingotH,
  setIngotH,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  queueW: number;
  setQueueW: (w: number) => void;
  ingotH: number;
  setIngotH: (h: number) => void;
}) {
  // Start values captured at pointerdown; deltas are from there.
  const drag = useRef<{ sx: number; sy: number; qw: number; ih: number; maxW: number } | null>(null);

  /** Width clamp: [280, min(520, gridW − 320)] so the preview never drops below ~320px. */
  const clampW = (w: number, maxW: number) =>
    Math.round(Math.min(Math.max(w, QUEUE_W_MIN), Math.min(QUEUE_W_MAX, maxW)));
  const clampH = (h: number) => Math.round(Math.min(Math.max(h, INGOT_H_MIN), INGOT_H_MAX()));

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const gridW = gridRef.current?.clientWidth ?? 0;
    const maxW = Math.max(QUEUE_W_MIN, Math.min(QUEUE_W_MAX, gridW - 320));
    drag.current = { sx: e.clientX, sy: e.clientY, qw: queueW, ih: ingotH, maxW };
    document.body.classList.add("dm-resizing");
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    setQueueW(clampW(d.qw + (e.clientX - d.sx), d.maxW));
    setIngotH(clampH(d.ih + (e.clientY - d.sy)));
  };
  const endDrag = () => {
    drag.current = null;
    document.body.classList.remove("dm-resizing");
  };

  const STEP = 16;
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const gridW = gridRef.current?.clientWidth ?? 0;
    const maxW = Math.max(QUEUE_W_MIN, Math.min(QUEUE_W_MAX, gridW - 320));
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setQueueW(clampW(queueW - STEP, maxW));
        break;
      case "ArrowRight":
        e.preventDefault();
        setQueueW(clampW(queueW + STEP, maxW));
        break;
      case "ArrowUp":
        e.preventDefault();
        setIngotH(clampH(ingotH - STEP));
        break;
      case "ArrowDown":
        e.preventDefault();
        setIngotH(clampH(ingotH + STEP));
        break;
    }
  };

  return (
    <button
      type="button"
      role="separator"
      aria-label="Resize workspace — drag horizontally for queue width, vertically for preview height; arrow keys adjust by 16 pixels"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={cn(
        "absolute -bottom-1.5 -right-1.5 z-20 hidden size-6 items-center justify-center lg:flex",
        "cursor-nwse-resize touch-none select-none rounded text-muted-foreground/60 transition-colors duration-150 hover:text-muted-foreground",
        "after:absolute after:-inset-2 after:content-['']",
      )}
    >
      {/* diagonal grip, currentColor — 40px effective hit area via the after: inset */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M11 9V11H9M10 10L5 5M11 5V11H5M3 11V7H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
