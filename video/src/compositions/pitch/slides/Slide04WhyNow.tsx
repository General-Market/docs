import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const CATALYSTS = [
  {
    num: "01",
    title: "The category went vertical.",
    body:
      "Polymarket and Kalshi cleared $21B in monthly notional in early 2026 — up from $4B fifteen months earlier. The 2024 election made prediction markets famous. The 2026 sports + politics expansion made them institutional.",
    footnote: "TRM Labs prediction-market volume report, 2026.",
  },
  {
    num: "02",
    title: "Trading 1,000 markets is now retail.",
    body:
      "Agentic frameworks ship as npm modules. Bot SDKs run from a laptop. The thing only quants could do — route capital across hundreds of correlated bets in real time — now sits behind a single API call.",
    footnote: "Public agent frameworks (Eliza, Goat, etc.), 2025–2026.",
  },
];

export const Slide04WhyNow: React.FC = () => {
  return (
    <SlideFrame eyebrow="Why Now" pageNumber={4} pageTotal={SLIDE_COUNT}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 96,
          width: "100%",
        }}
      >
        {CATALYSTS.map((c) => (
          <div key={c.num}>
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: 22,
                fontWeight: 400,
                color: COLOR.muted,
                letterSpacing: "0.18em",
                marginBottom: 24,
              }}
            >
              {c.num}
            </div>
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: 48,
                fontWeight: 400,
                color: COLOR.ink,
                lineHeight: 1.15,
                letterSpacing: "-0.015em",
                marginBottom: 28,
              }}
            >
              {c.title}
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 24,
                fontWeight: 400,
                color: COLOR.ink,
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              {c.body}
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 14,
                color: COLOR.muted,
              }}
            >
              {c.footnote}
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
};
