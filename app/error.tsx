"use client";

/**
 * App-level error boundary (Next.js app router). A render throw anywhere in
 * the workspace — react-markdown hitting an unusual construct in a huge
 * document, a section/chunk render edge, an oversized table branch — would
 * otherwise unmount the whole UI to a blank page. This catches it and offers
 * a recovery button. Nothing left the browser either way.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        The renderer hit an unexpected construct. Nothing left your browser.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
