import React from "react";
import { AbsoluteFill } from "remotion";

export const PALETTE = {
  bgTop: "#1A1E25",
  bgBottom: "#06080C",
  gridLine: "rgba(255, 255, 255, 0.05)",
  gridDot: "rgba(255, 255, 255, 0.12)",
  text: "#F5F6F8",
  textDim: "#9095A0",
  textVeryDim: "#5F6571",
  neutral: "#1f2127",
  red1: "#3a181f",
  red2: "#6b1f24",
  red3: "#a82c2c",
  red4: "#dd3534",
  green1: "#0f3a25",
  green2: "#175a37",
  green3: "#249d51",
  green4: "#28c764",
};

export const Backdrop: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const spacing = 120;
  const cols = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 100% 70% at 50% 30%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`,
        }}
      />
      <AbsoluteFill>
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <radialGradient id="morpho-grid-mask" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="55%" stopColor="white" stopOpacity="0.65" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="morpho-grid-fade">
              <rect width={width} height={height} fill="url(#morpho-grid-mask)" />
            </mask>
          </defs>
          <g mask="url(#morpho-grid-fade)">
            {Array.from({ length: rows + 1 }).map((_, r) => (
              <line
                key={`h-${r}`}
                x1={0}
                y1={r * spacing}
                x2={width}
                y2={r * spacing}
                stroke={PALETTE.gridLine}
                strokeWidth={1.2}
              />
            ))}
            {Array.from({ length: cols + 1 }).map((_, c) => (
              <line
                key={`v-${c}`}
                x1={c * spacing}
                y1={0}
                x2={c * spacing}
                y2={height}
                stroke={PALETTE.gridLine}
                strokeWidth={1.2}
              />
            ))}
            {Array.from({ length: rows + 1 }).flatMap((_, r) =>
              Array.from({ length: cols + 1 }).map((__, c) => (
                <circle
                  key={`d-${r}-${c}`}
                  cx={c * spacing}
                  cy={r * spacing}
                  r={2.5}
                  fill={PALETTE.gridDot}
                />
              )),
            )}
          </g>
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 0%, transparent 45%, ${PALETTE.bgBottom} 100%)`,
          pointerEvents: "none",
        }}
      />
    </>
  );
};

// Diverging palette: green on the up side, red on the down side, near-
// neutral at ~0. Mapped on |pct| against curated stops so both sides
// read symmetrically without one swallowing the other.
export function pctToColor(pct: number | null): string {
  if (pct == null) return PALETTE.neutral;
  const mag = Math.min(15, Math.abs(pct));
  const stops: [number, string][] =
    pct >= 0
      ? [
          [0, PALETTE.neutral],
          [1, PALETTE.green1],
          [3, PALETTE.green2],
          [7, PALETTE.green3],
          [15, PALETTE.green4],
        ]
      : [
          [0, PALETTE.neutral],
          [1, PALETTE.red1],
          [3, PALETTE.red2],
          [7, PALETTE.red3],
          [15, PALETTE.red4],
        ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ac] = stops[i];
    const [b, bc] = stops[i + 1];
    if (mag >= a && mag <= b) {
      const t = (mag - a) / (b - a);
      return mixHex(ac, bc, t);
    }
  }
  return stops[stops.length - 1][1];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${[r, g, bl]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseHex(h: string): [number, number, number] {
  const m = h.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}
