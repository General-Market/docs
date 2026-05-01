import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const TACTICS = [
  {
    title: "KOL Trader Badges",
    body:
      "Polymarket badges active traders on X. They post screenshots of their wins. Free distribution paid in clout.",
  },
  {
    title: "Aggressive CPA",
    body:
      "$0.01 per click. $10 per $20+ deposit. Polymarket buys the funnel from the top — bots and KOLs both.",
  },
  {
    title: "TV + media partnerships",
    body:
      "Kalshi × CNBC multi-year exclusive. Polymarket × Substack, Dow Jones, sports leagues. Programming becomes order flow.",
  },
  {
    title: "Wallet + broker pipes",
    body:
      "Kalshi × Robinhood. Polymarket × MetaMask, two-tap trade. Distribution where the user already has cash.",
  },
];

export const Slide06Distribution: React.FC = () => {
  return (
    <SlideFrame eyebrow="Distribution" pageNumber={7} pageTotal={SLIDE_COUNT}>
      <p
        style={{
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 36,
          maxWidth: 1500,
        }}
      >
        Copy what worked. Run it on 1,000× more markets.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: 28,
          columnGap: 64,
          maxWidth: 1500,
          marginBottom: 28,
        }}
      >
        {TACTICS.map((t) => (
          <div key={t.title}>
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: 26,
                fontWeight: 500,
                color: COLOR.ink,
                marginBottom: 8,
              }}
            >
              {t.title}
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 20,
                color: COLOR.ink,
                lineHeight: 1.45,
              }}
            >
              {t.body}
            </div>
          </div>
        ))}
      </div>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 22,
          fontWeight: 500,
          color: COLOR.ink,
          lineHeight: 1.4,
          margin: 0,
          maxWidth: 1500,
        }}
      >
        GM edge: niche markets self-distribute — train delays, weather, individual game outcomes. Polymarket's playbook on 100× more SKUs.
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
        Marketing Brew, MEXC, Odaily — Kalshi/Polymarket distribution coverage, Q1 2026.
      </p>
    </SlideFrame>
  );
};
