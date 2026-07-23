import React from "react";
import type { Market } from "./data";

const FONT_DISPLAY =
  '"SF Pro Display", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_TEXT =
  '"SF Pro Text", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

const C = {
  ink: "#1D1D1F",
  inkSecondary: "#6E6E73",
  inkTertiary: "#86868B",
  border: "rgba(0, 0, 0, 0.08)",
  cardBg: "rgba(255, 255, 255, 0.78)",
  fundsTint: "rgba(157, 25, 25, 0.05)",
  accentRed: "#9D1919",
};

type Props = {
  market: Market;
};

// Apple product-page card. Centered, glass, drop shadow, vivid broll bleeding
// around the edges. The card is the subject; the broll is the texture.
export const MarketAnatomyTable: React.FC<Props> = ({ market }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_TEXT,
        color: C.ink,
      }}
    >
      <div
        style={{
          // Single floating glass card. Width pinned to Apple's 1068
          // content rail, plus padding.
          width: 1500,
          background: C.cardBg,
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderRadius: 22,
          border: "1px solid rgba(255, 255, 255, 0.55)",
          // Apple-style soft layered shadow.
          boxShadow:
            "0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 30px 80px rgba(0, 0, 0, 0.32), 0 8px 24px rgba(0, 0, 0, 0.18)",
          padding: "56px 64px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/* Eyebrow + pool size */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.011em",
              textTransform: "uppercase",
              color: C.inkTertiary,
            }}
          >
            {market.eyebrow}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.011em",
              textTransform: "uppercase",
              color: C.inkTertiary,
            }}
          >
            {market.poolSize}
          </div>
        </div>

        {/* Title + subtitle */}
        <div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 72,
              fontWeight: 600,
              color: C.ink,
              letterSpacing: "-0.022em",
              lineHeight: 1.0714,
              marginBottom: 10,
            }}
          >
            {market.title}
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 32,
              fontWeight: 400,
              color: C.inkSecondary,
              letterSpacing: "-0.016em",
              lineHeight: 1.25,
            }}
          >
            {market.subtitle}
          </div>
        </div>

        {/* Table — flat, no inner card, just rows on the glass */}
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 0.5fr 2fr",
              gap: 24,
              paddingBottom: 14,
              borderBottom: `1px solid ${C.border}`,
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.011em",
              textTransform: "uppercase",
              color: C.inkTertiary,
            }}
          >
            <div>Strategy</div>
            <div>% of profit pool</div>
            <div>Source basis</div>
          </div>

          {market.strategies.map((row) => (
            <div
              key={row.name}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 0.5fr 2fr",
                gap: 24,
                alignItems: "center",
                padding: "14px 0",
                borderBottom: `1px solid ${C.border}`,
                background: row.fundsPool ? C.fundsTint : "transparent",
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: C.ink,
                  letterSpacing: "-0.022em",
                  lineHeight: 1.25,
                }}
              >
                {row.name}
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 32,
                  fontWeight: 600,
                  color: row.fundsPool ? C.accentRed : C.ink,
                  letterSpacing: "-0.016em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.percentage}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 400,
                  color: C.inkSecondary,
                  letterSpacing: "-0.016em",
                  lineHeight: 1.4,
                }}
              >
                {row.sourceBasis}
              </div>
            </div>
          ))}
        </div>

        {/* Closer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 32,
            paddingTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.011em",
              textTransform: "uppercase",
              color: C.inkTertiary,
            }}
          >
            general market
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 24,
              fontWeight: 500,
              color: C.ink,
              letterSpacing: "-0.016em",
              lineHeight: 1.25,
              textAlign: "right",
              maxWidth: 900,
            }}
          >
            {market.closer}
          </div>
        </div>
      </div>
    </div>
  );
};
