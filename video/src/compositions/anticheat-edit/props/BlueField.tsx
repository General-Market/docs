import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BLUE_FIELD_GRADIENT, FPS, H, W, scene } from "./tokens";

// BlueField — the deep-blue world every illustration sits on.
//
//   Layer 1  the gradient: bright Base blue upper-left → navy abyss lower-right.
//   Layer 2  a faint white line grid that drifts and breathes (the "grid").
//   Layer 3  two bright scan lines (one vertical, one horizontal) that sweep
//            slowly across, plus short perpendicular ticks where they cross.
//   Layer 4  a soft vignette darkening the lower-right, faking depth.
//
// Nothing here ever sits still — the grid drifts on a slow sinusoid so the
// field reads as alive even on a long hold. Static backgrounds feel dead.

const GRID_V = 240; // vertical line spacing, px
const GRID_H = 216; // horizontal line spacing, px

type Props = {
  /** 0..1 master opacity for the grid + scan lines (the gradient stays). */
  intensity?: number;
  /** Multiplies the drift + sweep speed. */
  speed?: number;
};

export const BlueField: React.FC<Props> = ({ intensity = 1, speed = 1 }) => {
  const frame = useCurrentFrame();
  const t = (frame / FPS) * speed;

  // Slow grid drift — a few px on each axis, out of phase.
  const driftX = Math.sin(t * 0.18) * 9;
  const driftY = Math.cos(t * 0.14) * 7;

  // Scan lines sweep on long periods; wrap across the full canvas.
  const scanX = ((t * 36) % (W + GRID_V)) - GRID_V / 2;
  const scanY = (((t * 28) + H * 0.4) % (H + GRID_H)) - GRID_H / 2;

  const vLines = Math.ceil(W / GRID_V) + 2;
  const hLines = Math.ceil(H / GRID_H) + 2;

  return (
    <AbsoluteFill style={{ background: BLUE_FIELD_GRADIENT }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {/* Layer 2 — drifting line grid */}
        <g
          transform={`translate(${driftX.toFixed(2)} ${driftY.toFixed(2)})`}
          opacity={intensity}
        >
          {Array.from({ length: vLines }).map((_, i) => {
            const x = i * GRID_V - GRID_V;
            return (
              <line
                key={`v${i}`}
                x1={x}
                y1={-GRID_H}
                x2={x}
                y2={H + GRID_H}
                stroke={scene.gridLine}
                strokeWidth={1}
              />
            );
          })}
          {Array.from({ length: hLines }).map((_, i) => {
            const y = i * GRID_H - GRID_H;
            return (
              <line
                key={`h${i}`}
                x1={-GRID_V}
                y1={y}
                x2={W + GRID_V}
                y2={y}
                stroke={scene.gridLine}
                strokeWidth={1}
              />
            );
          })}
        </g>

        {/* Layer 3 — sweeping scan lines + ticks at the crossing */}
        <g opacity={intensity}>
          <line
            x1={scanX}
            y1={0}
            x2={scanX}
            y2={H}
            stroke={scene.gridLineBright}
            strokeWidth={1.4}
          />
          <line
            x1={0}
            y1={scanY}
            x2={W}
            y2={scanY}
            stroke={scene.gridLineBright}
            strokeWidth={1.4}
          />
          {/* short tick marks at the intersection — the "measurement" cross */}
          <line
            x1={scanX - 26}
            y1={scanY}
            x2={scanX + 26}
            y2={scanY}
            stroke={scene.scanLine}
            strokeWidth={2}
          />
          <line
            x1={scanX}
            y1={scanY - 26}
            x2={scanX}
            y2={scanY + 26}
            stroke={scene.scanLine}
            strokeWidth={2}
          />
        </g>
      </svg>

      {/* Layer 4 — depth vignette, weighted to the lower-right */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 120% at 22% 18%, rgba(2,14,43,0) 38%, rgba(2,14,43,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
