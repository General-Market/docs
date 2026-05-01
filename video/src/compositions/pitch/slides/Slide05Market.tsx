import React from "react";
import { AbsoluteFill } from "remotion";
import { Scene06_Starburst } from "../../replicates/rainbows-pitch/ScenesB";
import { COLOR, FONT, PAD, SLIDE_COUNT } from "../tokens";

export const Slide05Market: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <Scene06_Starburst />

      <div
        style={{
          position: "absolute",
          top: 64,
          left: PAD.x,
          fontFamily: FONT.serif,
          fontSize: 22,
          color: COLOR.muted,
          letterSpacing: "-0.005em",
          zIndex: 10,
        }}
      >
        General Market
      </div>

      <div
        style={{
          position: "absolute",
          top: 64,
          left: PAD.x,
          marginTop: 36,
          fontFamily: FONT.sans,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: COLOR.muted,
          zIndex: 10,
        }}
      >
        Market
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 64,
          right: PAD.x,
          fontFamily: FONT.sans,
          fontSize: 20,
          color: COLOR.muted,
          fontVariantNumeric: "tabular-nums",
          zIndex: 10,
        }}
      >
        05 / {String(SLIDE_COUNT).padStart(2, "0")}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 64,
          left: PAD.x,
          fontFamily: FONT.sans,
          fontSize: 14,
          color: COLOR.muted,
          zIndex: 10,
          maxWidth: 900,
        }}
      >
        Polymarket + Kalshi cleared $21B/month combined in Q1 2026 across ~2,500 markets. The next 200× of category growth is locked behind correlated-asset architecture. TRM Labs, 2026.
      </div>
    </AbsoluteFill>
  );
};
