import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneFrame, monoFont, scene } from "../props";

// MOTIF · DEATH BY A THOUSAND — "A small tax, a thousand times".
//
// A dense grid of 1,000 faint tick marks. Most stay faint; a scattered few
// flash accent as the frame advances — each is one small tax. Below, an
// equity line drifts gently down across the run. The single hit is invisible;
// the sum is not.

const COLS = 50;
const ROWS = 20; // 1,000 ticks
const TOTAL = COLS * ROWS;

const GRID_W = 1280;
const GRID_TOP = 330;
const GRID_LEFT = (1920 - GRID_W) / 2;
const CELL = GRID_W / COLS;
const GRID_H = CELL * ROWS;

// Deterministic per-tick hash (GLSL-style), stable across frames.
const hash = (i: number): number => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};

const EQ_W = GRID_W;
const EQ_H = 150;
const EQ_TOP = GRID_TOP + GRID_H + 56;

export const SlowBleed: React.FC = () => {
  const frame = useCurrentFrame();

  // Grid fades up; ticks appear over the entrance.
  const gridOp = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Which ticks flash this frame: a sparse rolling subset (~2.5%).
  // Each flash is a short window keyed off the tick's own phase.
  const flashSet = useMemo(() => {
    // Precompute a fixed phase per tick once.
    return Array.from({ length: TOTAL }, (_, i) => hash(i));
  }, []);

  const equityDraw = interpolate(frame, [20, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Equity drifts down with small noise — gentle bleed, not a crash.
  const eqY = (x: number) => {
    const slope = 0.18 + 0.62 * x; // 0 top of band
    const wobble = Math.sin(x * 9) * 0.05 + Math.sin(x * 23) * 0.02;
    return Math.min(0.96, slope + wobble);
  };
  const pts: string[] = [];
  const ESAMP = 80;
  for (let i = 0; i <= ESAMP; i++) {
    const x = (i / ESAMP) * equityDraw;
    pts.push(`${(x * EQ_W).toFixed(1)},${(eqY(x) * EQ_H).toFixed(1)}`);
  }
  const eqEnd = { x: equityDraw * EQ_W, y: eqY(equityDraw) * EQ_H };

  return (
    <SceneFrame kicker="MOTIF · DEATH BY A THOUSAND" title="A small tax, a thousand times">
      <AbsoluteFill>
        {/* The 1,000-tick field */}
        <svg
          width={GRID_W}
          height={GRID_H}
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          style={{ position: "absolute", left: GRID_LEFT, top: GRID_TOP, opacity: gridOp }}
        >
          {Array.from({ length: TOTAL }).map((_, i) => {
            const c = i % COLS;
            const r = Math.floor(i / COLS);
            const cx = c * CELL + CELL / 2;
            const cy = r * CELL + CELL / 2;

            // Stagger appearance in reading order.
            const appear = interpolate(frame, [8 + i * 0.012, 18 + i * 0.012], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            // Flash logic: each tick lights briefly when the rolling cursor
            // (advancing with the frame) passes its phase value.
            const phase = flashSet[i];
            const cursor = (frame * 0.012) % 1;
            const d = Math.abs(((phase - cursor + 1) % 1));
            const lit = d < 0.012 || d > 0.988;

            const color = lit ? scene.accent : scene.gridLineBright;
            const len = lit ? 12 : 8;
            const sw = lit ? 3 : 1.6;
            const op = (lit ? 1 : 0.5) * appear;

            return (
              <line
                key={i}
                x1={cx}
                y1={cy - len / 2}
                x2={cx}
                y2={cy + len / 2}
                stroke={color}
                strokeWidth={sw}
                opacity={op}
              />
            );
          })}
        </svg>

        {/* Count label */}
        <div
          style={{
            position: "absolute",
            left: GRID_LEFT,
            top: GRID_TOP - 38,
            opacity: gridOp,
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: scene.inkDim,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          1,000 trades · each a tiny tax
        </div>

        {/* Equity line drifting down */}
        <svg
          width={EQ_W}
          height={EQ_H}
          viewBox={`0 0 ${EQ_W} ${EQ_H}`}
          style={{ position: "absolute", left: GRID_LEFT, top: EQ_TOP, overflow: "visible" }}
        >
          <line x1={0} y1={2} x2={EQ_W} y2={2} stroke={scene.gridLine} strokeWidth={1.5} />
          <polyline
            points={pts.join(" ")}
            fill="none"
            stroke={scene.inkSoft}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {equityDraw > 0.02 && (
            <circle cx={eqEnd.x} cy={eqEnd.y} r={6} fill={scene.ink} />
          )}
        </svg>
        <div
          style={{
            position: "absolute",
            left: GRID_LEFT,
            top: EQ_TOP + EQ_H + 8,
            opacity: interpolate(frame, [40, 60], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: scene.inkDim,
          }}
        >
          equity over the run
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
