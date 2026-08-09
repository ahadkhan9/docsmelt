"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { RagChunk } from "@/lib/converter/chunk";
import { CHUNK_MOUNT_BATCH, CHUNK_MOUNT_ROOT_MARGIN } from "@/lib/converter/preview";

/**
 * Progressive chunk mounting. Huge docs mount the first CHUNK_MOUNT_BATCH,
 * then append +batch when the pane nears the sentinel (IntersectionObserver,
 * pane as root). `reveal(N)` mounts up to chunk N and scrolls after commit
 * (rail/drawer jumps). `loadMore` is the keyboard/SR path (a real button).
 * All chunks stay in the DOM until the limit — content-visibility skips
 * their layout. Non-progressive (small) docs render everything immediately.
 */
export function useChunkPager(
  chunks: RagChunk[] | null | undefined,
  progressive: boolean,
  paneRef: RefObject<HTMLDivElement | null>,
) {
  const total = chunks?.length ?? 0;
  const [limit, setLimit] = useState(() =>
    progressive && total > 0 ? Math.min(CHUNK_MOUNT_BATCH, total) : total,
  );
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Keep the limit in bounds when chunks arrive async (computeChunks done)
  // or get replaced (re-chunk) — never shrink below what the user reached.
  useEffect(() => {
    setLimit((l) =>
      progressive && total > 0 ? Math.min(Math.max(l, CHUNK_MOUNT_BATCH), total) : total,
    );
  }, [total, progressive]);

  // Sentinel IO — mount the next batch ~600px before the last mounted chunk.
  useEffect(() => {
    if (!progressive || limit >= total || !sentinelRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setLimit((l) => Math.min(l + CHUNK_MOUNT_BATCH, total));
      },
      { root: paneRef.current, rootMargin: CHUNK_MOUNT_ROOT_MARGIN },
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [progressive, limit, total, paneRef]);

  const reveal = useCallback((target: number) => {
    setLimit((l) => Math.max(l, target));
    setPendingTarget(target);
  }, []);

  const loadMore = useCallback(() => {
    setLimit((l) => Math.min(l + CHUNK_MOUNT_BATCH, total));
  }, [total]);

  // Scroll to a revealed chunk only once it is actually mounted.
  useLayoutEffect(() => {
    if (pendingTarget === null) return;
    const target = pendingTarget;
    setPendingTarget(null);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    paneRef.current?.querySelector(`[data-chunk="${target}"]`)?.scrollIntoView({
      block: "start",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [limit, pendingTarget, paneRef]);

  return {
    limit,
    sentinelRef,
    reveal,
    loadMore,
    loadedLabel: total > 0 ? `${Math.min(limit, total)} of ${total}` : "",
  };
}
