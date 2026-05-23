import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MECHANISM 04 / 13 — "Knowing before the news".
//
// A horizontal timeline. An INSIDER BUY marker sits left of the public
// LISTED — ANNOUNCED marker. Right after the announcement the price candle
// gaps up. The insider was already in before the news existed. Order of
// motion: timeline draws → insider entry marker drops → news flash fires
// at the announcement → the price candle gaps up beyond it.

const STAGE_W = 1560;
const STAGE_H = 470;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 386;

// The axis the events sit on.
const AXIS_Y = 300;
const AXIS_X1 = 70;
const AXIS_X2 = STAGE_W - 70;

// Two event anchors along the axis.
const INSIDER_X = 360;
const NEWS_X = 920;

const RED = "#FF4D4D";

const Marker: React.FC<{
  x: number;
  label: string;
  sub: string;
  delay: number;
  tone: "insider" | "news";
}> = ({ x, label, sub, delay, tone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 14, stiffness: 130 },
    durationInFrames: 22,
  });
  const op = interpolate(pop, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const dotColor = tone === "insider" ? RED : scene.ink;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: AXIS_Y,
        transform: "translate(-50%, -50%)",
        opacity: op,
      }}
    >
      {/* Stem + dot on the axis */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -84,
          transform: "translateX(-50%)",
          width: 2,
          height: 84,
          background: scene.gridLineBright,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${(0.5 + 0.5 * pop).toFixed(3)})`,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: dotColor,
          boxShadow:
            tone === "insider"
              ? `0 0 0 6px rgba(255,77,77,0.22)`
              : `0 0 0 6px rgba(255,255,255,0.16)`,
        }}
      />
      {/* Label card above the stem */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -84,
          transform: "translate(-50%, -100%)",
          width: tone === "insider" ? 230 : 260,
          padding: "14px 18px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.06)",
          border: `1.5px solid ${tone === "insider" ? "rgba(255,77,77,0.7)" : scene.gridLineBright}`,
          boxShadow: "0 16px 38px rgba(2,14,43,0.42)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: tone === "insider" ? RED : scene.ink,
            lineHeight: 1.0,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: scene.inkDim,
            marginTop: 7,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
};

// One candle. Body grows from the baseline; bodyTop is the open/close band.
const Candle: React.FC<{
  x: number;
  baseY: number;
  bodyH: number;
  wickH: number;
  rise: number;
  tone: "flat" | "gap";
}> = ({ x, baseY, bodyH, wickH, rise, tone }) => {
  const h = bodyH * rise;
  const color = tone === "gap" ? "#37D67A" : scene.inkDim;
  return (
    <g>
      {/* wick */}
      <line
        x1={x}
        y1={baseY - h - wickH * rise}
        x2={x}
        y2={baseY - h + 6}
        stroke={color}
        strokeWidth={2}
        opacity={rise}
      />
      {/* body */}
      <rect
        x={x - 13}
        y={baseY - h}
        width={26}
        height={h}
        rx={4}
        fill={color}
        opacity={0.92 * rise}
      />
    </g>
  );
};

export const ListingFrontrun: React.FC = () => {
  const frame = useCurrentFrame();

  // Axis draws in across the first beat.
  const axisDraw = interpolate(frame, [12, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const axisRight = AXIS_X1 + (AXIS_X2 - AXIS_X1) * axisDraw;

  // The news flash fires when the announcement marker lands (~frame 56).
  const flash = interpolate(frame, [56, 64, 88], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Flat candles before the news, then the gap-up candles after.
  const baseY = AXIS_Y - 10;
  const preCandles = [
    { x: NEWS_X - 220, bodyH: 46, wickH: 18, delay: 30 },
    { x: NEWS_X - 150, bodyH: 40, wickH: 16, delay: 36 },
    { x: NEWS_X - 80, bodyH: 52, wickH: 20, delay: 42 },
  ];
  const gapCandles = [
    { x: NEWS_X + 120, bodyH: 150, wickH: 30, delay: 66 },
    { x: NEWS_X + 196, bodyH: 200, wickH: 34, delay: 74 },
    { x: NEWS_X + 272, bodyH: 244, wickH: 38, delay: 82 },
  ];

  const candleRise = (delay: number) =>
    interpolate(frame, [delay, delay + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // The "gap" connector that hands the jump to the insider.
  const gapOp = interpolate(frame, [88, 102], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="MECHANISM 04 / 13" title="Knowing before the news">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: STAGE_H,
          }}
        >
          <svg
            width={STAGE_W}
            height={STAGE_H}
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {/* The timeline axis */}
            <line
              x1={AXIS_X1}
              y1={AXIS_Y}
              x2={axisRight}
              y2={AXIS_Y}
              stroke={scene.gridLineBright}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            {/* Time arrowhead */}
            {axisDraw > 0.98 && (
              <polygon
                points={`${AXIS_X2},${AXIS_Y} ${AXIS_X2 - 16},${AXIS_Y - 9} ${AXIS_X2 - 16},${AXIS_Y + 9}`}
                fill={scene.gridLineBright}
              />
            )}

            {/* Pre-news flat candles */}
            {preCandles.map((c, i) => (
              <Candle
                key={`p${i}`}
                x={c.x}
                baseY={baseY}
                bodyH={c.bodyH}
                wickH={c.wickH}
                rise={candleRise(c.delay)}
                tone="flat"
              />
            ))}

            {/* The gap-up candles after the announcement */}
            {gapCandles.map((c, i) => (
              <Candle
                key={`g${i}`}
                x={c.x}
                baseY={baseY}
                bodyH={c.bodyH}
                wickH={c.wickH}
                rise={candleRise(c.delay)}
                tone="gap"
              />
            ))}

            {/* The gap discontinuity bracket — price jumps at the news */}
            <line
              x1={NEWS_X + 40}
              y1={baseY - 60}
              x2={NEWS_X + 90}
              y2={baseY - 110}
              stroke="#37D67A"
              strokeWidth={2.5}
              strokeDasharray="4 7"
              opacity={gapOp}
            />
          </svg>

          {/* News flash burst at the announcement */}
          <div
            style={{
              position: "absolute",
              left: NEWS_X,
              top: AXIS_Y,
              transform: `translate(-50%, -50%) scale(${(1 + flash * 1.6).toFixed(3)})`,
              width: 60,
              height: 60,
              borderRadius: 30,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(91,121,255,0) 70%)",
              opacity: flash,
              pointerEvents: "none",
            }}
          />

          {/* "GAP UP" tag over the jump */}
          <div
            style={{
              position: "absolute",
              left: NEWS_X + 110,
              top: baseY - 280,
              opacity: gapOp,
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#37D67A",
            }}
          >
            gap&nbsp;up
          </div>

          {/* The two timeline markers */}
          <Marker
            x={INSIDER_X}
            label="INSIDER BUY"
            sub="before the news exists"
            delay={28}
            tone="insider"
          />
          <Marker
            x={NEWS_X}
            label="LISTED"
            sub="announced — public"
            delay={50}
            tone="news"
          />
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
