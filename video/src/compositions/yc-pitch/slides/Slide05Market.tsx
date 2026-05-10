import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT, PAD } from "../tokens";

const Stat: React.FC<{
  value: string;
  unit: string;
  label: string;
  year: string;
}> = ({ value, unit, label, year }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      minWidth: 0,
    }}
  >
    <div
      style={{
        fontFamily: FONT.display,
        fontSize: 92,
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
        fontFamily: FONT.text,
        fontSize: 12,
        fontWeight: 600,
        color: COLOR.muted,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginTop: 4,
      }}
    >
      {unit}
    </div>
    <div
      style={{
        fontFamily: FONT.display,
        fontSize: 20,
        fontWeight: 500,
        color: COLOR.ink,
        letterSpacing: "-0.018em",
        lineHeight: 1.3,
        marginTop: 12,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: FONT.text,
        fontSize: 13,
        color: COLOR.muted,
        letterSpacing: "-0.01em",
      }}
    >
      {year}
    </div>
  </div>
);

export const Slide05Market: React.FC = () => {
  return (
    <SlideFrame eyebrow="Market" pageNumber={5} pageTotal={SLIDE_COUNT}>
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 72,
          fontWeight: 600,
          color: COLOR.ink,
          lineHeight: 1.04,
          letterSpacing: "-0.028em",
          margin: 0,
          marginBottom: 72,
          maxWidth: 1500,
        }}
      >
        Retail trades trillions. The bots watch every cent.
      </h1>

      <div
        style={{
          display: "flex",
          gap: 32,
          width: "100%",
          alignItems: "flex-start",
        }}
      >
        <Stat
          value="$30T"
          unit="per month"
          label="Retail CFDs"
          year="Q2 2025"
        />
        <Stat
          value="$18.6T"
          unit="annual"
          label="Crypto spot"
          year="2025"
        />
        <Stat
          value="15.2B"
          unit="contracts / yr"
          label="Options industry"
          year="2025"
        />
        <Stat
          value="$66B"
          unit="YTD, 4 months"
          label="Prediction markets"
          year="2026"
        />
        <Stat
          value="$1.4B"
          unit="in 2 weeks"
          label="Memecoin launchpads"
          year="Aug 2025"
        />
      </div>

      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 26,
          fontWeight: 400,
          color: COLOR.ink,
          letterSpacing: "-0.02em",
          marginTop: 56,
          paddingTop: 28,
          borderTop: `1px solid ${COLOR.line}`,
        }}
      >
        Five retail markets. One umpire.{" "}
        <span style={{ color: COLOR.blue, fontWeight: 600 }}>0.1%</span> on any
        of them is a real business.
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: PAD.x,
          right: PAD.x,
          fontFamily: FONT.text,
          fontSize: 11,
          color: COLOR.muted,
          letterSpacing: "-0.005em",
          opacity: 0.7,
          lineHeight: 1.55,
        }}
      >
        Sources · FinanceMagnates / TradingView, Retail FX-CFD Industry Report,
        Q2 2025 · CoinGecko, Spot CEX + DEX Activity Report 2026 · Cboe, State
        of the Options Industry 2025 · AInvest, Kalshi + Polymarket April 2026
        volume tracker · The Block, Pump.fun launchpad metrics, Aug 2025.
      </div>
    </SlideFrame>
  );
};
