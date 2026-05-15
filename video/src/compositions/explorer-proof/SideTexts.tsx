import React from "react";
import { AbsoluteFill } from "remotion";

export type SideTextsProps = {
  /** 0..1 — fades both texts in/out and drives the horizontal slide. */
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
      {/* LEFT — GENERAL / MARKET stacked */}
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
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
          }}
        >
          GENERAL
        </div>
        <div
          style={{
            fontSize: 120,
            fontWeight: 300,
          }}
        >
          MARKET
        </div>
      </div>

      {/* RIGHT — GENERALMARKET.IO single line, right-aligned */}
      <div
        style={{
          position: "absolute",
          right: "8%",
          top: "50%",
          transform: `translate(${rightOffset}px, -50%)`,
          opacity: clamped,
          color: "#FFFFFF",
          fontFamily: DISPLAY_STACK,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.022em",
          lineHeight: 1,
          textAlign: "right",
          textShadow: SHADOW,
          willChange: "transform, opacity",
        }}
      >
        GENERALMARKET.IO
      </div>
    </AbsoluteFill>
  );
};
