import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// The feed that arrives first — the market TAPE is a row of ticks streaming
// left to right. Two subscriber feeds tap it: the FAST FEED (MM) is already
// reading the next tick; the STANDARD FEED (you) is still on the last one.
// Two arrival markers, offset by exactly one tick — the head start.

const TAPE_Y = 360;
const TICK_W = 92;
const GAP = 26;
const STEP = TICK_W + GAP;
const COUNT = 11;
const TAPE_LEFT = (1920 - (COUNT * TICK_W + (COUNT - 1) * GAP)) / 2;

// The "now" cursor — which tick the market just printed.
const CURSOR_INDEX = 7;

const tickX = (i: number): number => TAPE_LEFT + i * STEP;

const Tick: React.FC<{
  index: number;
  printed: boolean;
  next: boolean;
  delay: number;
}> = ({ index, printed, next, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 20,
  });
  const op = interpolate(frame - delay, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // deterministic up/down candle look
  const up = (index % 3) !== 0;
  const fill = next
    ? scene.accentSoft
    : printed
      ? "rgba(255,255,255,0.16)"
      : "rgba(255,255,255,0.05)";
  const border = next
    ? scene.accentSoft
    : printed
      ? "rgba(255,255,255,0.34)"
      : "rgba(255,255,255,0.14)";
  return (
    <div
      style={{
        position: "absolute",
        left: tickX(index),
        top: TAPE_Y - 46,
        width: TICK_W,
        height: 92,
        borderRadius: 12,
        background: fill,
        border: `1.5px solid ${border}`,
        boxShadow: next ? `0 0 28px rgba(91,121,255,0.55)` : "none",
        transform: `scale(${interpolate(pop, [0, 1], [0.7, 1]).toFixed(3)})`,
        opacity: op,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* mini candle */}
      <svg width="34" height="60" viewBox="0 0 34 60">
        <line x1="17" y1="4" x2="17" y2="56" stroke={next ? scene.ink : scene.inkDim} strokeWidth="2" />
        <rect
          x="8"
          y={up ? 18 : 28}
          width="18"
          height="20"
          rx="3"
          fill={next ? scene.ink : (printed ? scene.inkSoft : scene.inkDim)}
        />
      </svg>
    </div>
  );
};

const FeedRow: React.FC<{
  y: number;
  label: string;
  sub: string;
  readIndex: number;
  fast: boolean;
  delay: number;
}> = ({ y, label, sub, readIndex, fast, delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const markerX = tickX(readIndex) + TICK_W / 2;
  const accent = fast ? scene.accentSoft : scene.inkDim;
  return (
    <div style={{ opacity: op }}>
      {/* connector from tape down to feed marker */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <line
          x1={markerX}
          y1={TAPE_Y + 50}
          x2={markerX}
          y2={y - 26}
          stroke={accent}
          strokeWidth={fast ? 3 : 2}
          strokeDasharray={fast ? undefined : "6 8"}
        />
        <circle cx={markerX} cy={y - 26} r={fast ? 9 : 7} fill={accent} />
      </svg>
      {/* feed label box */}
      <div
        style={{
          position: "absolute",
          left: 360,
          top: y - 28,
          width: 360,
          textAlign: "right",
          paddingRight: 28,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: fast ? scene.accentSoft : scene.ink,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: scene.inkDim,
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      </div>
      {/* the tick this feed currently sees, restated as a chip */}
      <div
        style={{
          position: "absolute",
          left: markerX - 90,
          top: y,
          width: 180,
          padding: "14px 0",
          textAlign: "center",
          borderRadius: 12,
          background: fast ? "rgba(91,121,255,0.20)" : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${fast ? scene.accentSoft : "rgba(255,255,255,0.26)"}`,
          fontFamily: monoFont,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: fast ? scene.accentSoft : scene.inkSoft,
        }}
      >
        {fast ? `Tick ${readIndex + 1}` : `Tick ${readIndex + 1}`}
      </div>
    </div>
  );
};

export const FeedLatency: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneFrame kicker="MECHANISM 07 / 13" title="The feed that arrives first">
      <AbsoluteFill>
        {/* TAPE caption */}
        <div
          style={{
            position: "absolute",
            left: TAPE_LEFT,
            top: TAPE_Y - 96,
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: scene.inkDim,
            opacity: interpolate(frame, [6, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          The market tape →
        </div>

        {/* the row of ticks */}
        {Array.from({ length: COUNT }).map((_, i) => (
          <Tick
            key={i}
            index={i}
            printed={i <= CURSOR_INDEX}
            next={i === CURSOR_INDEX}
            delay={14 + i * 1.4}
          />
        ))}

        {/* FAST FEED already on the current/next tick */}
        <FeedRow
          y={540}
          label="Fast Feed"
          sub="Market maker"
          readIndex={CURSOR_INDEX}
          fast
          delay={34}
        />
        {/* STANDARD FEED still one tick behind */}
        <FeedRow
          y={760}
          label="Standard Feed"
          sub="You"
          readIndex={CURSOR_INDEX - 1}
          fast={false}
          delay={42}
        />

        {/* head-start callout */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 924,
            textAlign: "center",
            opacity: interpolate(frame, [50, 64], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              fontFamily: font,
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              color: scene.accentSoft,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            One tick ahead
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.04em",
              color: scene.inkDim,
              marginLeft: 16,
            }}
          >
            · enough to quote against you
          </span>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
