"use client";

import dynamic from "next/dynamic";

/**
 * The converter app is heavy (react-markdown, worker glue, pool) — it is
 * deferred client-side so the initial static HTML stays small and the
 * worker/wasm chunks load only after hydration. `ssr: false` must live in
 * a client component (throws inside Server Components).
 */
const App = dynamic(() => import("./converter-app"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        stoking the furnace…
      </p>
    </div>
  ),
});

export default function ConverterAppLazy() {
  return <App />;
}
