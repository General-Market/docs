// Faithful port of the original "PsychoPixels" SVG animation:
// four corner pixel-art frames (12x12 cells each) around a central cross
// of open gradient, framed by a 1px white outer rectangle. Twenty dashed
// grey strokes draw in sequence to form a spiraling sigil, finishing on
// a big white spiral sweep.

import React from "react";
import {
  AbsoluteFill,
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Stroke = {
  d: string;
  len: number;
  width: number;
  startPct: number;
  endPct: number;
};

// The grey strokes, in draw order. Coordinates are in the inner SVG user space
// before the per-stroke matrix transform is applied. Approximate routes match
// the original transform matrices.
const STROKES: Stroke[] = [
  // 01 — outer rectangle (17,13) -> (561,567)
  { d: "M 17 13 H 561 V 567 H 17 Z", len: 2197, width: 1.97, startPct: 0.0, endPct: 0.05 },
  // 02a/02b — twin short diagonals near (361.5, 461.6)
  { d: "M 355 455 L 368 468 M 355 468 L 368 455", len: 28, width: 1.5, startPct: 0.05, endPct: 0.0625 },
  // 03 — diagonal (289,567) -> (561,12)
  { d: "M 289 567 L 561 12", len: 619, width: 1.78, startPct: 0.075, endPct: 0.1 },
  // 04 — quarter-arc starting (640,592) sweeping 90° clockwise to ~(405,979)
  { d: "M 640 592 A 304 304 0 0 1 405 979", len: 477, width: 1.65, startPct: 0.1125, endPct: 0.1375 },
  // 05 — horizontal (561,567) -> (897,567)
  { d: "M 561 567 H 897", len: 337, width: 1.6, startPct: 0.15, endPct: 0.175 },
  // 06a — vertical (561,567) -> (561,231)
  { d: "M 561 567 V 231", len: 337, width: 1.6, startPct: 0.175, endPct: 0.2 },
  // 06b — horizontal (108,215) -> (444,215)
  { d: "M 108 215 H 444", len: 337, width: 1.6, startPct: 0.15, endPct: 0.175 },
  // 07 — quarter arc (897,567) -> (561,231)
  { d: "M 897 567 A 336 336 0 0 0 561 231", len: 528, width: 1.55, startPct: 0.2125, endPct: 0.2375 },
  // 08 — horizontal (562,355) -> (898,355)
  { d: "M 562 355 H 898", len: 337, width: 1.5, startPct: 0.25, endPct: 0.275 },
  // 09 — quarter arc
  { d: "M 562 355 A 208 208 0 0 1 770 563", len: 326, width: 1.5, startPct: 0.2875, endPct: 0.3125 },
  // 10 — vertical (691,355) -> (691,563)
  { d: "M 691 355 V 563", len: 208, width: 1.48, startPct: 0.325, endPct: 0.35 },
  // 11 — quarter arc
  { d: "M 562 355 A 129 129 0 0 1 691 484", len: 202, width: 1.46, startPct: 0.3625, endPct: 0.3875 },
  // 12 — horizontal (691,435) -> (562,435)
  { d: "M 691 435 H 562", len: 129, width: 1.45, startPct: 0.4, endPct: 0.425 },
  // 13 — quarter arc
  { d: "M 562 434 A 80 80 0 0 1 642 354", len: 125, width: 1.44, startPct: 0.4375, endPct: 0.4625 },
  // 14 — vertical (642,434) -> (642,355)
  { d: "M 642 434 V 355", len: 80, width: 1.43, startPct: 0.475, endPct: 0.5 },
  // 15 — quarter arc
  { d: "M 642 434 A 50 50 0 0 1 692 384", len: 78, width: 1.42, startPct: 0.5125, endPct: 0.5375 },
  // 16 — horizontal (642,404) -> (691,404)
  { d: "M 642 404 H 691", len: 50, width: 1.41, startPct: 0.55, endPct: 0.575 },
  // 17 — small arc
  { d: "M 691 404 A 30 30 0 0 0 661 434", len: 48, width: 1.4, startPct: 0.5875, endPct: 0.6125 },
  // 18 — vertical (661,404) -> (661,434)
  { d: "M 661 404 V 434", len: 31, width: 1.4, startPct: 0.625, endPct: 0.65 },
  // 19 — tiny arc
  { d: "M 661 434 A 19 19 0 0 0 642 415", len: 30, width: 1.39, startPct: 0.6625, endPct: 0.6875 },
  // 20 — tiny horizontal (661,415) -> (642,415)
  { d: "M 661 415 H 642", len: 19, width: 1.37, startPct: 0.7, endPct: 0.725 },
];

// The final big white spiral that sweeps over the entire glyph.
const FINAL_SPIRAL_D =
  "M 18.898 563.15 c 0 -298.294 245.545 -543.752 543.943 -543.752 c 184.426 0 336.186 151.706 336.186 336.068 l 0.001 0.001 c 0 113.931 -93.784 207.682 -207.756 207.682 c -70.455 0 -128.431 -57.956 -128.431 -128.386 l 0.001 0.001 c 0 -43.501 35.808 -79.297 79.324 -79.297 c 26.938 0 49.105 22.159 49.105 49.088 l 0.001 -0.001 c 0 16.572 -13.641 30.208 -30.219 30.208 v 0.001 c -10.361 0 -18.887 -8.523 -18.887 -18.88 h 0.001 c 0 -6.214 5.115 -11.327 11.331 -11.327";
const FINAL_LEN = 2205;
const FINAL_START_PCT = 0.7375;
const FINAL_END_PCT = 0.85;

// Per-stroke transform (matches all 20 strokes in the original).
const STROKE_TRANSFORM =
  "matrix(0.762635, 0, 0, 0.764038, 108.712, 70.8745)";
// Final-spiral transform.
const FINAL_TRANSFORM =
  "matrix(0.762638, 0, 0, 0.778002, 107.404, 66.0288)";

// Easing used by the original SMIL <animate keySplines>.
const easeBezier = Easing.bezier(0.5, 0, 0.5, 1);

const segmentProgress = (t: number, start: number, end: number) => {
  if (end <= start) return t >= end ? 1 : 0;
  const raw = (t - start) / (end - start);
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return easeBezier(raw);
};

// The original SVG sits in a 500x500 user space, then the outer matrix
// scales/translates it into the 915x580 viewBox.
const GRID_TRANSFORM =
  "matrix(1.86677, 0, 0, 1.90283, -7.96795, -211.73)";
const PIXEL_BLUE = "rgb(40,97,148)";

// Four quadrant frames in the 500x500 user space. Each 166.5x166.5 region
// in a corner, leaving a central cross of open gradient.
const QUADRANTS: Array<{ x: number; y: number }> = [
  { x: 0.124, y: 0.876 },     // top-left
  { x: 333.625, y: 0.876 },   // top-right
  { x: 0.124, y: 334.376 },   // bottom-left
  { x: 333.625, y: 334.376 }, // bottom-right
];
const QUADRANT_SIZE = 166.501; // 166.625 - 0.124, etc.
const CELLS = 12;
// Geometry per the source: 12 cells with ~0.42 unit gaps. Cell stride
// is QUADRANT_SIZE / 12 and each cell is slightly smaller than the stride.
const CELL_GAP = 0.42;
const CELL_STRIDE = QUADRANT_SIZE / CELLS; // ~13.875
const CELL_SIZE = CELL_STRIDE - CELL_GAP;   // ~13.455

const PixelGrid: React.FC = () => {
  const cellAxis = Array.from({ length: CELLS });
  return (
    <g transform={GRID_TRANSFORM}>
      {/* Background radial gradient fills the whole 500x500 plane */}
      <rect x={0} y={0} width={501} height={501} fill="url(#_Radial2)" />

      {/* Four corner quadrant frames in solid PIXEL_BLUE, then each
          quadrant gets a 12x12 grid of small gradient-filled cells.
          The PIXEL_BLUE that survives between cells reads as thin
          dark-blue grid lines. */}
      {QUADRANTS.map((q, qi) => (
        <g key={`q${qi}`}>
          <rect
            x={q.x}
            y={q.y}
            width={QUADRANT_SIZE}
            height={QUADRANT_SIZE}
            fill={PIXEL_BLUE}
          />
          {cellAxis.map((_, col) =>
            cellAxis.map((__, row) => {
              const cx = q.x + CELL_GAP + col * CELL_STRIDE;
              const cy = q.y + CELL_GAP + row * CELL_STRIDE;
              return (
                <rect
                  key={`c${col}-${row}`}
                  x={cx}
                  y={cy}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill="url(#_Radial2)"
                />
              );
            })
          )}
        </g>
      ))}

      {/* 1px white outer frame around the full 500x500 region. The source
          uses an even-odd punch path; a hairline rect reads the same. */}
      <rect
        x={0.124}
        y={0.876}
        width={500.001}
        height={500}
        fill="none"
        stroke="white"
        strokeWidth={0.25}
      />
    </g>
  );
};

export const PsychoPixels: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sceneT = frame / Math.max(1, durationInFrames);

  const finalProgress = segmentProgress(sceneT, FINAL_START_PCT, FINAL_END_PCT);
  const finalDashOffset = FINAL_LEN * (1 - finalProgress);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <svg
        viewBox="0 0 915 580"
        style={{ width: "100%", height: "100%", display: "block" }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Matches the source: userSpaceOnUse, center (250.125, 250.876)
              in the 500x500 plane, radius 297.827. Referenced from inside
              the GRID_TRANSFORM group so the userSpace is that plane. */}
          <radialGradient
            id="_Radial2"
            cx={0}
            cy={0}
            r={1}
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(297.827, 0, 0, 297.827, 250.125, 250.876)"
          >
            <stop offset="0" stopColor="rgb(28,77,128)" />
            <stop offset="1" stopColor="rgb(0,35,82)" />
          </radialGradient>
        </defs>

        {/* Solid page-blue underneath in case the gradient region doesn't
            cover the full 915x580 viewBox after the matrix transform. */}
        <rect x={0} y={0} width={915} height={580} fill={PIXEL_BLUE} />

        {/* Layer 1 — gradient + 4 corner pixel-art frames + white border */}
        <PixelGrid />

        {/* Layer 2 — twenty dashed grey strokes drawn in sequence */}
        <g style={{ clipRule: "evenodd" }}>
          {STROKES.map((s, i) => {
            const p = segmentProgress(sceneT, s.startPct, s.endPct);
            const dashOffset = s.len * (1 - p);
            return (
              <path
                key={i}
                d={s.d}
                fill="none"
                stroke="#e1e1e1"
                strokeWidth={s.width}
                strokeDasharray={s.len}
                strokeDashoffset={dashOffset}
                strokeLinecap="square"
                strokeLinejoin="miter"
                strokeMiterlimit={1.5}
                transform={STROKE_TRANSFORM}
              />
            );
          })}

          {/* Layer 3 — final white spiral sweep */}
          <path
            d={FINAL_SPIRAL_D}
            fill="none"
            stroke="#ffffff"
            strokeWidth={7}
            strokeDasharray={FINAL_LEN}
            strokeDashoffset={finalDashOffset}
            strokeLinecap="round"
            strokeLinejoin="miter"
            strokeMiterlimit={1.5}
            transform={FINAL_TRANSFORM}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
