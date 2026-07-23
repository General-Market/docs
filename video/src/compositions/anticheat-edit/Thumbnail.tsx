/**
 * AntiCheatEditThumbnail — the YouTube miniature for the AntiCheatEdit talk.
 *
 * It keeps the visual vocabulary of the film's inverted end card: the Base-blue
 * field, the white electric dot grid, the shock rings radiating from the centre.
 * The market maker (Wintermute) stands in white on that field — the same
 * inversion the General mark gets on the end card. A red Caveat hand — "The
 * end?" — with a hand-drawn arrow points straight at it. The question is the
 * hook; the arrow makes it impossible to misread who it is asked of.
 *
 * Designed as a still. The electric field is frozen (no useCurrentFrame), so
 * every frame is identical and the rendered PNG is deterministic.
 *   npx remotion still <entry> AntiCheatEditThumbnail out/anticheat-thumb.png
 */

import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";

const { fontFamily: caveatFont } = loadCaveat("normal", {
  subsets: ["latin"],
  weights: ["700"],
});

const W = 1920;
const H = 1080;
const FPS = 30;

const BLUE = "#2D5BFF";
const EDGE = "#020E2B"; // the film's dark-navy root — the vignette sinks to this
const RED = "#FF2D2D";

// Centre axis. A miniature reads strongest on symmetry: the mark, the electric
// burst and the bloom all key off this point, so the energy radiates evenly to
// every edge. The wordmark hangs one tier below; the red question sits one tier
// above. Three tiers, one axis.
const MARK_CX = 960;
const MARK_CY = 512; // mark optical centre = electric burst centre
const WORDMARK_CY = 770; // the wordmark tier, below the mark

// ─── Electric field — frozen shock rings over a fine white dot grid ──────────
// Same recipe as AntiCheatEndCard's WhiteDotGrid, but the rings are pinned at
// fixed radii rather than driven by time, so the still reads as one frozen
// burst. Dots brighten where a ring front passes through them.

const DOT_SPACING = 16;
const DOT_RADIUS = 1.8;
const DOT_ALPHA_BASE = 0.17;
const DOT_ALPHA_PEAK = 1.0;
const RING_THICKNESS = 92;

// Concentric shock rings radiating from behind the mark. The outer rings stay
// bright on purpose — they're the ones that read in the open blue field; the
// inner two sit under the lockup and its bloom.
const RINGS: { r: number; intensity: number }[] = [
  { r: 175, intensity: 1.0 },
  { r: 360, intensity: 0.92 },
  { r: 560, intensity: 0.82 },
  { r: 780, intensity: 0.66 },
  { r: 1010, intensity: 0.5 },
  { r: 1270, intensity: 0.36 },
];

const ElectricField: React.FC = () => {
  const cols = Math.ceil(W / DOT_SPACING) + 2;
  const rows = Math.ceil(H / DOT_SPACING) + 2;

  const base: React.ReactNode[] = [];
  const boost: React.ReactNode[] = [];

  for (let ry = 0; ry < rows; ry++) {
    const y = ry * DOT_SPACING - DOT_SPACING / 2;
    for (let rx = 0; rx < cols; rx++) {
      const x = rx * DOT_SPACING - DOT_SPACING / 2;
      const k = `${ry},${rx}`;

      base.push(
        <circle key={`b${k}`} cx={x} cy={y} r={DOT_RADIUS} fill="#FFFFFF" opacity={DOT_ALPHA_BASE} />,
      );

      const dist = Math.hypot(x - MARK_CX, y - MARK_CY);
      let b = 0;
      for (const ring of RINGS) {
        const d = Math.abs(dist - ring.r);
        if (d < RING_THICKNESS) {
          const local = 1 - d / RING_THICKNESS;
          b = Math.max(b, local * local * ring.intensity);
        }
      }
      if (b > 0.04) {
        const alpha = DOT_ALPHA_BASE + (DOT_ALPHA_PEAK - DOT_ALPHA_BASE) * b;
        boost.push(
          <circle
            key={`w${k}`}
            cx={x}
            cy={y}
            r={DOT_RADIUS * (1 + b * 0.6)}
            fill="#FFFFFF"
            opacity={alpha}
          />,
        );
      }
    }
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* Glowing ring strokes — the electric arcs the brightened dots ride. */}
      <g style={{ filter: "blur(2.2px)", mixBlendMode: "screen" }}>
        {RINGS.map((ring, i) => (
          <circle
            key={`s${i}`}
            cx={MARK_CX}
            cy={MARK_CY}
            r={ring.r}
            fill="none"
            stroke="#EAF2FF"
            strokeWidth={2.6}
            opacity={0.1 + ring.intensity * 0.22}
          />
        ))}
      </g>
      <g>{base}</g>
      <g style={{ filter: "drop-shadow(0 0 3px rgba(220,236,255,0.9))" }}>{boost}</g>
    </svg>
  );
};

// ─── Hand-drawn red arrow — the AntiCheatStat idiom: curved bezier body plus
// two short wing strokes for the head. On the centre axis it drops straight
// from under the question into the top of the mark — the gentle S keeps it a
// human stroke, not a ruled line.

const HandArrow: React.FC = () => (
  <svg
    width="100%"
    height="100%"
    viewBox={`0 0 ${W} ${H}`}
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      filter: "drop-shadow(0 4px 18px rgba(255,45,45,0.45))",
    }}
  >
    <path
      d="M 950 292 C 976 326 944 360 960 398"
      stroke={RED}
      strokeWidth={17}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* arrowhead — two hand-strokes opening off the tip, symmetric on the axis */}
    <path d="M 960 402 L 930 366" stroke={RED} strokeWidth={17} strokeLinecap="round" fill="none" />
    <path d="M 960 402 L 990 366" stroke={RED} strokeWidth={17} strokeLinecap="round" fill="none" />
  </svg>
);

const WHITE_GLOW =
  "drop-shadow(0 0 2px rgba(255,255,255,0.5)) drop-shadow(0 0 26px rgba(255,255,255,0.4)) drop-shadow(0 8px 30px rgba(0,0,0,0.35))";

export const AntiCheatEditThumbnail: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BLUE, overflow: "hidden" }}>
      <ElectricField />

      {/* Hot core — a soft white bloom seated under the mark so the burst has
          a centre, screen-blended like the end card's spike halo. */}
      <div
        style={{
          position: "absolute",
          left: MARK_CX,
          top: MARK_CY,
          width: 760,
          height: 760,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle at center, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0) 62%)",
          filter: "blur(26px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Vignette — edges sink toward the film's dark-navy root for depth.
          Centred on the axis so the falloff is symmetric on every side. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 82% 82% at 50% 47%, rgba(2,14,43,0) 34%, ${EDGE}cc 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Wintermute — mark and wordmark, each centred on the axis as its own
          tier, recoloured white ("our colour") via the brightness/invert filter
          so the authentic geometry is kept without editing the source SVG. */}
      <Img
        src={staticFile("anticheat-edit/wintermute-mark.svg")}
        style={{
          position: "absolute",
          left: MARK_CX,
          top: MARK_CY,
          width: 470,
          height: 470 * (24 / 33),
          transform: "translate(-50%, -50%)",
          filter: `brightness(0) invert(1) ${WHITE_GLOW}`,
          pointerEvents: "none",
        }}
      />
      <Img
        src={staticFile("anticheat-edit/wintermute-wordmark.svg")}
        style={{
          position: "absolute",
          left: MARK_CX,
          top: WORDMARK_CY,
          width: 772,
          height: 772 * (16 / 170),
          transform: "translate(-50%, -50%)",
          filter: `brightness(0) invert(1) ${WHITE_GLOW}`,
          pointerEvents: "none",
        }}
      />

      <HandArrow />

      {/* "The end?" — red marker hand, the top tier, centred on the axis. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 96,
          textAlign: "center",
          fontFamily: caveatFont,
          fontWeight: 700,
          fontSize: 200,
          lineHeight: 0.9,
          color: RED,
          textShadow: "0 6px 26px rgba(0,0,0,0.35), 0 0 30px rgba(255,45,45,0.35)",
          pointerEvents: "none",
        }}
      >
        The end?
      </div>
    </AbsoluteFill>
  );
};

export const antiCheatEditThumbnailMeta = {
  id: "AntiCheatEditThumbnail",
  component: AntiCheatEditThumbnail,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: 90,
};
