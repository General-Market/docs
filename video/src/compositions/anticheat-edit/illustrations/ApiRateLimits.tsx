import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, monoFont, scene } from "../props";

// More calls, more sight — two request meters side by side. YOU are capped
// low (a short bar that hits a hard ceiling at ~10 req/s); INSTITUTIONAL is
// effectively uncapped (a tall bar overflowing past the frame). The gap
// translates into coverage: a small grid of markets where you watch a few
// cells lit and they watch all of them.

const METER_W = 150;
const METER_H = 360;
const YOU_X = 360;
const INST_X = 660;
const METER_TOP = 360;
const METER_BASE = METER_TOP + METER_H;

const CEILING_FRAC = 0.26; // your cap as a fraction of the meter height

const Meter: React.FC<{
  x: number;
  label: string;
  rate: string;
  fillFrac: number; // 0..1 final fill (can exceed 1 for overflow)
  capFrac?: number; // draw a ceiling line at this fraction
  capped: boolean;
  delay: number;
}> = ({ x, label, rate, fillFrac, capFrac, capped, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rise = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 28,
  });
  const op = interpolate(frame - delay, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fillH = Math.min(fillFrac, 1) * METER_H * rise;
  const overflowH = Math.max(0, fillFrac - 1) * METER_H * rise;

  const accent = capped ? scene.inkSoft : scene.accentSoft;

  return (
    <div style={{ opacity: op }}>
      {/* meter shell */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: METER_TOP,
          width: METER_W,
          height: METER_H,
          borderRadius: 16,
          border: "1.5px solid rgba(255,255,255,0.26)",
          background: "rgba(255,255,255,0.04)",
          overflow: "visible",
        }}
      >
        {/* fill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: fillH,
            borderRadius: 14,
            background: capped
              ? "rgba(255,255,255,0.18)"
              : "rgba(91,121,255,0.34)",
            borderTop: `2px solid ${accent}`,
            boxShadow: capped ? "none" : "0 0 30px rgba(91,121,255,0.5)",
          }}
        />
        {/* overflow plume above the shell */}
        {overflowH > 1 ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: METER_H,
              width: "100%",
              height: overflowH,
              borderRadius: 14,
              background:
                "linear-gradient(to top, rgba(91,121,255,0.34), rgba(91,121,255,0))",
              borderTop: `2px solid ${scene.accentSoft}`,
            }}
          />
        ) : null}
        {/* ceiling line */}
        {capFrac !== undefined ? (
          <div
            style={{
              position: "absolute",
              left: -10,
              right: -10,
              bottom: capFrac * METER_H,
              height: 0,
              borderTop: "2px dashed #FF6B5E",
            }}
          >
            <span
              style={{
                position: "absolute",
                right: -118,
                top: -10,
                fontFamily: monoFont,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#FF8C82",
                whiteSpace: "nowrap",
              }}
            >
              Hard cap
            </span>
          </div>
        ) : null}
      </div>

      {/* label */}
      <div
        style={{
          position: "absolute",
          left: x - 30,
          top: METER_BASE + 22,
          width: METER_W + 60,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: capped ? scene.ink : scene.accentSoft,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: scene.inkDim,
            marginTop: 6,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rate}
        </div>
      </div>
    </div>
  );
};

// Coverage grid — markets you can watch vs they can watch.
const CoverageGrid: React.FC<{
  x: number;
  y: number;
  cols: number;
  rows: number;
  litCount: number;
  full: boolean;
  delay: number;
}> = ({ x, y, cols, rows, litCount, full, delay }) => {
  const frame = useCurrentFrame();
  const total = cols * rows;
  const cell = 36;
  const gap = 10;
  const op = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lit = full ? total : litCount;
  // stagger the lit cells on
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
        gridTemplateRows: `repeat(${rows}, ${cell}px)`,
        gap,
        opacity: op,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isLit = i < lit;
        const cellOn = interpolate(frame - delay - 6 - i * 0.6, [0, 6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              width: cell,
              height: cell,
              borderRadius: 7,
              background: isLit
                ? `rgba(91,121,255,${(0.30 + 0.5 * cellOn).toFixed(2)})`
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${isLit ? scene.accentSoft : "rgba(255,255,255,0.14)"}`,
              boxShadow: isLit ? `0 0 ${(10 * cellOn).toFixed(0)}px rgba(91,121,255,0.5)` : "none",
            }}
          />
        );
      })}
    </div>
  );
};

export const ApiRateLimits: React.FC = () => {
  const frame = useCurrentFrame();

  const gridLabelOp = interpolate(frame, [40, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="MECHANISM 10 / 13" title="More calls, more sight">
      <AbsoluteFill>
        {/* meters caption */}
        <div
          style={{
            position: "absolute",
            left: YOU_X - 30,
            top: METER_TOP - 56,
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.inkDim,
            opacity: interpolate(frame, [8, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Requests per second
        </div>

        {/* YOU — capped low */}
        <Meter
          x={YOU_X}
          label="You"
          rate="10 req/s"
          fillFrac={CEILING_FRAC}
          capFrac={CEILING_FRAC}
          capped
          delay={16}
        />

        {/* INSTITUTIONAL — uncapped, overflowing */}
        <Meter
          x={INST_X}
          label="Institutional"
          rate="Uncapped"
          fillFrac={1.18}
          capped={false}
          delay={24}
        />

        {/* the translation arrow */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <line
            x1={INST_X + METER_W + 60}
            y1={METER_TOP + METER_H / 2}
            x2={1120}
            y2={METER_TOP + METER_H / 2}
            stroke="rgba(255,255,255,0.30)"
            strokeWidth={2}
            strokeDasharray="8 8"
            opacity={interpolate(frame, [30, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: INST_X + METER_W + 40,
            top: METER_TOP + METER_H / 2 - 46,
            width: 240,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: scene.inkDim,
            opacity: interpolate(frame, [34, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          calls → coverage
        </div>

        {/* coverage grids — YOU (few cells) vs THEM (all cells) */}
        <div
          style={{
            position: "absolute",
            left: 1180,
            top: METER_TOP - 56,
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.inkDim,
            opacity: gridLabelOp,
          }}
        >
          Markets watched
        </div>

        <CoverageGrid x={1180} y={METER_TOP} cols={6} rows={4} litCount={4} full={false} delay={44} />
        <div
          style={{
            position: "absolute",
            left: 1180,
            top: METER_TOP + 4 * 46 + 12,
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: scene.ink,
            opacity: gridLabelOp,
          }}
        >
          You · 4 of 24
        </div>

        <CoverageGrid x={1480} y={METER_TOP} cols={6} rows={4} litCount={24} full delay={56} />
        <div
          style={{
            position: "absolute",
            left: 1480,
            top: METER_TOP + 4 * 46 + 12,
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: scene.accentSoft,
            opacity: interpolate(frame, [56, 68], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Them · all 24
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
