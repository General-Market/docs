/**
 * IsoKit — Dark-mode isometric component library.
 *
 * Adapted from Long03's IsometricBackground (light-mode).
 * Same projection math, inverted palette. Every component renders
 * pure SVG elements — no HTML, no CSS. Composable inside any <svg>.
 */
import React from "react";

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

/* ------------------------------------------------------------------ */
/*  1. DarkIsoBox                                                      */
/* ------------------------------------------------------------------ */

interface DarkIsoBoxProps {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  topColor?: string;
  leftColor?: string;
  rightColor?: string;
  strokeColor?: string;
  glow?: boolean;
  glowColor?: string;
  bobPhase?: number;
  bobAmp?: number;
  t?: number;
}

export const DarkIsoBox: React.FC<DarkIsoBoxProps> = ({
  x,
  y,
  w,
  d,
  h,
  topColor = "#1a1a1e",
  leftColor = "#111114",
  rightColor = "#151518",
  strokeColor = "#2a2a30",
  glow = false,
  glowColor = "#ffffff",
  bobPhase = 0,
  bobAmp = 0,
  t = 0,
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

  // Unique filter id when glow is active
  const filterId = glow
    ? `glow-${x}-${y}-${w}-${d}-${h}`.replace(/\./g, "_")
    : undefined;

  return (
    <g>
      {glow && filterId && (
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx={0}
              dy={0}
              stdDeviation={4}
              floodColor={glowColor}
              floodOpacity={0.35}
            />
          </filter>
        </defs>
      )}
      <g filter={filterId ? `url(#${filterId})` : undefined}>
        <path d={leftPath} fill={leftColor} stroke={strokeColor} strokeWidth={1} />
        <path d={rightPath} fill={rightColor} stroke={strokeColor} strokeWidth={1} />
        <path d={topPath} fill={topColor} stroke={strokeColor} strokeWidth={1} />
      </g>
    </g>
  );
};

/* ------------------------------------------------------------------ */
/*  2. DarkIsoCube                                                     */
/* ------------------------------------------------------------------ */

interface DarkIsoCubeProps {
  x: number;
  y: number;
  size: number;
  color?: string;
}

export const DarkIsoCube: React.FC<DarkIsoCubeProps> = ({
  x,
  y,
  size,
  color = "#2a2a30",
}) => {
  const s = size;
  // Same convention as IsoBox with w=d=h=size.
  // Front-bottom vertex at (x, y).
  const wx = s * COS30;
  const wy = s * SIN30;

  const top = `M ${x},${y - s} L ${x + wx},${y - s - wy} L ${x + wx - wx},${y - s - wy - wy} L ${x - wx},${y - s - wy} Z`;
  const left = `M ${x},${y} L ${x},${y - s} L ${x - wx},${y - s - wy} L ${x - wx},${y - wy} Z`;
  const right = `M ${x},${y} L ${x + wx},${y - wy} L ${x + wx},${y - wy - s} L ${x},${y - s} Z`;

  // Derive darker shades from the accent color
  return (
    <g>
      <path d={left} fill="#0d0d10" stroke="#2a2a30" strokeWidth={0.8} />
      <path d={right} fill="#131316" stroke="#2a2a30" strokeWidth={0.8} />
      <path d={top} fill={color} stroke="#2a2a30" strokeWidth={0.8} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/*  3. DarkIsoBar                                                      */
/* ------------------------------------------------------------------ */

interface DarkIsoBarProps {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  color?: string;
}

export const DarkIsoBar: React.FC<DarkIsoBarProps> = ({
  x,
  y,
  w,
  d,
  h,
  color = "#c8a24e",
}) => {
  // Parse hex to derive side colors (darken by shifting channels)
  const darken = (hex: string, factor: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v * factor)));
    return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
  };

  const leftColor = darken(color, 0.7);
  const rightColor = darken(color, 0.85);

  return (
    <DarkIsoBox
      x={x}
      y={y}
      w={w}
      d={d}
      h={h}
      topColor={color}
      leftColor={leftColor}
      rightColor={rightColor}
      strokeColor={darken(color, 0.55)}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  4. DarkIsoVault                                                    */
/* ------------------------------------------------------------------ */

interface DarkIsoVaultProps {
  cx: number;
  cy: number;
  size: number;
  rotation?: number;
  accentColor?: string;
}

export const DarkIsoVault: React.FC<DarkIsoVaultProps> = ({
  cx,
  cy,
  size,
  rotation = 0,
  accentColor = "#c8a24e",
}) => {
  const s = size / 100;

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${s})`}>
      {/* Isometric hexagonal frame — dark with accent stroke */}
      <path
        d="M 0,-80 L 115,-23 L 115,57 L 0,115 L -115,57 L -115,-23 Z"
        fill="#0e0e12"
        stroke={accentColor}
        strokeWidth={1.2}
        strokeOpacity={0.4}
      />

      {/* Outer vault ring */}
      <circle cx={0} cy={12} r={68} fill="#151518" stroke="#2a2a30" strokeWidth={2} />

      {/* Gear teeth — rotating */}
      <g transform={`rotate(${rotation}, 0, 12)`}>
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          const rad = (angle * Math.PI) / 180;
          const r = 68;
          const tx = Math.cos(rad) * r;
          const ty = 12 + Math.sin(rad) * r;
          return (
            <rect
              key={`t${i}`}
              x={tx - 3.5}
              y={ty - 3.5}
              width={7}
              height={7}
              fill="#2a2a30"
              transform={`rotate(${angle}, ${tx}, ${ty})`}
            />
          );
        })}
      </g>

      {/* Inner rings */}
      <circle cx={0} cy={12} r={58} fill="#111114" />
      <circle cx={0} cy={12} r={48} fill="#0d0d10" />
      <circle cx={0} cy={12} r={38} fill="#0a0a0d" />

      {/* Cross handle — rotating */}
      <g transform={`rotate(${rotation}, 0, 12)`}>
        <rect x={-3} y={12 - 34} width={6} height={68} fill="#2a2a30" rx={2} />
        <rect x={-34} y={12 - 3} width={68} height={6} fill="#2a2a30" rx={2} />
      </g>

      {/* Center dot — accent */}
      <circle cx={0} cy={12} r={4} fill={accentColor} opacity={0.6} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/*  5. IsoGrid                                                         */
/* ------------------------------------------------------------------ */

interface IsoGridProps {
  width: number;
  height: number;
  spacing?: number;
  color?: string;
}

export const IsoGrid: React.FC<IsoGridProps> = ({
  width,
  height,
  spacing = 60,
  color = "#ffffff06",
}) => {
  const lines: React.ReactElement[] = [];

  // Isometric grid: lines going down-right (/) and down-left (\)
  // Plus horizontal lines for the ground plane effect.

  const dy = spacing * SIN30;

  // Down-right lines (slope = SIN30 / COS30 = tan30)
  // Start from left edge and top edge
  const maxDiag = width + height; // generous overflow
  let idx = 0;

  for (let offset = -maxDiag; offset < maxDiag; offset += spacing) {
    // Line going down-right: from top-left toward bottom-right
    const x1 = offset;
    const y1 = 0;
    const x2 = offset + maxDiag * COS30;
    const y2 = maxDiag * SIN30;

    lines.push(
      <line
        key={`dr-${idx}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={0.5}
      />
    );

    // Line going down-left: mirrored slope
    lines.push(
      <line
        key={`dl-${idx}`}
        x1={width - x1 + offset}
        y1={y1}
        x2={width - x1 + offset - maxDiag * COS30}
        y2={y2}
        stroke={color}
        strokeWidth={0.5}
      />
    );

    idx++;
  }

  // Horizontal lines at isometric spacing
  for (let yPos = 0; yPos < height; yPos += dy * 2) {
    lines.push(
      <line
        key={`h-${yPos}`}
        x1={0}
        y1={yPos}
        x2={width}
        y2={yPos}
        stroke={color}
        strokeWidth={0.3}
      />
    );
  }

  return <g>{lines}</g>;
};
