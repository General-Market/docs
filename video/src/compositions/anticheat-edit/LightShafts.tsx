/**
 * LightShafts — dynamic volumetric light, meant to live BEHIND the subject.
 *
 * Diagonal god-ray beams masked to the top-left, plus a flare crossing to the
 * bottom-right with a travelling hotspot. White cores, only an edge of blue,
 * so it reads as light, not a gel. Screen-blended — adds light only. It needs
 * a dimmed background to read (you can't brighten a white wall).
 *
 * Beams are a masked repeating-gradient (robust) rather than rotated elements.
 * Static light looks fake; this only works in motion. Tune at :3333.
 *
 *   opacity  overall strength
 *   blue     0 = white light, 1 = strong electric blue in the beams
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";

export const LightShafts: React.FC<{ opacity?: number; blue?: number }> = ({
  opacity = 1,
  blue = 0.55,
}) => {
  const frame = useCurrentFrame();
  const breathe = 0.8 + 0.2 * Math.sin(frame / 50);

  const col = (a: number) =>
    `rgba(${Math.round(255 - blue * 80)},${Math.round(255 - blue * 35)},255,${a})`;

  const drift = noise2D("shaft", frame * 0.01, 0) * 70 + Math.sin(frame / 72) * 40;
  const beamA = 0.55 * breathe * opacity;

  const ht = 0.5 + 0.4 * Math.sin(frame / 64); // hotspot travels the diagonal
  const flareA = (0.42 + 0.14 * Math.sin(frame / 38)) * breathe * opacity;

  const mask =
    "radial-gradient(125% 115% at 8% -8%, #000 0%, rgba(0,0,0,0.6) 26%, rgba(0,0,0,0) 58%)";

  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity }}>
      {/* god-ray beams: diagonal stripes, faded into the top-left */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(118deg, ${col(0)} 0px, ${col(0)} 42px, ${col(beamA)} 66px, ${col(0)} 90px)`,
          backgroundPosition: `${drift}px 0`,
          WebkitMaskImage: mask,
          maskImage: mask,
          filter: "blur(3px)",
        }}
      />
      {/* diagonal flare: top -> bottom-right, travelling hotspot */}
      <div
        style={{
          position: "absolute",
          left: "-6%",
          top: "50%",
          width: "112%",
          height: 8,
          transformOrigin: "center",
          transform: "rotate(40deg)",
          background: `radial-gradient(ellipse 56% 50% at ${ht * 100}% 50%, rgba(245,250,255,${flareA}) 0%, ${col(flareA * 0.45)} 28%, rgba(0,0,0,0) 70%)`,
          filter: "blur(3px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${6 + ht * 80}%`,
          top: `${20 + ht * 64}%`,
          width: 96,
          height: 96,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(248,252,255,${flareA * 1.2}) 0%, ${col(0)} 64%)`,
          filter: "blur(9px)",
        }}
      />
    </AbsoluteFill>
  );
};
