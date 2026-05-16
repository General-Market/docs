// Side wordmarks — exported as plain inner components so they can be
// dropped inside drei <Html> wrappers in the 3D scene. The wrappers
// handle world-space anchoring and depth occlusion; these just paint
// the DOM. Left: "GENERAL / MARKET" stacked in SF Pro Display; right:
// "The / Trading / Anti-Cheat" stacked in the monospace face.

import React from "react";
import { monoFont } from "../../common/fonts";

const DISPLAY_STACK =
  '"SF Pro Display", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';

export type WordmarkProps = {
  /** 0..1 — drives a tiny slide-in at the very start of the comp. */
  visibility: number;
};

function slideOffset(visibility: number): number {
  const clamped = Math.max(0, Math.min(1, visibility));
  const settled = clamped > 0.05 ? 1 : clamped / 0.05;
  return -30 + settled * 30;
}

export const LeftWordmark: React.FC<WordmarkProps> = ({ visibility }) => {
  const offset = slideOffset(visibility);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${offset}px, -50%)`,
        color: "#000000",
        fontFamily: DISPLAY_STACK,
        letterSpacing: "-0.022em",
        lineHeight: 0.92,
        whiteSpace: "nowrap",
        willChange: "transform",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 120, fontWeight: 800 }}>GENERAL</div>
      <div style={{ fontSize: 120, fontWeight: 300 }}>MARKET</div>
    </div>
  );
};

export const RightWordmark: React.FC<WordmarkProps> = ({ visibility }) => {
  const offset = -slideOffset(visibility);
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        transform: `translate(${offset}px, -50%)`,
        color: "#000000",
        fontFamily: monoFont,
        textAlign: "right",
        whiteSpace: "nowrap",
        willChange: "transform",
        pointerEvents: "none",
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
  );
};
