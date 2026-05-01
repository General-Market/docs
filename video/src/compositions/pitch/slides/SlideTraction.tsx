import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const METRICS = [
  { value: "96", label: "markets per batch", sub: "Vision + ITP, live" },
  { value: "3", label: "BLS oracle nodes", sub: "consensus on every settle" },
  { value: "3", label: "chains wired", sub: "L3 · Settlement · Sonic" },
  { value: "5", label: "ITPs deployed", sub: "first on-chain index OTC" },
];

export const SlideTraction: React.FC = () => {
  return (
    <SlideFrame eyebrow="Traction" pageNumber={10} pageTotal={SLIDE_COUNT}>
      <p
        style={{
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 8,
        }}
      >
        Live on testnet.
      </p>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 22,
          color: COLOR.muted,
          margin: 0,
          marginBottom: 56,
        }}
      >
        generalmarket.io — buy, sell, leaderboard, batch settlement, BLS-verified oracles.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 32,
          maxWidth: 1500,
          marginBottom: 48,
        }}
      >
        {METRICS.map((m) => (
          <div
            key={m.label}
            style={{
              borderTop: `1px solid ${COLOR.ink}`,
              paddingTop: 20,
            }}
          >
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: 96,
                fontWeight: 300,
                color: COLOR.ink,
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                marginBottom: 12,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {m.value}
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 18,
                color: COLOR.ink,
                fontWeight: 500,
                marginBottom: 4,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 16,
                color: COLOR.muted,
                lineHeight: 1.4,
              }}
            >
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 24,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.45,
          margin: 0,
          maxWidth: 1500,
        }}
      >
        The architecture is shipped. The remaining work is hardening, audit, and
        liquidity — not invention.
      </p>
    </SlideFrame>
  );
};
