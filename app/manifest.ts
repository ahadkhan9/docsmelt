import type { MetadataRoute } from "next";

// Required with output: 'export' — the manifest must render at build time.
export const dynamic = "force-static";

/** PWA manifest — emitted as manifest.webmanifest by the static export. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "docsmelt — smelt documents into markdown",
    short_name: "docsmelt",
    description:
      "Convert office documents to Markdown in your browser. Files never leave your device.",
    start_url: "/",
    display: "standalone",
    background_color: "#101418",
    theme_color: "#101418",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
