import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide05Market: React.FC = () => {
  return (
    <SlideFrame eyebrow="Market" pageNumber={5} pageTotal={SLIDE_COUNT}>
      <div
        style={{
          fontFamily: FONT.serif,
          fontSize: 200,
          fontWeight: 300,
          color: COLOR.ink,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          marginBottom: 32,
        }}
      >
        $21B<span style={{ color: COLOR.muted, fontSize: 96 }}> / month</span>
      </div>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 32,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.45,
          margin: 0,
          marginBottom: 16,
          maxWidth: 1500,
        }}
      >
        Prediction-market notional, Q1 2026. Up from $4B in late 2024.
      </p>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 28,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 16,
          maxWidth: 1500,
        }}
      >
        Polymarket: $29B YTD. Kalshi: $37B YTD. Combined: 87% of category.
      </p>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 28,
          fontWeight: 500,
          color: COLOR.ink,
          lineHeight: 1.4,
          margin: 0,
          maxWidth: 1500,
        }}
      >
        Listing 2,000× more markets is the only way to expand it further.
      </p>
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
        TRM Labs prediction-market volume report, 2026 · CoinDesk Q1 2026 platform data.
      </p>
    </SlideFrame>
  );
};
