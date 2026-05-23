// Faithful port of the Hitchcock "Psycho" title sequence by Rob O'Leary
// (animejs original). Three horizontal slabs of the same "PSYCHO" wordmark,
// clipped to top/middle/bottom thirds, stack into one whole word. The middle
// slab quivers (snap-left, snap-right, snap-left); then the top slab slides
// up off-screen, the bottom slab slides down, and a 50-bar audio visualizer
// (25 above + 25 below) scales up to its full per-bar height with an
// easeOut curve and then pulses like a waveform.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  interpolate,
} from "remotion";

const BG = "black";
const GREEN = "hsl(123, 70%, 45%)";

// .bars.upper .bar:nth-of-type(n) heights — relative to the bars container.
const BAR_HEIGHTS_UPPER = [
  0.04, 0.09, 0.12, 0.06, 0.05, 0.11, 0.19, 0.21, 0.17, 0.14, 0.30,
  0.35, 0.33, 0.35, 0.30, 0.14, 0.17, 0.21, 0.19, 0.11, 0.05, 0.06,
  0.10, 0.09, 0.04,
];
// .bars.lower overrides 1-6, 14, 16, 18, 19, 24 from the same base array.
const BAR_HEIGHTS_LOWER = [
  0.11, 0.12, 0.19, 0.13, 0.07, 0.07, 0.19, 0.21, 0.17, 0.14, 0.30,
  0.35, 0.33, 0.40, 0.30, 0.23, 0.17, 0.18, 0.14, 0.11, 0.05, 0.06,
  0.10, 0.16, 0.04,
];

const easeOut = Easing.bezier(0.0, 0.0, 0.2, 1);

// SVG viewBox for the wordmark. 525 wide, 198 tall — three 66-tall bands.
const SVG_VIEW_W = 525;
const SVG_VIEW_H = 198;

// One slab = one <g> with a clipPath restricting the shared <text> to a band.
const TitleSlab: React.FC<{
  band: "top" | "mid" | "bot";
  xPx: number;
  yPx: number;
}> = ({ band, xPx, yPx }) => {
  const clipId =
    band === "top" ? "psycho-clip-top" : band === "mid" ? "psycho-clip-mid" : "psycho-clip-bot";
  // The middle slab has scaleY(1.05) to close the 1px gaps between bands.
  const scaleY = band === "mid" ? 1.05 : 1;
  return (
    <g
      transform={`translate(${xPx} ${yPx}) scale(1 ${scaleY})`}
      style={{ transformOrigin: "center center" }}
    >
      <use href="#psycho-text" clipPath={`url(#${clipId})`} />
    </g>
  );
};

export const PsychoTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps; // seconds

  // ---- Middle-slab quiver: snap to -10% at 0.3s, snap to +5% at 1.0s,
  //      snap back to -10% at 1.8s. Each snap is a 100ms linear interpolation.
  let middleXPct = 0; // % of slab width
  if (t < 0.3) {
    middleXPct = 0;
  } else if (t < 0.4) {
    middleXPct = interpolate(t, [0.3, 0.4], [0, -10], { extrapolateRight: "clamp" });
  } else if (t < 1.0) {
    middleXPct = -10;
  } else if (t < 1.1) {
    middleXPct = interpolate(t, [1.0, 1.1], [-10, 5], { extrapolateRight: "clamp" });
  } else if (t < 1.8) {
    middleXPct = 5;
  } else if (t < 1.9) {
    middleXPct = interpolate(t, [1.8, 1.9], [5, -10], { extrapolateRight: "clamp" });
  } else {
    middleXPct = -10;
  }

  // ---- Slab slide-out at t=4.0s..4.5s. dvh maps to viewport height.
  const slabProgress = interpolate(t, [4.0, 4.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dvh = height; // 1080 in our 1920x1080 scene
  const topSlabY = -slabProgress * 0.8 * dvh;
  const botSlabY = slabProgress * 0.8 * dvh;

  // ---- Bars: scale from 0 → 1 over 4.0s..5.0s with easeOut. Then pulse.
  const barRawProgress = interpolate(t, [4.0, 5.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barProgress = easeOut(barRawProgress);

  const pulseFactor = (i: number) => {
    if (t < 5.0) return 1;
    // subtle waveform pulse — frame/8 + i for per-bar phase
    return 0.92 + 0.08 * Math.sin(frame / 8 + i);
  };

  // ---- Title SVG sizing: ~70% of viewport width, centered. We draw it as
  //      one SVG so all three slabs share a single <text> def and stay aligned.
  const svgWidth = width * 0.7;
  const svgHeight = (svgWidth * SVG_VIEW_H) / SVG_VIEW_W;

  // Middle slab x offset in viewBox units (% of full slab width = SVG_VIEW_W).
  const midXViewBox = (middleXPct / 100) * SVG_VIEW_W;

  // Per-slab Y translation in viewBox units. The slide-out is in CSS pixels,
  // so convert viewport px → viewBox units via svgHeight/SVG_VIEW_H.
  const pxToVB = SVG_VIEW_H / svgHeight;
  const topYViewBox = topSlabY * pxToVB;
  const botYViewBox = botSlabY * pxToVB;

  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      {/* ---- Title block, centered ---- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          viewBox={`0 0 ${SVG_VIEW_W} ${SVG_VIEW_H}`}
          width={svgWidth}
          height={svgHeight}
          style={{ overflow: "visible" }}
        >
          <defs>
            <text
              id="psycho-text"
              x={SVG_VIEW_W / 2}
              y={155}
              textAnchor="middle"
              fontFamily='"Lucida Sans","Helvetica Neue",sans-serif'
              fontWeight={900}
              fontSize={210}
              letterSpacing={2}
              fill="white"
            >
              PSYCHO
            </text>
            <clipPath id="psycho-clip-top">
              <rect x={0} y={0} width={SVG_VIEW_W} height={66} />
            </clipPath>
            <clipPath id="psycho-clip-mid">
              <rect x={0} y={66} width={SVG_VIEW_W} height={66} />
            </clipPath>
            <clipPath id="psycho-clip-bot">
              <rect x={0} y={132} width={SVG_VIEW_W} height={66} />
            </clipPath>
          </defs>

          <TitleSlab band="top" xPx={0} yPx={topYViewBox} />
          <TitleSlab band="mid" xPx={midXViewBox} yPx={0} />
          <TitleSlab band="bot" xPx={0} yPx={botYViewBox} />
        </svg>
      </div>

      {/* ---- Upper bars (rotated 180° so they grow down from the top edge) ---- */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "49.5%",
          paddingTop: "0.5%",
          display: "flex",
          justifyContent: "space-evenly",
          transform: "rotate(180deg)",
        }}
      >
        {BAR_HEIGHTS_UPPER.map((h, i) => {
          const finalPct = h * pulseFactor(i) * barProgress;
          return (
            <div
              key={i}
              style={{
                width: "2%",
                height: `${finalPct * 100}%`,
                background: GREEN,
                transformOrigin: "center top",
              }}
            />
          );
        })}
      </div>

      {/* ---- Lower bars ---- */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "49.5%",
          paddingTop: "0.5%",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {BAR_HEIGHTS_LOWER.map((h, i) => {
          const finalPct = h * pulseFactor(i + 25) * barProgress;
          return (
            <div
              key={i}
              style={{
                width: "2%",
                height: `${finalPct * 100}%`,
                background: GREEN,
                transformOrigin: "center top",
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
