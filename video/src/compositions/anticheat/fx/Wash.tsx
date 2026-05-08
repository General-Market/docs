import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// Atmospheric wash — cheap edition. No backdrop-filter (too costly in
// the studio preview). Two static gradient layers fake the DoF mood:
//
//   1. A vignette darkening the periphery, fading transparent at the
//      focal point. Reads as out-of-focus depth.
//   2. A blue tint scrim, also masked, multiplied over the scene.
//
// Compared to a real DoF blur, this loses precision but keeps the
// preview interactive. The scene chrome behind never actually blurs;
// the eye reads the darkened periphery as soft focus.

export interface WashProps {
  // Absolute composition frame at which the wash begins ramping in.
  startFrame: number;
  inFrames?: number;
  hold: number; // duration at full intensity
  outFrames?: number;
  cx?: string;
  cy?: string;
  // size of the "sharp" central hole. Larger = more of the frame stays
  // un-touched by the scrim.
  holeSize?: string; // e.g. "30%"
  holeSoftness?: string; // where the hole feathers out, e.g. "65%"
  // Vignette darkness at peak (peripheral darkening intensity).
  vignette?: number; // 0..1, multiplied by env
  vignetteColor?: string; // colour for periphery darkening
  tint?: string; // overlay tint colour
  tintOpacity?: number; // peak tint alpha (multiplied by env)
  blendMode?: React.CSSProperties["mixBlendMode"];
}

export const Wash: React.FC<WashProps> = ({
  startFrame,
  inFrames = 14,
  hold,
  outFrames = 18,
  cx = "50%",
  cy = "50%",
  holeSize = "30%",
  holeSoftness = "65%",
  vignette = 0.55,
  vignetteColor = "rgba(8, 14, 30, 1)",
  tint = "rgba(0, 82, 255, 1)",
  tintOpacity = 0.18,
  blendMode = "multiply",
}) => {
  const local = useCurrentFrame() - startFrame;
  const total = inFrames + hold + outFrames;
  if (local < 0 || local > total) return null;

  const env = interpolate(
    local,
    [0, inFrames, inFrames + hold, total],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.3, 1),
    },
  );
  if (env <= 0) return null;

  // Static gradients — no filter, no backdrop-filter, no blend on the
  // vignette layer (multiply only on the tint). Cheapest possible DoF
  // surrogate while keeping the focal point un-touched.
  const vignetteBg = `radial-gradient(ellipse ${holeSize} ${holeSize} at ${cx} ${cy}, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 38%, ${vignetteColor} ${holeSoftness}, ${vignetteColor} 100%)`;
  const tintBg = `radial-gradient(ellipse ${holeSize} ${holeSize} at ${cx} ${cy}, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 42%, ${tint} 92%)`;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: vignetteBg,
          opacity: vignette * env,
        }}
      />
      <AbsoluteFill
        style={{
          background: tintBg,
          opacity: tintOpacity * env,
          mixBlendMode: blendMode,
        }}
      />
    </AbsoluteFill>
  );
};
