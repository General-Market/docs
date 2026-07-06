// "Equations for Organic Motion" — 15 colored circles in a 5x3 grid, each
// pulsing on a different math expression. Faithful Remotion port of Justin
// Windle's soulwire/sketch.js demo, frame-driven and deterministic.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// All 21 colors from the original sketch.
const COLOURS = [
  "FE4365",
  "FC9D9A",
  "F9CDAD",
  "C8C8A9",
  "83AF9B",
  "FC913A",
  "F9D423",
  "435356",
  "566965",
  "FF7373",
  "A9DA88",
  "E3AAD6",
  "73A8AF",
  "F6BCAD",
  "BE4C54",
  "7CD7CF",
  "FFA446",
  "B5D8EB",
  "E05561",
  "F4CE79",
  "77B29C",
];

interface Pulse {
  label: string;
  fn: (t: number) => number;
}

// All 15 equations from the original sketch, in order.
const PULSES: Pulse[] = [
  { label: "sin(t)", fn: (t) => Math.sin(t) },
  { label: "cos(t)", fn: (t) => Math.cos(t) },
  { label: "cos(t)*sin(t)", fn: (t) => Math.cos(t) * Math.sin(t) },
  { label: "sin(t)*sin(t*1.5)", fn: (t) => Math.sin(t) * Math.sin(t * 1.5) },
  {
    label: "sin(tan(cos(t)*1.2))",
    fn: (t) => Math.sin(Math.tan(Math.cos(t) * 1.2)),
  },
  { label: "sin(tan(t)*0.05)", fn: (t) => Math.sin(Math.tan(t) * 0.05) },
  {
    label: "cos(sin(t*3))*sin(t*0.2)",
    fn: (t) => Math.cos(Math.sin(t * 3)) * Math.sin(t * 0.2),
  },
  {
    label: "sin(pow(8,sin(t)))",
    fn: (t) => Math.sin(Math.pow(8, Math.sin(t))),
  },
  {
    label: "sin(exp(cos(t*0.8))*2)",
    fn: (t) => Math.sin(Math.exp(Math.cos(t * 0.8)) * 2),
  },
  {
    label: "sin(t-PI*tan(t)*0.01)",
    fn: (t) => Math.sin(t - Math.PI * Math.tan(t) * 0.01),
  },
  {
    label: "pow(sin(t*PI),12)",
    fn: (t) => Math.pow(Math.sin(t * Math.PI), 12),
  },
  {
    label: "cos(sin(t*PI)*tan(t*PI)*PI/8)",
    fn: (t) =>
      Math.cos((Math.sin(t * Math.PI) * Math.tan(t * Math.PI) * Math.PI) / 8),
  },
  {
    label: "sin(tan(t)*pow(sin(t),10))",
    fn: (t) => Math.sin(Math.tan(t) * Math.pow(Math.sin(t), 10)),
  },
  {
    label: "cos(sin(t*3)+t*3)",
    fn: (t) => Math.cos(Math.sin(t * 3) + t * 3),
  },
  {
    label: "pow(abs(sin(t*2))*0.6,sin(t*2))*0.6",
    fn: (t) =>
      Math.pow(Math.abs(Math.sin(t * 2)) * 0.6, Math.sin(t * 2)) * 0.6,
  },
];

const COLS = 5;
const ROWS = 3;
const MIN_R = 30;
const MAX_R = 130;

export const OrganicMotion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Original: t = millis * 0.0015 → at 60fps that is (frame / fps) * 1.5.
  const t = (frame / fps) * 1.5;

  const xs = width / COLS;
  const ys = height / ROWS;

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f2f2f2",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        opacity: fadeIn * fadeOut,
      }}
    >
      {/* Title strip — matches original h1 (black bg, white uppercase 11px, scaled for 1080p) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          background: "#111",
          color: "#fff",
          padding: "12px 30px 16px 24px",
          fontSize: 22,
          fontWeight: 300,
          textTransform: "uppercase",
          letterSpacing: 1,
          zIndex: 10,
        }}
      >
        Equations for Organic Motion — Test Sheet
      </div>

      {/* 5x3 grid of pulsing circles + labels */}
      {PULSES.map((pulse, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const cx = xs * 0.5 + col * xs;
        const cy = ys * 0.5 + row * ys;
        const r = MIN_R + Math.abs(pulse.fn(t)) * (MAX_R - MIN_R);
        const color = COLOURS[i % COLOURS.length];

        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: cx - r,
                top: cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                background: `#${color}`,
                opacity: 0.5,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: cx - xs / 2,
                top: cy + MAX_R + 16,
                width: xs,
                textAlign: "center",
                fontSize: 18,
                color: "#1a1a1a",
              }}
            >
              {pulse.label}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
