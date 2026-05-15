// SideTexts — left wordmark "GENERAL / MARKET" in SF Pro Display, right
// tagline "THE / TRADING / ANTI-CHEAT" stacked on three lines in a
// contrasting monospace face. The contrast is deliberate: the brand
// name reads as marketing display type, the tagline reads as terminal
// proof. The whole pair fades and slides in via the `visibility` prop.

import React from "react";
import { AbsoluteFill } from "remotion";
import { monoFont } from "../../common/fonts";

export type SideTextsProps = {
  /** 0..1 — fades both blocks in/out and drives the horizontal slide. */
  visibility: number;
};

const DISPLAY_STACK =
  '"SF Pro Display", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
const SHADOW = "0 2px 12px rgba(0,0,0,0.08)";

export const SideTexts: React.FC<SideTextsProps> = ({ visibility }) => {
  const clamped = Math.max(0, Math.min(1, visibility));
  const leftOffset = -30 + clamped * 30;
  const rightOffset = 30 - clamped * 30;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* LEFT — GENERAL / MARKET stacked, display sans */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          top: "50%",
          transform: `translate(${leftOffset}px, -50%)`,
          opacity: clamped,
          color: "#FFFFFF",
          fontFamily: DISPLAY_STACK,
          letterSpacing: "-0.022em",
          lineHeight: 0.92,
          textShadow: SHADOW,
          willChange: "transform, opacity",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800 }}>GENERAL</div>
        <div style={{ fontSize: 120, fontWeight: 300 }}>MARKET</div>
      </div>

      {/* RIGHT — THE / TRADING / ANTI-CHEAT stacked, monospace */}
      <div
        style={{
          position: "absolute",
          right: "8%",
          top: "50%",
          transform: `translate(${rightOffset}px, -50%)`,
          opacity: clamped,
          color: "#FFFFFF",
          fontFamily: monoFont,
          textAlign: "right",
          textShadow: SHADOW,
          willChange: "transform, opacity",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 400,
            letterSpacing: "0.04em",
            opacity: 0.78,
            textTransform: "uppercase",
            lineHeight: 1.05,
          }}
        >
          The
        </div>
        <div
          style={{
            fontSize: 86,
            fontWeight: 500,
            letterSpacing: "0",
            textTransform: "uppercase",
            lineHeight: 1.0,
            marginTop: 4,
          }}
        >
          Trading
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            lineHeight: 1.0,
            marginTop: 6,
          }}
        >
          Anti-Cheat
        </div>
      </div>
    </AbsoluteFill>
  );
};
