// A 4×4 print-shop grid of mini-animations. The source was a GSAP playground
// you could drag — each square swappable, each timeline running on its own
// clock, all glued together with MorphSVG, DrawSVG, SplitText and Draggable.
// Drag is dead here. The loops survive: sixteen frame-driven cells repeating
// past the heat death of the studio process, while a synthetic cursor orbits
// the center to feed the four cells that used to know where the mouse was.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { interpolatePath } from "@remotion/paths";

// ── Palette ────────────────────────────────────────────────────────────────

const COLOR_BLUE = "#154084";
const COLOR_RED = "#9d2719";
const COLOR_YELLOW = "#d7b418";
const COLOR_WHITE = "#fff3e7";
const COLOR_BLACK = "#222";

// ── Helpers ────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

/** A 0..1 saw-toothed phase, looped on a given period (in seconds). */
function loopPhase(frame: number, fps: number, periodSec: number): number {
  const t = (frame / fps) % periodSec;
  return t / periodSec;
}

/** A yo-yo phase: 0 → 1 → 0 across the period. */
function yoyoPhase(frame: number, fps: number, periodSec: number): number {
  const p = loopPhase(frame, fps, periodSec);
  return p < 0.5 ? p * 2 : (1 - p) * 2;
}

/** Frame-shifted loop phase, for staggered cell elements. */
function staggeredPhase(
  frame: number,
  fps: number,
  periodSec: number,
  delaySec: number,
): number {
  const shifted = frame - delaySec * fps;
  return loopPhase(((shifted % (periodSec * fps)) + periodSec * fps) % (periodSec * fps), fps, periodSec);
}

// ── Per-cell components ────────────────────────────────────────────────────

type CellProps = {
  bg: string;
  cursorX: number; // -1..1 (cell-local)
  cursorY: number; // -1..1
};

const CellShell: React.FC<{ bg: string; children: React.ReactNode }> = ({
  bg,
  children,
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: bg,
      position: "relative",
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

// 1, 16 — Following Eye -----------------------------------------------------

const EYE_PATH =
  "M95.86 50S75.33 79.47 50 79.47 4.14 50 4.14 50 24.67 20.53 50 20.53 95.86 50 95.86 50Z";

const FollowingEye: React.FC<CellProps & { clipId: string }> = ({
  bg,
  cursorX,
  cursorY,
  clipId,
}) => {
  // Eye drifts a touch, pupil swings further. Hard clamps keep the pupil
  // inside the lemon shape no matter how far the synthetic cursor wanders.
  const eyeDx = clamp(cursorX, -1, 1) * 6;
  const eyeDy = clamp(cursorY, -1, 1) * 4;
  const pupilDx = clamp(cursorX, -1, 1) * 18;
  const pupilDy = clamp(cursorY, -1, 1) * 12;
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        <defs>
          <clipPath id={clipId}>
            <path d={EYE_PATH} />
          </clipPath>
        </defs>
        <g transform={`translate(${eyeDx} ${eyeDy})`}>
          <path d={EYE_PATH} fill={COLOR_WHITE} />
        </g>
        <g clipPath={`url(#${clipId})`}>
          <circle
            cx={50 + pupilDx}
            cy={50 + pupilDy}
            r={20.91}
            fill={COLOR_BLACK}
          />
        </g>
      </svg>
    </CellShell>
  );
};

// 2 — Rotating Stars --------------------------------------------------------

const STAR_4 = (cx: number, cy: number) =>
  // 4-pointed sparkle, plus-arm length ≈ 18.64 from each axis.
  `M${cx + 18.64} ${cy}c-10.29 0-18.64-8.34-18.64-18.64 0 10.29-8.34 18.64-18.64 18.64 10.29 0 18.64 8.34 18.64 18.64 0-10.29 8.34-18.64 18.64-18.64Z`;

const STAR_CENTERS: [number, number][] = [
  [24, 25.48],
  [75.9, 25.48],
  [24, 74.52],
  [75.9, 74.52],
];

const RotatingStars: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        {STAR_CENTERS.map(([cx, cy], i) => {
          const delay = i * 0.4; // 0.4s stagger per star
          const cycle = 3.2;
          const phase = staggeredPhase(frame, fps, cycle, delay);
          // First 0..0.6: rotate 360°. 0.6..0.85: pulse scale to 1.5. 0.85..1: rest.
          const rot = phase < 0.6 ? (phase / 0.6) * 360 : 360;
          const pulseT = clamp((phase - 0.6) / 0.25, 0, 1);
          const scale = 1 + Math.sin(pulseT * Math.PI) * 0.5;
          return (
            <g
              key={i}
              transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${scale}) translate(${-cx} ${-cy})`}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <path d={STAR_4(cx, cy)} fill={COLOR_WHITE} />
            </g>
          );
        })}
      </svg>
    </CellShell>
  );
};

// 3 — Morphing Circles ------------------------------------------------------

const MorphingCircles: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // viewBox 100×200 displayed in a 100×100 window via overflow:hidden.
  // The whole stack translates Y by -100 (one cell) on a 1.5s loop.
  const liftPhase = loopPhase(frame, fps, 1.5);
  const lift = -liftPhase * 100;
  const rotPhase = loopPhase(frame, fps, 3);
  const rot = rotPhase * 360;
  return (
    <CellShell bg={bg}>
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 100 200"
          preserveAspectRatio="xMidYMin meet"
          style={{
            width: "100%",
            height: "200%",
            transform: `translateY(${lift}%)`,
          }}
        >
          {[0, 1, 2].map((row) => {
            const cy = 50 + row * 100;
            const flip = row % 2 === 1;
            return (
              <g
                key={row}
                style={{ transformOrigin: `50px ${cy}px` }}
                transform={`rotate(${rot} 50 ${cy})`}
              >
                <circle cx={50} cy={cy} r={50} fill={COLOR_WHITE} />
                <path
                  d={
                    flip
                      ? `M0 ${cy}c0 -27.61 22.39-50 50-50V${cy + 50}c-27.61 0-50-22.39-50-50Z`
                      : `M100 ${cy}c0 27.61-22.39 50-50 50V${cy - 50}c27.61 0 50 22.39 50 50Z`
                  }
                  fill={COLOR_BLACK}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </CellShell>
  );
};

// 4 — Half Circles ----------------------------------------------------------

const HalfCircles: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The original played a 4-step waterfall. Compress to a 4s loop.
  const phase = loopPhase(frame, fps, 4);
  // Each half: scale, x offset.
  // Phase 0..0.25: half1 shrinks. 0.25..0.5: halves 2,3,4 each shift left.
  // 0.5..0.75: half2 shrinks. 0.75..1: halves 3,4 shift left further.
  const t = phase;
  const half1Scale =
    t < 0.25 ? 1 - t / 0.25 : t < 0.5 ? 0 : t < 0.75 ? 0 : 0;
  const half2Scale = t < 0.5 ? 1 : t < 0.75 ? 1 - (t - 0.5) / 0.25 : 0;
  const half2X = t < 0.25 ? 0 : t < 0.5 ? ((t - 0.25) / 0.25) * -50 : -50;
  const half3X = t < 0.25 ? 0 : t < 0.5 ? ((t - 0.25) / 0.25) * -50 : t < 0.75 ? -50 : -50 + ((t - 0.75) / 0.25) * -50;
  const half4X = t < 0.25 ? 0 : t < 0.5 ? ((t - 0.25) / 0.25) * -50 : t < 0.75 ? -50 : -50 + ((t - 0.75) / 0.25) * -50;
  const HALF_D = "M0 50C0 22.39 22.39 0 50 0v100C22.39 100 0 77.61 0 50Z";
  return (
    <CellShell bg={bg}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <g transform="translate(0 0) scale(1)">
          <g transform={`translate(0 0) scale(${half1Scale} 1)`}>
            <path d={HALF_D} fill={COLOR_BLUE} />
          </g>
          <g transform={`translate(${50 + half2X} 0) scale(${half2Scale} 1)`}>
            <path d={HALF_D} fill={COLOR_BLUE} />
          </g>
          <g transform={`translate(${100 + half3X} 0)`}>
            <path d={HALF_D} fill={COLOR_BLUE} />
          </g>
          <g transform={`translate(${150 + half4X} 0)`}>
            <path d={HALF_D} fill={COLOR_BLUE} />
          </g>
        </g>
      </svg>
    </CellShell>
  );
};

// 5 — Following Stars -------------------------------------------------------

const STAR_5 =
  "M100 50C72.39 50 50 27.61 50 0c0 27.61-22.39 50-50 50c27.61 0 50 22.39 50 50c0-27.61 22.39-50 50-50Z";

const FollowingStars: React.FC<CellProps> = ({ bg, cursorX, cursorY }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Leader at the cursor, trail lags 4, 8, 12, 16 frames behind. The lag
  // matters less than the visible offset — synthesize trailing cursors by
  // sampling our orbit at frame - N.
  const lagFrames = [0, 6, 12, 18, 24];
  const sampled = lagFrames.map((lag) => sampleCursor(frame - lag, fps));
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        {sampled.slice(1).reverse().map((c, idx) => {
          const reverseIdx = sampled.length - 2 - idx;
          const scale = 0.35 - reverseIdx * 0.04;
          const px = 50 + c.x * 30;
          const py = 50 + c.y * 30;
          return (
            <g
              key={idx}
              transform={`translate(${px} ${py}) scale(${scale}) translate(-50 -50)`}
            >
              <path d={STAR_5} fill={COLOR_YELLOW} />
            </g>
          );
        })}
        <g
          transform={`translate(${50 + cursorX * 30} ${50 + cursorY * 30}) scale(0.45) translate(-50 -50)`}
        >
          <path d={STAR_5} fill={COLOR_WHITE} />
        </g>
        {/* Cursor not used directly here; we sampled it. The two args above
            keep TS from whining and let downstream variants override.   */}
        {cursorX === cursorX ? null : null}
      </svg>
    </CellShell>
  );
};

// 6 — Morphing Heart → Lip --------------------------------------------------

const HEART_D =
  "M50 15.05c-10.76-10.76-28.22-10.76-38.98 0C.25 25.82.25 43.27 11.02 54.04L50 93.02l38.98-38.98c10.76-10.76 10.76-28.22 0-38.98C78.22 4.3 60.76 4.3 50 15.06Z";
const LIP_D =
  "M89.74 42.61c-7-7.47-15.48-21.85-28.55-21.85-7.61 0-8.85 6.26-11.18 6.26s-3.58-6.26-11.18-6.26c-13.07 0-21.55 14.38-28.55 21.85-2.98 3.18-7.67 6.22-7.67 6.22s3.22 2.02 5.78 4.61c6.88 6.98 21.46 25.41 41.62 25.8 20.16-.39 34.75-18.82 41.62-25.8 2.56-2.6 5.78-4.61 5.78-4.61s-4.69-3.04-7.67-6.22Z";

const MorphingHeart: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = yoyoPhase(frame, fps, 2.4);
  const eased = Easing.inOut(Easing.quad)(t);
  // interpolatePath demands path strings with the same command set. Both of
  // ours come from Illustrator, so they share M/c/Z structures; if it ever
  // chokes, fall back to a crossfade between the two.
  let d: string;
  try {
    d = interpolatePath(eased, HEART_D, LIP_D);
  } catch {
    d = eased < 0.5 ? HEART_D : LIP_D;
  }
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        <path d={d} fill={COLOR_WHITE} />
      </svg>
    </CellShell>
  );
};

// 7 — Stripes (3 nested U-strokes, drawSVG yoyo) ----------------------------

const Stripes: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layers = [
    { color: COLOR_BLUE, delay: 0, radius: 28.75 },
    { color: COLOR_WHITE, delay: 0.15, radius: 21.12 },
    { color: COLOR_RED, delay: 0.3, radius: 13.49 },
  ];
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        {layers.map((layer, i) => {
          const t = staggeredPhase(frame, fps, 2.2, layer.delay);
          const yoyo = t < 0.5 ? t * 2 : (1 - t) * 2;
          const eased = Easing.inOut(Easing.cubic)(yoyo);
          const r = layer.radius;
          // Two arc strokes mirrored; each arc length ≈ 50 + arc.
          const leftD = `M${50 - r} 0v${50 - r}c0 ${r} ${r} ${r} ${r} ${r}s${r} 0 ${r}-${r}`;
          const rightD = `M${50 - r} ${50 - r}c0-${r} ${r}-${r} ${r}-${r}s${r} 0 ${r} ${r}V100`;
          const len = 100 + r * 2;
          const dashOffset = len * (1 - eased);
          return (
            <g key={i}>
              <path
                d={leftD}
                stroke={layer.color}
                strokeWidth={9}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={len}
                strokeDashoffset={dashOffset}
              />
              <path
                d={rightD}
                stroke={layer.color}
                strokeWidth={9}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={len}
                strokeDashoffset={dashOffset}
              />
            </g>
          );
        })}
      </svg>
    </CellShell>
  );
};

// 8 — Random Circles --------------------------------------------------------

const RandomCircles: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Three concentric rings, each scaling + drifting on a 2s yoyo with stagger.
  const rings = [
    { color: COLOR_WHITE, r: 50, delay: 0, seed: 1 },
    { color: COLOR_BLUE, r: 40, delay: 0.2, seed: 2 },
    { color: COLOR_RED, r: 30, delay: 0.4, seed: 3 },
  ];
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        {rings.map((ring, i) => {
          const phase = staggeredPhase(frame, fps, 2, ring.delay);
          const eased = Easing.inOut(Easing.cubic)(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
          // Deterministic pseudo-random offset per cycle.
          const cycleIndex = Math.floor(((frame - ring.delay * fps) / fps) / 2);
          const seed = ring.seed + cycleIndex * 7.31;
          const dx = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * 40 - 20;
          const dy = (Math.cos(seed * 78.233) * 43758.5453 % 1) * 40 - 20;
          const scale = 0.7 + eased * 0.3;
          return (
            <circle
              key={i}
              cx={50 + dx * eased}
              cy={50 + dy * eased}
              r={ring.r * scale}
              fill={ring.color}
            />
          );
        })}
      </svg>
    </CellShell>
  );
};

// 9 — Stretch Bars ----------------------------------------------------------

const StretchBars: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bob = Math.sin((frame / fps) * Math.PI) * 3;
  const bars = [
    { x: 18, color: COLOR_RED, dotTop: { color: COLOR_BLUE, baseY: 17 }, dotBot: { color: COLOR_YELLOW, baseY: 83 }, period: 2.4 },
    { x: 40, color: COLOR_BLUE, dotTop: { color: COLOR_YELLOW, baseY: 30 }, dotBot: { color: COLOR_BLACK, baseY: 88 }, period: 3.1 },
    { x: 62, color: COLOR_RED, dotTop: { color: COLOR_BLACK, baseY: 13 }, dotBot: { color: COLOR_BLUE, baseY: 79 }, period: 2.8 },
  ];
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        {bars.map((bar, i) => {
          const t = yoyoPhase(frame, fps, bar.period);
          const eased = Easing.inOut(Easing.cubic)(t);
          // Bar height swings 50..78; mounted from bottom of the dot stack.
          const barHeight = 50 + eased * 28;
          const barY = bar.dotTop.baseY + (1 - eased) * 6;
          const dotTopY = bar.dotTop.baseY + (1 - eased) * 4 + bob;
          const dotBotY = bar.dotBot.baseY - (1 - eased) * 4 + bob;
          return (
            <g key={i} transform={`translate(0 ${bob})`}>
              <rect x={bar.x} y={barY} width={20} height={barHeight} fill={bar.color} />
              <circle cx={bar.x + 10} cy={dotTopY} r={9} fill={bar.dotTop.color} />
              <circle cx={bar.x + 10} cy={dotBotY} r={9} fill={bar.dotBot.color} />
            </g>
          );
        })}
      </svg>
    </CellShell>
  );
};

// 10 — Rotating Disk --------------------------------------------------------

const RotatingDisk: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = loopPhase(frame, fps, 3);
  // Elastic ease-out approximated by a damped sine; the rotation lands on
  // 360° then snaps back the other way. Yoyo.
  const yoyo = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const eased = Easing.bezier(0.34, 1.56, 0.64, 1)(yoyo);
  const rot = eased * 360;
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        <g transform={`rotate(${rot} 50 50)`}>
          <path
            d="M100 50c0 27.61-22.39 50-50 50S0 77.61 0 50h100z"
            fill={COLOR_BLUE}
          />
          <circle cx={50} cy={50} r={25} fill={COLOR_BLACK} />
        </g>
      </svg>
    </CellShell>
  );
};

// 11 — Arrows (waterfall) ---------------------------------------------------

const Arrows: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = loopPhase(frame, fps, 4);
  // 4-step ballet, 1s each.
  // 0..0.25: arrow1 shrinks (origin top).
  // 0.25..0.5: arrows 2, 3 translate Y -50.
  // 0.5..0.75: arrow2 shrinks. Arrows 3, 4 translate Y -50 more.
  // 0.75..1: hold.
  const t = phase;
  const a1Scale = clamp(1 - t / 0.25, 0, 1);
  const a2Scale = t < 0.5 ? 1 : clamp(1 - (t - 0.5) / 0.25, 0, 1);
  const a2Y = t < 0.25 ? 0 : t < 0.5 ? ((t - 0.25) / 0.25) * -50 : -50;
  const a3Y = t < 0.25 ? 0 : t < 0.5 ? ((t - 0.25) / 0.25) * -50 : t < 0.75 ? -50 + ((t - 0.5) / 0.25) * -50 : -100;
  const a4Y = t < 0.5 ? 0 : t < 0.75 ? ((t - 0.5) / 0.25) * -50 : -50;
  return (
    <CellShell bg={bg}>
      <svg
        viewBox="0 0 100 200"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%" }}
      >
        <g transform={`translate(0 0) scale(1 ${a1Scale})`} style={{ transformOrigin: "50px 0px" }}>
          <path d="M50 0 0 50h100L50 0z" fill={COLOR_RED} />
        </g>
        <g transform={`translate(0 ${a2Y}) scale(1 ${a2Scale})`} style={{ transformOrigin: "50px 50px" }}>
          <path d="M50 50 0 100h100L50 50z" fill={COLOR_BLACK} />
        </g>
        <g transform={`translate(0 ${a3Y})`}>
          <path d="M50 100 0 150h100l-50-50z" fill={COLOR_RED} />
        </g>
        <g transform={`translate(0 ${a4Y})`}>
          <path d="M50 150 0 200h100l-50-50z" fill={COLOR_BLACK} />
        </g>
      </svg>
    </CellShell>
  );
};

// 12 — Line Drawing ---------------------------------------------------------

const LineDrawing: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 20 lines fanning around center. Group rotates 360° over 4s; each line's
  // dashoffset swings between fully drawn and half-drawn.
  const groupPhase = loopPhase(frame, fps, 4);
  const eased = Easing.inOut(Easing.cubic)(groupPhase);
  const rot = eased * 360;
  const N = 20;
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        <g transform={`rotate(${rot} 50 50)`}>
          {Array.from({ length: N }).map((_, i) => {
            const angle = (i * 180) / N;
            const linePhase = staggeredPhase(frame, fps, 2, i * 0.05);
            const lineYoyo = linePhase < 0.5 ? linePhase * 2 : (1 - linePhase) * 2;
            const len = 80.32;
            // drawSVG between 100% and 50% — line shows full, then collapses
            // to half-length pinned at top.
            const visible = 0.5 + lineYoyo * 0.5;
            const dashOffset = len * (1 - visible);
            return (
              <path
                key={i}
                d="M50 9.95v80.32"
                stroke={COLOR_BLUE}
                strokeWidth={1.2}
                fill="none"
                strokeDasharray={len}
                strokeDashoffset={dashOffset}
                transform={`rotate(${angle} 50 50)`}
              />
            );
          })}
        </g>
      </svg>
    </CellShell>
  );
};

// 13 — Stack Ellipses -------------------------------------------------------

const StackEllipses: React.FC<CellProps> = ({ bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const N = 10;
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        {Array.from({ length: N }).map((_, i) => {
          const t = staggeredPhase(frame, fps, 2, i * 0.08);
          const yoyo = t < 0.5 ? t * 2 : (1 - t) * 2;
          const eased = Easing.inOut(Easing.cubic)(yoyo);
          const dy = -eased * 50;
          // Front ellipses turn red as they push up.
          const fill = i === N - 1 ? COLOR_RED : COLOR_WHITE;
          return (
            <ellipse
              key={i}
              cx={50}
              cy={25 + dy}
              rx={50}
              ry={25}
              fill={fill}
              style={{ opacity: 0.85 + (i / N) * 0.15 }}
            />
          );
        })}
      </svg>
    </CellShell>
  );
};

// 14 — Balancing Balls ------------------------------------------------------

const BalancingBalls: React.FC<CellProps> = ({ bg, cursorX }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Successive trailing-cursor samples drive the smaller balls. The biggest
  // ball moves first; smaller ones lag.
  const lags = [0, 4, 8];
  const samples = lags.map((lag) => sampleCursor(frame - lag, fps));
  // Big yellow ball — leads. Mid black — lags 4f. Small white — lags 8f.
  return (
    <CellShell bg={bg}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        <circle cx={50 + samples[0].x * 35} cy={0} r={35} fill={COLOR_YELLOW} />
        <circle cx={50 + samples[1].x * 25} cy={54} r={19} fill={COLOR_BLACK} />
        <circle cx={50 + samples[2].x * 18} cy={87} r={13} fill={COLOR_WHITE} />
        {cursorX === cursorX ? null : null /* silence unused */}
      </svg>
    </CellShell>
  );
};

// ── Cursor orbit ───────────────────────────────────────────────────────────

function sampleCursor(frame: number, fps: number): { x: number; y: number } {
  // Two slow Lissajous oscillators. Output is in [-1, 1] cell-local units.
  const t = frame / fps;
  const x = Math.cos((t / 4) * TAU) * 0.85;
  const y = Math.sin((t / 5) * TAU) * 0.85;
  return { x, y };
}

// ── Cell roster ────────────────────────────────────────────────────────────

type CellDef = {
  key: string;
  bg: string;
  render: (props: CellProps) => React.ReactElement;
};

const CELLS: CellDef[] = [
  { key: "eye-1", bg: COLOR_BLUE, render: (p) => <FollowingEye {...p} clipId="eyeClip-1" /> },
  { key: "stars-rot", bg: COLOR_BLUE, render: (p) => <RotatingStars {...p} /> },
  { key: "morph-circles", bg: COLOR_BLUE, render: (p) => <MorphingCircles {...p} /> },
  { key: "half-circles-blue", bg: COLOR_BLUE, render: (p) => <HalfCircles {...p} /> },
  { key: "follow-stars", bg: COLOR_YELLOW, render: (p) => <FollowingStars {...p} /> },
  { key: "morph-heart", bg: COLOR_RED, render: (p) => <MorphingHeart {...p} /> },
  { key: "stripes-1", bg: COLOR_YELLOW, render: (p) => <Stripes {...p} /> },
  { key: "stripes-2", bg: COLOR_YELLOW, render: (p) => <Stripes {...p} /> },
  { key: "random-circles", bg: COLOR_YELLOW, render: (p) => <RandomCircles {...p} /> },
  { key: "stretch-bars", bg: COLOR_WHITE, render: (p) => <StretchBars {...p} /> },
  { key: "rotating-disk", bg: COLOR_WHITE, render: (p) => <RotatingDisk {...p} /> },
  { key: "arrows", bg: COLOR_WHITE, render: (p) => <Arrows {...p} /> },
  { key: "line-drawing", bg: COLOR_WHITE, render: (p) => <LineDrawing {...p} /> },
  { key: "stack-ellipses", bg: COLOR_YELLOW, render: (p) => <StackEllipses {...p} /> },
  { key: "balls", bg: COLOR_RED, render: (p) => <BalancingBalls {...p} /> },
  { key: "eye-2", bg: COLOR_RED, render: (p) => <FollowingEye {...p} clipId="eyeClip-2" /> },
];

// ── Title row ──────────────────────────────────────────────────────────────

const TITLE = "GSAP GRID";

const TitleRow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Per-character lift-in. Plays once at the start, stays.
  const chars = TITLE.split("");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
        marginTop: 36,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: "'Tilt Warp', 'Inter', system-ui, sans-serif",
          fontSize: 96,
          fontWeight: 700,
          color: COLOR_BLACK,
          letterSpacing: "-3px",
          lineHeight: 1,
          display: "flex",
          overflow: "hidden",
          paddingBottom: 8,
        }}
      >
        {chars.map((c, i) => {
          const delay = 6 + i * 5; // frames
          const local = clamp((frame - delay) / 24, 0, 1);
          const eased = Easing.out(Easing.cubic)(local);
          const dy = (1 - eased) * 100;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                transform: `translateY(${dy}px)`,
                opacity: eased,
                whiteSpace: "pre",
              }}
            >
              {c}
            </span>
          );
        })}
      </h1>
      <div style={{ display: "flex", gap: 12 }}>
        {[COLOR_BLUE, COLOR_RED, COLOR_YELLOW, COLOR_BLACK].map((swatch, i) => {
          const delay = 60 + i * 6;
          const local = clamp((frame - delay) / 18, 0, 1);
          const eased = Easing.out(Easing.cubic)(local);
          return (
            <div
              key={swatch}
              style={{
                width: 28,
                height: 28,
                background: swatch,
                borderRadius: 4,
                transform: `scale(${eased})`,
                opacity: eased,
              }}
            />
          );
        })}
      </div>
      {/* Silence the unused linter for fps; we intentionally don't tie title to frame rate. */}
      {fps === fps ? null : null}
    </div>
  );
};

// ── Composition ────────────────────────────────────────────────────────────

export const GsapGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cursor = sampleCursor(frame, fps);

  const GRID_SIZE = 880; // 4 × 220 cells, scaled up from 800 for visibility.
  const CELL = GRID_SIZE / 4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLOR_BLACK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: COLOR_WHITE,
          padding: 48,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderRadius: 6,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: GRID_SIZE,
            height: GRID_SIZE,
            display: "grid",
            gridTemplateColumns: `repeat(4, ${CELL}px)`,
            gridTemplateRows: `repeat(4, ${CELL}px)`,
            gap: 0,
            background: COLOR_BLACK,
          }}
        >
          {CELLS.map((cell) => (
            <div
              key={cell.key}
              style={{
                width: CELL,
                height: CELL,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {cell.render({
                bg: cell.bg,
                cursorX: cursor.x,
                cursorY: cursor.y,
              })}
            </div>
          ))}
        </div>
        <TitleRow />
      </div>
    </AbsoluteFill>
  );
};

// ── Utilities ──────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// interpolate import preserved for adjacent components that may extend cells.
// Drop the noop reference if no longer needed.
const _interpolate = interpolate;
void _interpolate;
