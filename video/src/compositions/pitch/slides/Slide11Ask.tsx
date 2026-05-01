import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const BREAKDOWN = [
  { label: "Engineering · 3 hires × 6 mo", value: "$150k" },
  { label: "Audit + security", value: "$50k" },
  { label: "Initial liquidity", value: "$150k" },
  { label: "Ops, legal, infra", value: "$50k" },
];

export const Slide11Ask: React.FC = () => {
  return (
    <SlideFrame eyebrow="The Ask" pageNumber={14} pageTotal={SLIDE_COUNT}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 96,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT.serif,
              fontSize: 220,
              fontWeight: 300,
              color: COLOR.ink,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              marginBottom: 24,
            }}
          >
            $400k
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 24,
              fontWeight: 500,
              color: COLOR.ink,
              marginBottom: 8,
            }}
          >
            SAFE @ [TBD] cap · [TBD]% ESOP
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 22,
              color: COLOR.muted,
              lineHeight: 1.45,
              maxWidth: 600,
            }}
          >
            Six months to mainnet, audited.
          </div>
        </div>

        <div style={{ paddingTop: 32 }}>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 14,
              color: COLOR.muted,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Use of funds
          </div>
          {BREAKDOWN.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "16px 0",
                borderTop: i === 0 ? `1px solid ${COLOR.line}` : undefined,
                borderBottom: `1px solid ${COLOR.line}`,
                fontFamily: FONT.sans,
              }}
            >
              <div style={{ fontSize: 22, color: COLOR.ink }}>{row.label}</div>
              <div
                style={{
                  fontSize: 24,
                  color: COLOR.ink,
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.value}
              </div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "20px 0 0",
              fontFamily: FONT.sans,
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
              Total
            </div>
            <div
              style={{
                fontSize: 28,
                color: COLOR.ink,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              $400k
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
};
