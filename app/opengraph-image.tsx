import { ImageResponse } from "next/og";

export const alt = "docsmelt — smelt documents into markdown";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Required with output: 'export' — the OG route must render at build time.
export const dynamic = "force-static";

const FAMILIES = ["#7FA8F0", "#F08A7C", "#86CC8E", "#B7A0F0", "#6CC8CE"];

/** The Foundry social card — built at export time from the same tokens. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#101418",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="52" height="52" viewBox="0 0 64 64">
            <rect x="14" y="24" width="36" height="30" rx="7" fill="#F7F7F5" />
            <rect x="14" y="24" width="36" height="10" rx="5" fill="#FF9E3D" />
            <path d="M20 45 h24" stroke="#1F2328" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
          </svg>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700, color: "#E8ECF1", letterSpacing: 6 }}>
            DOC<span style={{ color: "#FF9E3D" }}>SMELT</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#E8ECF1", maxWidth: 880, lineHeight: 1.1 }}>
          Smelt documents into markdown.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {FAMILIES.map((color) => (
            <div key={color} style={{ width: 22, height: 22, borderRadius: 6, background: color }} />
          ))}
          <div style={{ display: "flex", color: "#9AA7B5", fontSize: 30, marginLeft: 10 }}>
            21 office formats — converted in your browser. Files never leave.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
