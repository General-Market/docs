// A dashboard assembling itself out of nothing — the kind of thing product
// pages used to ship without irony. Twelve staggered animations, six overshoot
// curves, two donut charts that pretend to mean something. The source was a
// GSAP TweenLite cascade hooked to scroll. Here the cascade runs once,
// holds, and reverses, because every interface that begins must also end.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

// ── Layout ──────────────────────────────────────────────────────────────────

const SVG_W = 500;
const SVG_H = 459.3;
const VIEW_W = 1920;
const VIEW_H = 1080;
const SCALE = Math.min(VIEW_W * 0.62 / SVG_W, VIEW_H * 0.92 / SVG_H);

// ── Palette ─────────────────────────────────────────────────────────────────

const COL_BLUE = "#5E7EBE";
const COL_CYAN = "#4DC4D0";
const COL_DARK = "#384E72";
const COL_GRAY = "#B9BCC1";
const COL_BG = "#eaecf2";

// ── Easing ──────────────────────────────────────────────────────────────────
// Back.easeOut(1.7) overshoots. The bezier (0.34, 1.56, 0.64, 1) is the
// canonical CSS analogue. Power1.easeOut is the same shape as ease-out quad.

const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);
const powerOut = Easing.bezier(0, 0, 0.42, 1);

// ── Timeline (in seconds) ──────────────────────────────────────────────────
// Total intro ≈ 5.5s, then a 1.5s hold, then a 3s reverse so the scene loops.
// Each entry: [start, duration, easing, label].

const INTRO_END = 5.5;
const HOLD_END = 7.0;
const TOTAL = 10.0; // matches 600 frames at 60fps

type TweenSpec = { start: number; dur: number; ease: (t: number) => number };

// Reverse mapping: 0..1 forward from `forwardStart`, hold, then 1..0 reverse
// over the last leg. Returns a "reveal" value in [0, 1] for a tween that runs
// over [start, start+dur].
function reveal(time: number, spec: TweenSpec): number {
  // Forward leg
  if (time < INTRO_END) {
    if (time <= spec.start) return 0;
    if (time >= spec.start + spec.dur) return 1;
    const t = (time - spec.start) / spec.dur;
    return clamp01(spec.ease(t));
  }
  // Hold: everything stays at 1.
  if (time < HOLD_END) return 1;
  // Reverse leg: everything unwinds together over (HOLD_END..TOTAL).
  const r = (time - HOLD_END) / (TOTAL - HOLD_END);
  return clamp01(spec.ease(1 - r));
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ── Element timing ──────────────────────────────────────────────────────────
// Mapped from the original GSAP cascade. "-=N" semantics resolved by hand
// into absolute seconds. Numbers chosen so the cascade lands inside INTRO_END.

const T = {
  body: { start: 0.0, dur: 0.3, ease: backOut },
  main: { start: 0.0, dur: 0.3, ease: backOut },
  // dataBlocks: stagger 0.2 starting at 0.3 (after .from body/main).
  dataBlocks: (i: number): TweenSpec => ({
    start: 0.3 + i * 0.2,
    dur: 0.3,
    ease: backOut,
  }),
  // 6 blocks → last starts 1.3 → ends 1.6. charts come next.
  charts: (i: number): TweenSpec => ({
    start: 1.6 + i * 0.2,
    dur: 0.3,
    ease: backOut,
  }),
  // lineGraphLines after charts: 2.0
  lineGraphLines: (i: number): TweenSpec => ({
    start: 2.0 + i * 0.05,
    dur: 0.75,
    ease: powerOut,
  }),
  // lineGraphAreas "-=1.5" → starts at 2.75 - 1.5 = 1.25
  lineGraphAreas: (i: number): TweenSpec => ({
    start: 1.25 + i * 0.1,
    dur: 0.75,
    ease: backOut,
  }),
  // lineGraphDots stagger 0.1, "-=1" → starts at 2.0 - 1 = 1.0
  lineGraphDots: (i: number): TweenSpec => ({
    start: 1.0 + i * 0.06,
    dur: 0.3,
    ease: backOut,
  }),
  // donutCharts stagger 0.2, "-=3.5" → starts at ~2.0 (clamped early)
  donutArcs: (i: number): TweenSpec => ({
    start: 0.4 + i * 0.18,
    dur: 0.5,
    ease: powerOut,
  }),
  // menuBackground "-=5" → starts at 0
  menuBackground: { start: 0.0, dur: 0.3, ease: backOut } as TweenSpec,
  // menuElements stagger 0.1, "-=3.25" → starts at 0.15
  menuElements: (i: number): TweenSpec => ({
    start: 0.15 + i * 0.08,
    dur: 0.3,
    ease: backOut,
  }),
  // headerBackground "-=4.5" → starts at 0.1
  headerBackground: { start: 0.1, dur: 0.5, ease: powerOut } as TweenSpec,
  headerBoxes: (i: number): TweenSpec => ({
    start: 0.3 + i * 0.1,
    dur: 0.3,
    ease: backOut,
  }),
  headerText: (i: number): TweenSpec => ({
    start: 0.5 + i * 0.2,
    dur: 0.4,
    ease: backOut,
  }),
};

// ── Data block geometry ─────────────────────────────────────────────────────

type Block = { y: number; variant: "blue" | "white" };
const DATA_BLOCKS: Block[] = [
  { y: 60, variant: "blue" },
  { y: 127, variant: "white" },
  { y: 194, variant: "white" },
  { y: 260, variant: "blue" },
  { y: 327, variant: "white" },
  { y: 394, variant: "white" },
];

// Line graph point data (verbatim from spec)
const G1_POINTS: [number, number][] = [
  [206.3, 184.3],
  [242.2, 148.5],
  [258.6, 164.9],
  [295.6, 127.9],
  [335, 167.2],
  [387.4, 114.8],
  [408.6, 135.9],
  [424.6, 119.9],
  [457.7, 153],
  [479.7, 131],
];
const G2_POINTS: [number, number][] = [
  [206.3, 232.7],
  [228.3, 210.7],
  [235.5, 217.8],
  [294.9, 158.4],
  [311.6, 175.1],
  [348, 138.7],
  [380.3, 138.7],
  [417.8, 101.2],
  [443.7, 127],
  [478.7, 92],
];

function polylineLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

function polylineD(pts: [number, number][]): string {
  return pts
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");
}

// Polygon (area-under-curve) — extend the polyline down to a baseline y.
function areaPolygon(pts: [number, number][], baselineY: number): string {
  const a = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${a} ${last[0]},${baselineY} ${first[0]},${baselineY}`;
}

// Menu bar widths
const MENU_BAR_WIDTHS = [36.9, 60.8, 41.5, 46.8, 30.4, 49.5, 36.9, 54.0, 46.8];
const MENU_BAR_YS = [37.7, 57.7, 77.7, 97.7, 117.7, 137.7, 157.7, 177.7, 197.7];

// Donut geometry
const DONUT_R = 54.7;
const DONUT_CIRC = 2 * Math.PI * DONUT_R; // ≈ 343.6

// ── Helper: render a data block ────────────────────────────────────────────

const DataBlock: React.FC<{ block: Block; index: number; time: number }> = ({
  block,
  index,
  time,
}) => {
  const r = reveal(time, T.dataBlocks(index));
  // y: 100 → 0, scale: 0 → 1
  const ty = (1 - r) * 100;
  const sc = r;

  const blockCx = 90.3 + 95.3 / 2;
  const blockCy = block.y + 53.3 / 2;

  if (block.variant === "blue") {
    return (
      <g
        transform={`translate(${blockCx} ${blockCy}) scale(${sc}) translate(${-blockCx} ${
          -blockCy + ty
        })`}
        style={{ opacity: r }}
      >
        <rect
          fill={COL_BLUE}
          x={90.3}
          y={block.y}
          width={95.3}
          height={53.3}
        />
        <rect
          x={97.3}
          y={block.y + 6.3}
          fill="#fff"
          fillOpacity={0.5}
          width={27.1}
          height={5.2}
        />
        <rect
          x={97.3}
          y={block.y + 20}
          fill="#fff"
          fillOpacity={0.5}
          width={44.7}
          height={10.3}
        />
        <rect
          x={97.3}
          y={block.y + 38.7}
          fill="#fff"
          fillOpacity={0.5}
          width={69.6}
          height={3}
        />
        <rect
          x={97.3}
          y={block.y + 44.7}
          fill="#fff"
          fillOpacity={0.5}
          width={23.3}
          height={3}
        />
      </g>
    );
  }
  // White variant
  return (
    <g
      transform={`translate(${blockCx} ${blockCy}) scale(${sc}) translate(${-blockCx} ${
        -blockCy + ty
      })`}
      style={{ opacity: r }}
    >
      <rect fill="#fff" x={90.3} y={block.y} width={95.3} height={53.3} />
      <rect fill={COL_BLUE} x={90.3} y={block.y} width={2.2} height={53.3} />
      <rect
        x={97.3}
        y={block.y + 6.3}
        fill={COL_GRAY}
        fillOpacity={0.5}
        width={27.1}
        height={5.2}
      />
      <rect
        x={97.3}
        y={block.y + 20}
        fill={COL_GRAY}
        fillOpacity={0.5}
        width={44.7}
        height={10.3}
      />
      <rect
        x={97.3}
        y={block.y + 38.7}
        fill={COL_GRAY}
        fillOpacity={0.5}
        width={69.6}
        height={3}
      />
      <rect
        x={97.3}
        y={block.y + 44.7}
        fill={COL_GRAY}
        fillOpacity={0.5}
        width={23.3}
        height={3}
      />
    </g>
  );
};

// ── Helper: donut arc ──────────────────────────────────────────────────────

const DonutArc: React.FC<{
  cx: number;
  cy: number;
  color: string;
  fraction: number;
  rotation: number;
  index: number;
  time: number;
}> = ({ cx, cy, color, fraction, rotation, index, time }) => {
  const r = reveal(time, T.donutArcs(index));
  const arcLen = DONUT_CIRC * fraction;
  const dashLen = DONUT_CIRC;
  // Use dash array to show only `arcLen` worth and draw it via dashoffset.
  const visible = arcLen * r;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={DONUT_R}
      fill="none"
      stroke={color}
      strokeWidth={18}
      strokeDasharray={`${visible} ${dashLen}`}
      transform={`rotate(${rotation - 90} ${cx} ${cy})`}
      strokeLinecap="butt"
    />
  );
};

// ── Main component ────────────────────────────────────────────────────────

export const DashboardReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  // Pre-compute path lengths for the line draws.
  const g1Len = polylineLength(G1_POINTS);
  const g2Len = polylineLength(G2_POINTS);

  const bodyR = reveal(time, T.body);
  const mainR = reveal(time, T.main);
  const menuBgR = reveal(time, T.menuBackground);
  const headerBgR = reveal(time, T.headerBackground);

  const lineLine1R = reveal(time, T.lineGraphLines(0));
  const lineLine2R = reveal(time, T.lineGraphLines(1));
  const lineArea1R = reveal(time, T.lineGraphAreas(0));
  const lineArea2R = reveal(time, T.lineGraphAreas(1));

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, #1f2a44 0%, #0e1422 70%, #0a0f1a 100%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: SVG_W * SCALE,
          height: SVG_H * SCALE,
          transform: `scale(${SCALE / SCALE})`,
          filter:
            "drop-shadow(0 30px 60px rgba(0,0,0,0.45)) drop-shadow(0 10px 20px rgba(0,0,0,0.3))",
        }}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Body — white backdrop, scaleY from top-left */}
          <g
            style={{
              transform: `scaleY(${bodyR})`,
              transformOrigin: "0px 0px",
              transformBox: "fill-box",
            }}
          >
            <rect x={0} y={0} fill="white" width={SVG_W} height={SVG_H} />
          </g>

          {/* Main gray area — scaleY from bottom-right */}
          <g
            style={{
              transform: `scaleY(${mainR})`,
              transformOrigin: "100% 100%",
              transformBox: "fill-box",
            }}
          >
            <rect
              x={82.7}
              y={50.5}
              fill={COL_BG}
              width={417.3}
              height={408.8}
            />
          </g>

          {/* Data blocks */}
          {DATA_BLOCKS.map((b, i) => (
            <DataBlock key={i} block={b} index={i} time={time} />
          ))}

          {/* Top-right chart background (line graphs) */}
          <g
            style={{
              transform: `scaleY(${reveal(time, T.charts(0))})`,
              transformOrigin: `${197.3 + 290.7}px ${59.4 + 187.5}px`,
              transformBox: "view-box",
            }}
          >
            <rect
              x={197.3}
              y={59.4}
              fill="white"
              width={290.7}
              height={187.5}
            />

            {/* Area 1 (blue) */}
            <polygon
              points={areaPolygon(G1_POINTS, 246.9)}
              fill={COL_BLUE}
              fillOpacity={0.1 * lineArea1R}
            />
            {/* Area 2 (cyan) */}
            <polygon
              points={areaPolygon(G2_POINTS, 246.9)}
              fill={COL_CYAN}
              fillOpacity={0.1 * lineArea2R}
            />
            {/* Line 1 stroke */}
            <path
              d={polylineD(G1_POINTS)}
              fill="none"
              stroke={COL_BLUE}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={g1Len}
              strokeDashoffset={g1Len * (1 - lineLine1R)}
            />
            {/* Line 2 stroke */}
            <path
              d={polylineD(G2_POINTS)}
              fill="none"
              stroke={COL_CYAN}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={g2Len}
              strokeDashoffset={g2Len * (1 - lineLine2R)}
            />

            {/* Dots */}
            {G1_POINTS.map(([x, y], i) => {
              const r = reveal(time, T.lineGraphDots(i));
              return (
                <circle
                  key={`g1-${i}`}
                  cx={x}
                  cy={y}
                  r={2.7 * r}
                  fill="white"
                  stroke={COL_BLUE}
                  strokeWidth={1.2}
                />
              );
            })}
            {G2_POINTS.map(([x, y], i) => {
              const r = reveal(time, T.lineGraphDots(i + 9));
              return (
                <circle
                  key={`g2-${i}`}
                  cx={x}
                  cy={y}
                  r={2.7 * r}
                  fill="white"
                  stroke={COL_CYAN}
                  strokeWidth={1.2}
                />
              );
            })}
          </g>

          {/* Bottom-right chart (donuts) */}
          <g
            style={{
              transform: `scaleY(${reveal(time, T.charts(1))})`,
              transformOrigin: `${197.3 + 290.7}px ${259.4 + 187.5}px`,
              transformBox: "view-box",
            }}
          >
            <rect
              x={197.3}
              y={259.4}
              fill="white"
              width={290.7}
              height={187.5}
            />

            {/* Left donut */}
            <DonutArc
              cx={273.3}
              cy={355.3}
              color={COL_DARK}
              fraction={1.0}
              rotation={0}
              index={0}
              time={time}
            />
            <DonutArc
              cx={273.3}
              cy={355.3}
              color={COL_CYAN}
              fraction={0.5}
              rotation={0}
              index={1}
              time={time}
            />
            <DonutArc
              cx={273.3}
              cy={355.3}
              color={COL_BLUE}
              fraction={0.22}
              rotation={0}
              index={2}
              time={time}
            />

            {/* Right donut */}
            <DonutArc
              cx={411.3}
              cy={355.3}
              color={COL_BLUE}
              fraction={1.0}
              rotation={0}
              index={3}
              time={time}
            />
            <DonutArc
              cx={411.3}
              cy={355.3}
              color={COL_CYAN}
              fraction={0.5}
              rotation={0}
              index={4}
              time={time}
            />
            <DonutArc
              cx={411.3}
              cy={355.3}
              color={COL_DARK}
              fraction={0.18}
              rotation={0}
              index={5}
              time={time}
            />
          </g>

          {/* Header */}
          <g>
            {/* Background bar */}
            <g
              style={{
                transform: `scaleX(${headerBgR})`,
                transformOrigin: `${82.7 + 417.3}px ${26 + 24.5}px`,
                transformBox: "view-box",
              }}
            >
              <rect
                x={82.7}
                y={26}
                fill={COL_CYAN}
                width={417.3}
                height={24.5}
              />
            </g>
            {/* Title bar inside header */}
            {[
              { x: 97.3, y: 36, w: 81.8, h: 5.2, color: "#fff", opacity: 0.5 },
            ].map((bar, i) => {
              const r = reveal(time, T.headerText(i));
              return (
                <g
                  key={i}
                  style={{
                    transform: `scaleX(${r})`,
                    transformOrigin: `${bar.x}px ${bar.y + bar.h / 2}px`,
                    transformBox: "view-box",
                  }}
                >
                  <rect
                    x={bar.x}
                    y={bar.y}
                    width={bar.w}
                    height={bar.h}
                    fill={bar.color}
                    fillOpacity={bar.opacity}
                  />
                </g>
              );
            })}
            {/* Header boxes (right side) */}
            {[
              { x: 369.5, y: 32, w: 54.5, h: 11.5 },
              { x: 433.5, y: 32, w: 54.5, h: 11.5 },
            ].map((box, i) => {
              const r = reveal(time, T.headerBoxes(i));
              const cx = box.x + box.w / 2;
              const cy = box.y + box.h / 2;
              return (
                <g
                  key={i}
                  transform={`translate(${cx} ${cy}) scale(${r}) translate(${-cx} ${-cy})`}
                >
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    fill="white"
                  />
                </g>
              );
            })}
          </g>

          {/* Menu (left strip) */}
          <g>
            {/* Menu background */}
            <g
              style={{
                transform: `scaleX(${menuBgR})`,
                transformOrigin: "0px 0px",
                transformBox: "view-box",
              }}
            >
              <rect
                x={0}
                y={0}
                fill={COL_DARK}
                width={82.7}
                height={SVG_H}
              />
            </g>
            {/* Menu heading bar */}
            {(() => {
              const r = reveal(time, T.menuElements(0));
              return (
                <g
                  style={{
                    transform: `scaleX(${r})`,
                    transformOrigin: "9.3px 13.2px",
                    transformBox: "view-box",
                  }}
                >
                  <rect
                    x={9.3}
                    y={9.1}
                    width={60.2}
                    height={8.2}
                    fill="#fff"
                    fillOpacity={0.5}
                  />
                </g>
              );
            })()}
            {/* Menu bars */}
            {MENU_BAR_YS.map((y, i) => {
              const r = reveal(time, T.menuElements(i + 1));
              return (
                <g
                  key={i}
                  style={{
                    transform: `scaleX(${r})`,
                    transformOrigin: `9.3px ${y + 1.5}px`,
                    transformBox: "view-box",
                  }}
                >
                  <rect
                    x={9.3}
                    y={y}
                    width={MENU_BAR_WIDTHS[i]}
                    height={3}
                    fill="#fff"
                    fillOpacity={0.5}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
