import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const COMPS = [
  {
    name: "Kalshi",
    valuation: "$22B",
    detail: "Series, March 2026 ($1B raised)",
    note: "Doubled from $11B in three months.",
  },
  {
    name: "Polymarket",
    valuation: "$9B",
    detail: "Series D, October 2025",
    note: "Seeking $12–15B in Q4 2025.",
  },
  {
    name: "Hyperliquid",
    valuation: "$38B",
    detail: "FDV, May 2026",
    note: "Adjacent — perps DEX with prediction surface.",
  },
];

export const SlideExitComps: React.FC = () => {
  return (
    <SlideFrame eyebrow="Comps" pageNumber={6} pageTotal={SLIDE_COUNT}>
      <p
        style={{
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 56,
          maxWidth: 1500,
        }}
      >
        $69B in private comparables. The category cleared the runway.
      </p>

      <div style={{ maxWidth: 1500 }}>
        {COMPS.map((c, i) => (
          <div
            key={c.name}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 280px 2fr",
              alignItems: "baseline",
              padding: "28px 0",
              borderTop: i === 0 ? `1px solid ${COLOR.line}` : undefined,
              borderBottom: `1px solid ${COLOR.line}`,
              fontFamily: FONT.sans,
              gap: 32,
            }}
          >
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: 36,
                fontWeight: 500,
                color: COLOR.ink,
                letterSpacing: "-0.01em",
              }}
            >
              {c.name}
            </div>
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: 56,
                fontWeight: 300,
                color: COLOR.ink,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
                textAlign: "right",
              }}
            >
              {c.valuation}
            </div>
            <div>
              <div style={{ fontSize: 18, color: COLOR.muted, marginBottom: 4 }}>
                {c.detail}
              </div>
              <div style={{ fontSize: 20, color: COLOR.ink }}>{c.note}</div>
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          position: "absolute",
          bottom: 64,
          left: 192,
          fontFamily: FONT.sans,
          fontSize: 14,
          color: COLOR.muted,
          margin: 0,
        }}
      >
        Bloomberg, October 2025 + March 2026 · CoinMarketCap, accessed May 2026.
      </p>
    </SlideFrame>
  );
};
