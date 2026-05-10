import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT, PAD } from "../tokens";

const Stat: React.FC<{
  value: string;
  label: string;
}> = ({ value, label }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
    <div
      style={{
        fontFamily: FONT.display,
        fontSize: 132,
        fontWeight: 600,
        color: COLOR.ink,
        lineHeight: 0.95,
        letterSpacing: "-0.035em",
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontFamily: FONT.display,
        fontSize: 22,
        fontWeight: 400,
        color: COLOR.muted,
        letterSpacing: "-0.018em",
        lineHeight: 1.3,
        whiteSpace: "pre-line",
      }}
    >
      {label}
    </div>
  </div>
);

export const Slide05Market: React.FC = () => {
  return (
    <SlideFrame eyebrow="Market" pageNumber={5} pageTotal={SLIDE_COUNT}>
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 88,
          fontWeight: 600,
          color: COLOR.ink,
          lineHeight: 1.02,
          letterSpacing: "-0.028em",
          margin: 0,
          marginBottom: 80,
        }}
      >
        Where users are the exit liquidity.
      </h1>

      <div style={{ display: "flex", gap: 64, width: "100%" }}>
        <Stat value="$11B" label={"Prediction market\nvolume, 2024"} />
        <Stat value="$120B" label={"US sports betting\nhandle, 2024"} />
        <Stat value="$1.6T" label={"Crypto perp DEX\nvolume, 2024"} />
      </div>

      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 28,
          fontWeight: 400,
          color: COLOR.ink,
          letterSpacing: "-0.02em",
          marginTop: 64,
          paddingTop: 32,
          borderTop: `1px solid ${COLOR.line}`,
        }}
      >
        <span style={{ color: COLOR.blue, fontWeight: 600 }}>0.1%</span> of any
        of these is a real business.
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: PAD.x,
          right: PAD.x,
          fontFamily: FONT.text,
          fontSize: 13,
          color: COLOR.muted,
          letterSpacing: "-0.01em",
          opacity: 0.7,
        }}
      >
        Sources · Polymarket + Kalshi public volume, 2024 · American Gaming
        Association, Commercial Gaming Revenue Tracker (Q4 2024) · DefiLlama,
        annualized perpetual DEX volume.
      </div>
    </SlideFrame>
  );
};
