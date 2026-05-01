import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const CREDENTIALS = [
  {
    headline: "Symmio · Head of Research",
    body:
      "Wrote the whitepaper of the first OTC perps protocol. Now $40B cumulative volume, $200M market cap.",
  },
  {
    headline: "PIO Finance · Co-founder",
    body: "First 100% private on-chain perps. UTXO architecture. Acquired.",
  },
  {
    headline: "Independent research",
    body:
      "Authored the first on-chain Central Counterparties whitepaper. ETHDenver Basecamp speaker, 2024.",
  },
];

export const Slide10Team: React.FC = () => {
  return (
    <SlideFrame eyebrow="Team" pageNumber={13} pageTotal={SLIDE_COUNT}>
      <p
        style={{
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 16,
        }}
      >
        Solo founder. Six years on this exact stack.
      </p>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 22,
          fontWeight: 400,
          color: COLOR.muted,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 48,
          maxWidth: 1400,
        }}
      >
        Designed, engineered, shipped alone. Hiring against the seed.
      </p>

      <div style={{ maxWidth: 1300, marginBottom: 40 }}>
        {CREDENTIALS.map((c, i) => (
          <div
            key={c.headline}
            style={{
              padding: "18px 0",
              borderTop: i === 0 ? `1px solid ${COLOR.line}` : undefined,
              borderBottom: `1px solid ${COLOR.line}`,
              fontFamily: FONT.sans,
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: COLOR.ink,
                marginBottom: 4,
              }}
            >
              {c.headline}
            </div>
            <div style={{ fontSize: 20, color: COLOR.muted, lineHeight: 1.4 }}>
              {c.body}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16 }}>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 14,
            color: COLOR.muted,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Backed by
        </div>
        <div
          style={{
            fontFamily: FONT.serif,
            fontSize: 28,
            fontWeight: 500,
            color: COLOR.ink,
          }}
        >
          Symmio · Lafachief
        </div>
      </div>

      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 14,
          color: COLOR.muted,
          margin: 0,
          wordBreak: "break-all",
        }}
      >
        file:///Users/maxguillabert/Downloads/index/resume.html
      </p>
    </SlideFrame>
  );
};
