import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/** Three-role typography — design direction §4.
 *  (Big Shoulders Display lives on Google Fonts as the variable family
 *  "Big Shoulders" — next/font only knows the merged name.) */
const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://docsmelt.vercel.app"),
  title: "docsmelt — smelt documents into markdown",
  description:
    "Convert PDF, DOCX, XLSX, PPTX, RTF, EPUB, ODS and CSV into clean Markdown, entirely in your browser. Files never leave your device.",
};

export const viewport: Viewport = {
  themeColor: "#101418",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col touch-manipulation">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-foreground focus:shadow-lg focus:outline-2 focus:outline-molten"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
