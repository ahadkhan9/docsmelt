import type { Metadata } from "next";
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
  title: "docsmelt — smelt documents into markdown",
  description:
    "Convert PDF, DOCX, XLSX, PPTX, RTF, EPUB, ODS and CSV into clean Markdown, entirely in your browser. Files never leave your device.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
