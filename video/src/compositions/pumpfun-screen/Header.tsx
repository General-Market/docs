import React from "react";
import { Img, staticFile } from "remotion";
import { C, FONT_MONO, FONT_UI } from "./theme";
import { mcapFull } from "./engine";
import type { ChartData, FrameView } from "./types";

const CopyIcon: React.FC = () => (
  <svg
    width={26}
    height={26}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: C.textFaint, flexShrink: 0 }}
  >
    <rect x={9} y={9} width={11} height={11} rx={2.5} />
    <path d="M5 15a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h7a2 2 0 0 1 2 2" />
  </svg>
);

export const Header: React.FC<{ data: ChartData; view: FrameView }> = ({
  data,
  view,
}) => {
  const { token } = data;
  return (
    <div
      style={{
        padding: "26px 30px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{ color: C.textMute, fontSize: 34, lineHeight: 1, flexShrink: 0 }}
        >
          ‹
        </span>

        {token.avatar ? (
          <Img
            src={staticFile(token.avatar)}
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#1a1f29",
              flexShrink: 0,
            }}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: C.text,
              fontFamily: FONT_UI,
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {token.name}
            <span style={{ color: C.textMute, fontSize: 22, fontWeight: 400 }}>
              1h
            </span>
            <span style={{ color: C.textMute, fontSize: 22 }}>⚑</span>
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: C.text,
              fontFamily: FONT_UI,
              fontSize: 54,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1,
            }}
          >
            {token.symbol}
            <CopyIcon />
          </span>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: C.textMute,
              fontFamily: FONT_UI,
              fontSize: 26,
              lineHeight: 1,
            }}
          >
            Peak
            <span style={{ fontSize: 22 }}>⇅</span>
          </span>
          <span
            style={{
              color: C.peak,
              fontFamily: FONT_UI,
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {view.peakMultiple.toFixed(1)}x
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span
          style={{
            color: C.text,
            fontFamily: FONT_MONO,
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: -1,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {mcapFull(view.mcap)}
        </span>
        <span
          style={{
            color: C.green,
            fontFamily: FONT_UI,
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {view.multiple.toFixed(1)}x ↑
        </span>
      </div>
    </div>
  );
};
