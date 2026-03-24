/**
 * IsometricBackground — Animated isometric 3D geometric illustration
 * matching the Veda/Plasma "How DeFi Vaults Work" intro.
 *
 * Layout (from reference):
 * - 4 large vaults at left/right sides (~10%/90% x, ~28%/70% y)
 * - Large architectural blocks forming a symmetric frame
 * - V-shaped blocks at top center
 * - 2 yellow flat bars at bottom center
 * - Clear hexagonal opening in center for title text
 *
 * ANIMATED elements:
 * - Vault cross handles rotate continuously
 * - Blocks gently bob/float with staggered sine waves
 */
import React from "react";

// Colors from reference
const C = {
  bg: "#f0ede5",
  blockTop: "#f2efea",
  blockLeft: "#e0ddd5",
  blockRight: "#eae7e0",
  stroke: "#c8c3b8",
  yellow: "#e8d44d",
  yellowSide: "#d6c344",
  yellowDark: "#c4b23c",
  vaultBg: "#4a4a4a",
  vaultMid: "#3a3a3a",
  vaultDeep: "#2a2a2a",
  crossBar: "#333",
  cubeTop: "#f5f5f5",
  cubeLeft: "#d8d8d8",
  cubeRight: "#bbb",
};

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

/** Isometric box with bobbing animation */
const IsoBox: React.FC<{
  x: number; y: number;
  w: number; d: number; h: number;
  topColor?: string;
  leftColor?: string;
  rightColor?: string;
  bobPhase?: number;
  bobAmp?: number;
  t?: number;
}> = ({
  x, y, w, d, h,
  topColor = C.blockTop,
  leftColor = C.blockLeft,
  rightColor = C.blockRight,
  bobPhase = 0,
  bobAmp = 0,
  t = 0,
}) => {
  const bob = bobAmp * Math.sin((t * Math.PI * 2) + bobPhase);
  const ay = y + bob;

  const wx = w * COS30;
  const wy = w * SIN30;
  const dx = d * COS30;
  const dy = d * SIN30;

  const topPath = `M ${x},${ay - h} L ${x + wx},${ay - h - wy} L ${x + wx - dx},${ay - h - wy - dy} L ${x - dx},${ay - h - dy} Z`;
  const leftPath = `M ${x},${ay} L ${x},${ay - h} L ${x - dx},${ay - h - dy} L ${x - dx},${ay - dy} Z`;
  const rightPath = `M ${x},${ay} L ${x + wx},${ay - wy} L ${x + wx},${ay - wy - h} L ${x},${ay - h} Z`;

  return (
    <g>
      <path d={leftPath} fill={leftColor} stroke={C.stroke} strokeWidth={1.5} />
      <path d={rightPath} fill={rightColor} stroke={C.stroke} strokeWidth={1.5} />
      <path d={topPath} fill={topColor} stroke={C.stroke} strokeWidth={1.5} />
    </g>
  );
};

/** Yellow accent box */
const YellowBox: React.FC<{
  x: number; y: number; w: number; d: number; h: number;
  bobPhase?: number; bobAmp?: number; t?: number;
}> = (props) => (
  <IsoBox
    {...props}
    topColor={C.yellow}
    leftColor={C.yellowDark}
    rightColor={C.yellowSide}
  />
);

/** Vault/safe mechanism with rotating cross handle + gear teeth */
const Vault: React.FC<{
  cx: number; cy: number; size: number;
  rotation: number;
}> = ({ cx, cy, size, rotation }) => {
  const s = size / 100;
  // Center of vault circle relative to frame
  const vc = 15; // vertical center offset within frame

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${s})`}>
      {/* Yellow isometric frame */}
      <path
        d="M 0,-105 L 150,-30 L 150,75 L 0,150 L -150,75 L -150,-30 Z"
        fill={C.yellow}
        stroke={C.stroke}
        strokeWidth={1.2}
      />
      {/* Left side depth */}
      <path d="M -150,-30 L -150,75 L -135,83 L -135,-22 Z" fill={C.yellowDark} stroke={C.stroke} strokeWidth={0.8} />
      {/* Right side depth */}
      <path d="M 150,-30 L 150,75 L 135,83 L 135,-22 Z" fill={C.yellowDark} stroke={C.stroke} strokeWidth={0.8} />
      {/* Top bevel */}
      <path d="M 0,-105 L 150,-30 L 135,-22 L 0,-93 L -135,-22 L -150,-30 Z" fill={C.yellowSide} stroke={C.stroke} strokeWidth={0.8} />

      {/* Rotating cross bars that extend PAST the circle (visible outside) */}
      <g transform={`rotate(${rotation}, 0, ${vc})`}>
        {/* Vertical bar */}
        <rect x={-14} y={vc - 105} width={28} height={210} fill={C.crossBar} rx={4} />
        {/* Horizontal bar */}
        <rect x={-105} y={vc - 14} width={210} height={28} fill={C.crossBar} rx={4} />
        {/* T-caps at ends of cross */}
        <rect x={-22} y={vc - 108} width={44} height={12} fill={C.crossBar} rx={2} />
        <rect x={-22} y={vc + 96} width={44} height={12} fill={C.crossBar} rx={2} />
        <rect x={-108} y={vc - 22} width={12} height={44} fill={C.crossBar} rx={2} />
        <rect x={96} y={vc - 22} width={12} height={44} fill={C.crossBar} rx={2} />
      </g>

      {/* Outer vault circle */}
      <circle cx={0} cy={vc} r={88} fill={C.vaultBg} stroke="#333" strokeWidth={3} />

      {/* Gear teeth / notches around outer ring (rotate with handle) */}
      <g transform={`rotate(${rotation}, 0, ${vc})`}>
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24;
          const rad = (angle * Math.PI) / 180;
          const r = 88;
          const cx2 = Math.cos(rad) * r;
          const cy2 = vc + Math.sin(rad) * r;
          return (
            <rect
              key={`g${i}`}
              x={cx2 - 5}
              y={cy2 - 5}
              width={10}
              height={10}
              fill="#333"
              transform={`rotate(${angle}, ${cx2}, ${cy2})`}
            />
          );
        })}
      </g>

      {/* Inner concentric rings */}
      <circle cx={0} cy={vc} r={78} fill={C.vaultMid} />
      <circle cx={0} cy={vc} r={68} fill="#454545" />
      <circle cx={0} cy={vc} r={58} fill={C.vaultMid} />
      <circle cx={0} cy={vc} r={48} fill={C.vaultDeep} />
      <circle cx={0} cy={vc} r={38} fill="#1e1e1e" />

      {/* Rotating inner cross (visible against dark background) */}
      <g transform={`rotate(${rotation}, 0, ${vc})`}>
        {/* Thin + lines inside */}
        <rect x={-5} y={vc - 45} width={10} height={90} fill="#444" rx={2} />
        <rect x={-45} y={vc - 5} width={90} height={10} fill="#444" rx={2} />
      </g>

      {/* Small 3D cube in center (stays still) */}
      <g transform={`translate(0, ${vc - 4})`}>
        <path d="M 0,-16 L 13,-8 L 0,0 L -13,-8 Z" fill={C.cubeTop} />
        <path d="M -13,-8 L 0,0 L 0,12 L -13,4 Z" fill={C.cubeLeft} />
        <path d="M 13,-8 L 0,0 L 0,12 L 13,4 Z" fill={C.cubeRight} />
      </g>
    </g>
  );
};

interface IsometricBackgroundProps {
  frame: number;
  fps: number;
}

export const IsometricBackground: React.FC<IsometricBackgroundProps> = ({ frame, fps }) => {
  const time = frame / fps;

  // Vault rotation: ~30°/sec
  const vaultRotation = time * 30;

  // Block bobbing: cycle every ~4 seconds
  const bobT = time / 4;
  const A = 12;

  return (
    <svg
      viewBox="0 0 1080 1080"
      width="100%"
      height="100%"
      style={{ display: "block" }}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="1080" height="1080" fill={C.bg} />

      {/*
       * ZOOM-CORRECTED COORDINATES (1080x1080 canvas):
       * Zoom: 1.05 → 1.30 over 360 frames
       * screen_pos = 540 + (canvas_pos - 540) * zoom
       *
       * Vault centers (from reference at 0:08, zoom≈1.217):
       *   Upper: screen ~26% y → canvas cy=327
       *   Lower: screen ~67% y → canvas cy=691
       *   Left:  screen ~6.5% x → canvas cx=154
       *   Right: mirror cx=926
       * Vault size=110 → 330px frame, 194px circle diameter
       */}

      {/* ===== TOP V-ARCH ===== */}
      {/* Bridge block above UL vault — top goes off-screen */}
      <IsoBox x={210} y={220} w={140} d={120} h={210} bobPhase={0.2} bobAmp={A} t={bobT} />
      {/* V-arch left block — tall, top off-screen */}
      <IsoBox x={400} y={190} w={170} d={150} h={260} bobPhase={0} bobAmp={A} t={bobT} />
      {/* V-arch center narrow pillar */}
      <IsoBox x={540} y={140} w={45} d={45} h={220} bobPhase={1.6} bobAmp={A * 0.7} t={bobT} />
      {/* V-arch right block (mirror) */}
      <IsoBox x={660} y={190} w={170} d={150} h={260} bobPhase={0.8} bobAmp={A} t={bobT} />
      {/* Bridge block above UR vault (mirror) */}
      <IsoBox x={830} y={220} w={140} d={120} h={210} bobPhase={0.6} bobAmp={A} t={bobT} />

      {/* ===== UPPER-LEFT VAULT ZONE ===== */}
      <Vault cx={154} cy={327} size={110} rotation={vaultRotation} />
      {/* Block to the right of UL vault */}
      <IsoBox x={310} y={395} w={140} d={110} h={210} bobPhase={0.3} bobAmp={A} t={bobT} />

      {/* ===== UPPER-RIGHT VAULT ZONE (mirror) ===== */}
      <Vault cx={926} cy={327} size={110} rotation={-vaultRotation + 5} />
      {/* Block to the left of UR vault */}
      <IsoBox x={740} y={395} w={140} d={110} h={210} bobPhase={0.5} bobAmp={A} t={bobT} />

      {/* ===== MID-LEFT — block between upper/lower vaults ===== */}
      <IsoBox x={240} y={530} w={120} d={100} h={140} bobPhase={1.0} bobAmp={A * 0.9} t={bobT} />

      {/* ===== MID-RIGHT (mirror) ===== */}
      <IsoBox x={800} y={530} w={120} d={100} h={140} bobPhase={1.2} bobAmp={A * 0.9} t={bobT} />

      {/* ===== LOWER-LEFT VAULT ZONE ===== */}
      <Vault cx={154} cy={691} size={110} rotation={-vaultRotation + 15} />
      <IsoBox x={300} y={770} w={130} d={100} h={130} bobPhase={1.5} bobAmp={A} t={bobT} />

      {/* ===== LOWER-RIGHT VAULT ZONE (mirror) ===== */}
      <Vault cx={926} cy={691} size={110} rotation={vaultRotation + 10} />
      <IsoBox x={760} y={770} w={130} d={100} h={130} bobPhase={1.7} bobAmp={A} t={bobT} />

      {/* ===== BOTTOM SECTION ===== */}
      {/* Yellow flat bars */}
      <YellowBox x={350} y={770} w={160} d={50} h={35} bobPhase={0.5} bobAmp={A * 0.6} t={bobT} />
      <YellowBox x={660} y={770} w={160} d={50} h={35} bobPhase={0.8} bobAmp={A * 0.6} t={bobT} />

      {/* White blocks between yellow bars */}
      <IsoBox x={500} y={800} w={110} d={90} h={120} bobPhase={2.0} bobAmp={A * 0.8} t={bobT} />
      <IsoBox x={620} y={805} w={90} d={70} h={90} bobPhase={2.5} bobAmp={A * 0.7} t={bobT} />

      {/* Bottom row of blocks */}
      <IsoBox x={310} y={890} w={120} d={100} h={110} bobPhase={0.3} bobAmp={A} t={bobT} />
      <IsoBox x={460} y={900} w={100} d={80} h={90} bobPhase={1.0} bobAmp={A * 0.8} t={bobT} />
      <IsoBox x={580} y={900} w={100} d={80} h={90} bobPhase={1.5} bobAmp={A * 0.8} t={bobT} />
      <IsoBox x={720} y={890} w={120} d={100} h={110} bobPhase={1.8} bobAmp={A * 0.9} t={bobT} />

      {/* Bottom-most blocks */}
      <IsoBox x={390} y={970} w={100} d={80} h={80} bobPhase={0.6} bobAmp={A * 0.7} t={bobT} />
      <IsoBox x={540} y={980} w={80} d={70} h={70} bobPhase={1.2} bobAmp={A * 0.6} t={bobT} />
      <IsoBox x={660} y={970} w={100} d={80} h={80} bobPhase={2.0} bobAmp={A * 0.7} t={bobT} />

      {/* Reflection line */}
      <line x1={200} y1={1010} x2={880} y2={1010} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />

      {/* Ghost/reflection blocks */}
      <g opacity={0.2}>
        <IsoBox x={420} y={1030} w={80} d={60} h={35} />
        <IsoBox x={540} y={1025} w={70} d={55} h={30} />
        <IsoBox x={660} y={1030} w={80} d={60} h={35} />
      </g>
    </svg>
  );
};
