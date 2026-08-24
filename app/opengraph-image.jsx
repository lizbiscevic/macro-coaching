import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#faf7fa",
        }}
      >
        <div style={{ fontSize: 30, color: "#3ad1c2", letterSpacing: 4, textTransform: "uppercase", marginBottom: 24, display: "flex" }}>
          No BS · No guesswork
        </div>
        <div style={{ fontSize: 96, fontWeight: 600, color: "#241e28", lineHeight: 1.05, display: "flex" }}>
          Macro Coaching
        </div>
        <div style={{ fontSize: 96, fontWeight: 600, color: "#6e3862", lineHeight: 1.05, display: "flex" }}>
          With Liz
        </div>
        <div style={{ fontSize: 32, color: "#6e6875", marginTop: 32, display: "flex" }}>
          Real timelines and results that stick.
        </div>
      </div>
    ),
    { ...size }
  );
}
