import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { font } from "../../../common/fonts";

// A giant faint word sitting behind the subject. Big size, low alpha,
// gently blurred. Fades in over `inFrames`, holds, fades out at the end.
//
// Frame range is scene-local (mount inside a Sequence to position).

export interface GhosttypeProps {
  word: string;
  inFrames?: number;
  hold: number;
  outFrames?: number;
  // CSS size for the rendered word. 38vw matches the 1920×1080 reference
  // wordmarks that occupy ~70% of the frame width.
  size?: string;
  weight?: number;
  letterSpacing?: string;
  color?: string;
  opacity?: number;
  blurPx?: number;
  cx?: string;
  cy?: string;
  // How tall the text container is, in CSS. Controls vertical centring.
  rotate?: number; // degrees
}

export const Ghosttype: React.FC<GhosttypeProps> = ({
  word,
  inFrames = 18,
  hold,
  outFrames = 18,
  size = "38vw",
  weight = 200,
  letterSpacing = "-0.04em",
  color = "rgba(91, 134, 255, 1)",
  opacity = 0.08,
  blurPx = 6,
  cx = "50%",
  cy = "50%",
  rotate = 0,
}) => {
  const frame = useCurrentFrame();
  const total = inFrames + hold + outFrames;
  if (frame < 0 || frame > total) return null;

  const env = interpolate(
    frame,
    [0, inFrames, inFrames + hold, total],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.3, 1),
    },
  );
  if (env <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
          fontFamily: font,
          fontSize: size,
          fontWeight: weight,
          letterSpacing,
          color,
          opacity: opacity * env,
          filter: `blur(${blurPx}px)`,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {word}
      </div>
    </AbsoluteFill>
  );
};
