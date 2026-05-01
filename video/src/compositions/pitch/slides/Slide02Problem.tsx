import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide02Problem: React.FC = () => {
  return (
    <SlideFrame eyebrow="Problem" pageNumber={2} pageTotal={SLIDE_COUNT}>
      <h2
        style={{
          fontFamily: FONT.serif,
          fontSize: 96,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 36,
          maxWidth: 1500,
        }}
      >
        84% of traders lose.
      </h2>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 38,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 24,
          maxWidth: 1400,
        }}
      >
        The top 1% capture 77% of all gains. The top 0.1% take more than half.
      </p>
      <p
        style={{
          fontFamily: FONT.sans,
          fontSize: 28,
          fontWeight: 400,
          color: COLOR.muted,
          lineHeight: 1.4,
          margin: 0,
          maxWidth: 1400,
          fontStyle: "italic",
        }}
      >
        April 2026: a U.S. Special Forces sergeant charged with insider trading on Polymarket — $400k on the Maduro raid, paid by classified intel.
      </p>
      <p
        style={{
          position: "absolute",
          bottom: 64,
          left: 192,
          fontFamily: FONT.sans,
          fontSize: 16,
          color: COLOR.muted,
          margin: 0,
        }}
      >
        Akey et al., "Who Wins and Who Loses In Prediction Markets," SSRN, 2026 · TIME, April 2026.
      </p>
    </SlideFrame>
  );
};
