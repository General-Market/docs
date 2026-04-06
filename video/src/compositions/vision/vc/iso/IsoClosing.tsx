/**
 * IsoClosingFrame — Isometric architectural frame for the closing section.
 *
 * Dark isometric blocks arranged symmetrically around a cleared center stage.
 * The text floats inside a minimal geometric cityscape: side columns,
 * a bottom platform, a top V-arch, gold accent cubes, and a faint floor grid.
 *
 * Renders as AbsoluteFill with pointerEvents:"none" — purely decorative.
 */
import React from "react";
import { AbsoluteFill } from "remotion";

/* ── Dark palette ─────────────────────────────────────────────── */
const C = {
  faceTop: "#1f1f24",
  faceLeft: "#141417",
  faceRight: "#1a1a1e",
  stroke: "#2a2a30",
  goldTop: "#c8a24e",
  goldLeft: "#9e7d3a",
  goldRight: "#b4912e",
  grid: "rgba(255,255,255,0.016)",
};

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

/* ── Isometric box (dark variant of Long03 math) ─────────────── */
const IsoBox: React.FC<{
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  topColor?: string;
  leftColor?: string;
  rightColor?: string;
  bobPhase?: number;
  bobAmp?: number;
  t?: number;
  opacity?: number;
}> = ({
  x,
  y,
  w,
  d,
  h,
  topColor = C.faceTop,
  leftColor = C.faceLeft,
  rightColor = C.faceRight,
  bobPhase = 0,
  bobAmp = 0,
  t = 0,
  opacity = 1,
}) => {
  const bob = bobAmp * Math.sin(t * Math.PI * 2 + bobPhase);
  const ay = y + bob;

  const wx = w * COS30;
  const wy = w * SIN30;
  const dx = d * COS30;
  const dy = d * SIN30;

  const topPath = `M ${x},${ay - h} L ${x + wx},${ay - h - wy} L ${x + wx - dx},${ay - h - wy - dy} L ${x - dx},${ay - h - dy} Z`;
  const leftPath = `M ${x},${ay} L ${x},${ay - h} L ${x - dx},${ay - h - dy} L ${x - dx},${ay - dy} Z`;
  const rightPath = `M ${x},${ay} L ${x + wx},${ay - wy} L ${x + wx},${ay - wy - h} L ${x},${ay - h} Z`;

  return (
    <g opacity={opacity}>
      <path d={leftPath} fill={leftColor} stroke={C.stroke} strokeWidth={1} />
      <path
        d={rightPath}
        fill={rightColor}
        stroke={C.stroke}
        strokeWidth={1}
      />
      <path d={topPath} fill={topColor} stroke={C.stroke} strokeWidth={1} />
    </g>
  );
};

/* ── Gold accent cube ─────────────────────────────────────────── */
const GoldCube: React.FC<{
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  bobPhase?: number;
  bobAmp?: number;
  t?: number;
  opacity?: number;
}> = (props) => (
  <IsoBox
    {...props}
    topColor={C.goldTop}
    leftColor={C.goldLeft}
    rightColor={C.goldRight}
  />
);

/* ── Faint isometric floor grid ───────────────────────────────── */
const FloorGrid: React.FC<{ baseY: number }> = ({ baseY }) => {
  const lines: React.ReactElement[] = [];
  const step = 60;
  const span = 900;

  // Lines going lower-left to upper-right
  for (let i = -8; i <= 8; i++) {
    const cx = 960 + i * step;
    lines.push(
      <line
        key={`a${i}`}
        x1={cx - span * COS30}
        y1={baseY + span * SIN30}
        x2={cx + span * COS30}
        y2={baseY - span * SIN30}
        stroke={C.grid}
        strokeWidth={1}
      />,
    );
  }
  // Lines going lower-right to upper-left
  for (let i = -8; i <= 8; i++) {
    const cx = 960 + i * step;
    lines.push(
      <line
        key={`b${i}`}
        x1={cx + span * COS30}
        y1={baseY + span * SIN30}
        x2={cx - span * COS30}
        y2={baseY - span * SIN30}
        stroke={C.grid}
        strokeWidth={1}
      />,
    );
  }

  return <g>{lines}</g>;
};

/* ── Block definitions ────────────────────────────────────────── */
interface BlockDef {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  phase: number;
  gold?: boolean;
  /** Stagger index for entrance fade (0 = first to appear) */
  stagger: number;
}

// Left column — 4 stacked blocks at ~x:200
const leftColumn: BlockDef[] = [
  { x: 180, y: 320, w: 70, d: 55, h: 120, phase: 0, stagger: 0 },
  { x: 195, y: 430, w: 60, d: 50, h: 80, phase: 0.6, stagger: 1 },
  { x: 170, y: 530, w: 75, d: 60, h: 100, phase: 1.2, stagger: 2 },
  { x: 185, y: 640, w: 65, d: 50, h: 90, phase: 1.8, stagger: 3 },
];

// Right column — mirror at ~x:1720
const rightColumn: BlockDef[] = [
  { x: 1720, y: 320, w: 70, d: 55, h: 120, phase: 0.3, stagger: 0 },
  { x: 1705, y: 430, w: 60, d: 50, h: 80, phase: 0.9, stagger: 1 },
  { x: 1730, y: 530, w: 75, d: 60, h: 100, phase: 1.5, stagger: 2 },
  { x: 1715, y: 640, w: 65, d: 50, h: 90, phase: 2.1, stagger: 3 },
];

// Bottom platform — 3 flat bars below center text
const bottomPlatform: BlockDef[] = [
  { x: 820, y: 720, w: 140, d: 40, h: 18, phase: 0.4, stagger: 4 },
  { x: 960, y: 735, w: 160, d: 45, h: 22, phase: 0.8, stagger: 5 },
  { x: 1100, y: 720, w: 140, d: 40, h: 18, phase: 1.2, stagger: 4 },
];

// Top V-arch — 2 blocks forming a chevron above text
const topArch: BlockDef[] = [
  { x: 780, y: 340, w: 100, d: 80, h: 130, phase: 0.2, stagger: 2 },
  { x: 1100, y: 340, w: 100, d: 80, h: 130, phase: 0.7, stagger: 2 },
];

// Gold accent cubes — scattered at key intersections
const goldAccents: BlockDef[] = [
  { x: 230, y: 360, w: 22, d: 18, h: 22, phase: 0.5, gold: true, stagger: 5 },
  { x: 1770, y: 360, w: 22, d: 18, h: 22, phase: 1.1, gold: true, stagger: 5 },
  { x: 760, y: 370, w: 18, d: 15, h: 18, phase: 1.6, gold: true, stagger: 6 },
  { x: 1150, y: 370, w: 18, d: 15, h: 18, phase: 2.2, gold: true, stagger: 6 },
  { x: 880, y: 750, w: 20, d: 16, h: 20, phase: 0.9, gold: true, stagger: 7 },
  { x: 1060, y: 750, w: 20, d: 16, h: 20, phase: 1.4, gold: true, stagger: 7 },
];

const ALL_BLOCKS: BlockDef[] = [
  ...leftColumn,
  ...rightColumn,
  ...bottomPlatform,
  ...topArch,
  ...goldAccents,
];

/* ── Main component ───────────────────────────────────────────── */
export interface IsoClosingFrameProps {
  frame: number;
  fps: number;
}

export const IsoClosingFrame: React.FC<IsoClosingFrameProps> = ({
  frame,
  fps,
}) => {
  // Bobbing cycle — 3.5 second period
  const bobT = frame / fps / 3.5;
  const bobAmp = 7;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        viewBox="0 0 1920 1080"
        width="100%"
        height="100%"
        style={{ display: "block" }}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Floor grid — very faint isometric lines */}
        <FloorGrid baseY={760} />

        {/* All blocks with staggered entrance fade + bobbing */}
        {ALL_BLOCKS.map((b, i) => {
          // Entrance: fade from 0 over 20 frames, staggered by stagger index (3 frames apart)
          const entranceStart = b.stagger * 3;
          const rawOpacity = Math.min(
            1,
            Math.max(0, (frame - entranceStart) / 20),
          );

          if (rawOpacity <= 0) return null;

          const BoxComponent = b.gold ? GoldCube : IsoBox;

          return (
            <BoxComponent
              key={i}
              x={b.x}
              y={b.y}
              w={b.w}
              d={b.d}
              h={b.h}
              bobPhase={b.phase}
              bobAmp={bobAmp}
              t={bobT}
              opacity={rawOpacity}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
