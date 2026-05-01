import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const ROWS = [
  { label: "Take rate", value: "0.1% on volume" },
  { label: "Bot share of category", value: "55%+ on fast markets" },
  { label: "Median position life", value: "under 24 hours" },
  { label: "GM design target", value: "bot-first, batch-cleared" },
];

export const Slide09Business: React.FC = () => {
  return (
    <SlideFrame eyebrow="Business Model" pageNumber={11} pageTotal={SLIDE_COUNT}>
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
        Bot-first by design. The category already runs on bots — GM just stops pretending it doesn&apos;t.
      </p>
      <div style={{ maxWidth: 1200 }}>
        {ROWS.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: "grid",
              gridTemplateColumns: "320px 1fr",
              padding: "20px 0",
              borderTop: i === 0 ? `1px solid ${COLOR.line}` : undefined,
              borderBottom: `1px solid ${COLOR.line}`,
              fontFamily: FONT.sans,
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontSize: 16,
                color: COLOR.muted,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                fontSize: 32,
                color: COLOR.ink,
                fontWeight: 400,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.value}
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
          maxWidth: 1400,
        }}
      >
        Dune Analytics on-chain study, Sept 2025–Mar 2026, via blockchain.news · Polymarket fast-markets analysis.
      </p>
    </SlideFrame>
  );
};
