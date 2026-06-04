import React from "react";
import { Img, staticFile } from "remotion";
import { C, FONT_MONO, FONT_UI } from "./theme";
import { mcapLabel } from "./engine";
import type { ChartData, FrameView } from "./types";

export const Header: React.FC<{ data: ChartData; view: FrameView }> = ({
  data,
  view,
}) => {
  const { token } = data;
  return (
    <div
      style={{
        padding: "26px 30px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* top row: back · avatar · name · peak */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ color: C.text, fontSize: 34, opacity: 0.85 }}>‹</span>
        {token.avatar ? (
          <Img
            src={staticFile(token.avatar)}
            style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#1a1f29",
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span
            style={{
              color: C.text,
              fontFamily: FONT_UI,
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            {token.symbol}
          </span>
          <span style={{ color: C.textMute, fontFamily: FONT_UI, fontSize: 22 }}>
            {token.name} · 5h
          </span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            lineHeight: 1,
          }}
        >
          <span style={{ color: C.textMute, fontFamily: FONT_UI, fontSize: 20 }}>
            Peak
          </span>
          <span
            style={{
              color: C.peak,
              fontFamily: FONT_UI,
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            {Math.round(view.peakMultiple)}x
          </span>
        </div>
      </div>

      {/* mcap value + multiple counter */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <span
          style={{
            color: C.text,
            fontFamily: FONT_MONO,
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          {mcapLabel(view.mcap)}
        </span>
        <span
          style={{
            color: C.green,
            fontFamily: FONT_UI,
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          {view.multiple.toFixed(1)}x ↑
        </span>
      </div>
    </div>
  );
};
