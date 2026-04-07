import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { AnimatedText, COUNCIL_TEAL } from "./AnimatedText";

const { fontFamily } = loadFont();
const TEAL = COUNCIL_TEAL;

/* ── Inline SVG Icons ───────────────────────────────────── */

const CandlestickIcon: React.FC<{ size?: number }> = ({ size = 90 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <rect x="14" y="18" width="12" height="36" rx="2" fill={TEAL} />
    <line x1="20" y1="10" x2="20" y2="18" stroke={TEAL} strokeWidth="3" />
    <line x1="20" y1="54" x2="20" y2="62" stroke={TEAL} strokeWidth="3" />
    <rect x="34" y="10" width="12" height="32" rx="2" fill={TEAL} />
    <line x1="40" y1="2" x2="40" y2="10" stroke={TEAL} strokeWidth="3" />
    <line x1="40" y1="42" x2="40" y2="50" stroke={TEAL} strokeWidth="3" />
    <rect x="54" y="14" width="12" height="34" rx="2" fill={TEAL} />
    <line x1="60" y1="6" x2="60" y2="14" stroke={TEAL} strokeWidth="3" />
    <line x1="60" y1="48" x2="60" y2="56" stroke={TEAL} strokeWidth="3" />
  </svg>
);

const OpenAIKnotIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 32 32">
    <path
      d="M16 4 C19 4 21 6 22 8 C24 8 26 10 26 13 C27 14 27 17 26 19 C26 22 24 24 22 24 C21 26 19 28 16 28 C13 28 11 26 10 24 C8 24 6 22 6 19 C5 18 5 15 6 13 C6 10 8 8 10 8 C11 6 13 4 16 4 Z"
      fill="none"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="16" r="2" fill="#fff" />
  </svg>
);

const SparkleIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 32 32">
    <path
      d="M16 2 L18 14 L30 16 L18 18 L16 30 L14 18 L2 16 L14 14 Z"
      fill="#fff"
    />
  </svg>
);

const GeminiStarIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 32 32">
    <path
      d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z"
      fill="#fff"
    />
  </svg>
);

const ModelCircle: React.FC<{ kind: "openai" | "sparkle" | "gemini" }> = ({
  kind,
}) => (
  <div
    style={{
      width: 58,
      height: 58,
      borderRadius: "50%",
      backgroundColor: TEAL,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 6px rgba(15,232,174,0.25)",
    }}
  >
    {kind === "openai" && <OpenAIKnotIcon />}
    {kind === "sparkle" && <SparkleIcon />}
    {kind === "gemini" && <GeminiStarIcon />}
  </div>
);

/** A trio of model circles arranged in a small triangle. Used as the icon for "Hundreds of agents". */
const ModelCircles: React.FC = () => (
  <div
    style={{
      position: "relative",
      width: 160,
      height: 90,
    }}
  >
    <div style={{ position: "absolute", left: 0, top: 20 }}>
      <ModelCircle kind="sparkle" />
    </div>
    <div style={{ position: "absolute", left: 51, top: 0 }}>
      <ModelCircle kind="openai" />
    </div>
    <div style={{ position: "absolute", left: 102, top: 20 }}>
      <ModelCircle kind="gemini" />
    </div>
  </div>
);

const StopwatchIcon: React.FC = () => (
  <svg width="75" height="75" viewBox="0 0 48 48">
    <rect x="20" y="3" width="8" height="5" rx="1" fill={TEAL} />
    <line x1="24" y1="8" x2="24" y2="11" stroke={TEAL} strokeWidth="2.5" />
    <circle
      cx="24"
      cy="26"
      r="15"
      fill="none"
      stroke={TEAL}
      strokeWidth="3.5"
    />
    <line
      x1="24"
      y1="26"
      x2="24"
      y2="16"
      stroke={TEAL}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <line
      x1="24"
      y1="26"
      x2="32"
      y2="26"
      stroke={TEAL}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const NetworkNodes: React.FC = () => (
  <svg width="90" height="90" viewBox="0 0 80 80">
    <line x1="28" y1="32" x2="48" y2="20" stroke={TEAL} strokeWidth="3" />
    <line x1="28" y1="32" x2="56" y2="50" stroke={TEAL} strokeWidth="3" />
    <rect x="42" y="14" width="12" height="12" rx="1.5" fill={TEAL} />
    <rect x="22" y="26" width="12" height="12" rx="1.5" fill={TEAL} />
    <rect x="50" y="44" width="12" height="12" rx="1.5" fill={TEAL} />
  </svg>
);

const MoneyBagIcon: React.FC = () => (
  <svg width="90" height="90" viewBox="0 0 48 48">
    <path
      d="M18 12 Q20 9 24 9 Q28 9 30 12 L33 14 Q26 16 24 16 Q22 16 15 14 Z"
      fill={TEAL}
    />
    <path
      d="M16 16 Q12 22 12 30 Q12 40 24 42 Q36 40 36 30 Q36 22 32 16 Z"
      fill={TEAL}
    />
    <text
      x="24"
      y="33"
      textAnchor="middle"
      fill="#fff"
      fontSize="12"
      fontWeight="700"
      fontFamily="sans-serif"
    >
      $
    </text>
  </svg>
);

const AlertCircleIcon: React.FC = () => (
  <svg width="85" height="85" viewBox="0 0 48 48">
    <circle
      cx="24"
      cy="24"
      r="18"
      fill="none"
      stroke={TEAL}
      strokeWidth="3"
    />
    <line
      x1="24"
      y1="14"
      x2="24"
      y2="26"
      stroke={TEAL}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="24" cy="32" r="2" fill={TEAL} />
  </svg>
);

const BrainHeadIcon: React.FC<{ headOpacity: number; brainScale: number }> = ({
  headOpacity,
  brainScale,
}) => (
  <div
    style={{
      position: "relative",
      width: 320,
      height: 320,
      transform: `scale(${brainScale})`,
    }}
  >
    {/* Head silhouette behind brain */}
    <svg
      width="320"
      height="320"
      viewBox="0 0 320 320"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        opacity: headOpacity,
      }}
    >
      <path
        d="M 90 120
           Q 90 60 160 60
           Q 230 60 230 130
           Q 230 200 230 240
           L 230 280
           L 110 280
           Q 90 280 80 260
           L 70 230
           Q 60 200 60 175
           Q 60 150 80 140
           Q 90 130 90 120 Z"
        fill={TEAL}
      />
    </svg>
    {/* Brain outline overlaid on head */}
    <svg
      width="320"
      height="320"
      viewBox="0 0 320 320"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <path
        d="M 110 150
           Q 100 125 125 115
           Q 135 95 160 100
           Q 175 90 195 100
           Q 220 100 225 125
           Q 240 135 230 160
           Q 240 180 220 185
           L 120 185
           Q 100 180 110 150 Z"
        fill="#fff"
        stroke={TEAL}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M 160 105 L 160 185"
        stroke={TEAL}
        strokeWidth="3"
        opacity="0.7"
      />
      <path
        d="M 130 140 Q 140 150 155 145"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
      <path
        d="M 165 145 Q 180 150 195 140"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
      <path
        d="M 125 165 Q 140 170 155 165"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
      <path
        d="M 165 165 Q 180 170 200 165"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
    </svg>
  </div>
);

/* ── Main Scene ──────────────────────────────────────────── */

export const Scene02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Card pop-in. Spring 0.85 → 1. */
  const cardPop = spring({
    frame,
    fps,
    from: 0.85,
    to: 1,
    durationInFrames: 14,
  });
  const cardOpacity = interpolate(frame, [0, 6, 178, 188], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Brain phase. The cloud arrives first, the head fills in last. */
  const brainSpring = spring({
    frame: Math.max(0, frame - 160),
    fps,
    from: 0.5,
    to: 1,
    durationInFrames: 16,
  });
  const brainOpacity = interpolate(frame, [160, 168], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headOpacity = interpolate(frame, [178, 184], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brainDriftY = interpolate(frame, [180, 188], [0, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brainEndOpacity = interpolate(frame, [184, 190], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const overallBrainOpacity = brainOpacity * brainEndOpacity;

  /* All AnimatedText reveals share the same feature anchor inside the card. */
  const featureAnchor: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 720,
    height: 260,
    transform: "translate(-50%, -50%)",
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Card frame */}
      <div
        style={{
          width: "84%",
          height: "80%",
          borderRadius: 28,
          backgroundColor: "#fff",
          boxShadow: "0 12px 60px rgba(0,0,0,0.08)",
          opacity: cardOpacity,
          transform: `scale(${cardPop})`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Every feature lives inside this anchor. Icons and their text enter and leave together. */}
        <div style={featureAnchor}>
          {/* 1 — Thousands of trades */}
          <AnimatedText
            text="Thousands of trades"
            highlightLastN={1}
            iconStartFrame={4}
            iconRiseFrame={12}
            startFrame={18}
            framesPerWord={6}
            fadeOutAt={42}
            fadeOutFrames={6}
            fontSize={50}
            icon={<CandlestickIcon size={90} />}
          />

          {/* 2 — Hundreds of agents */}
          <AnimatedText
            text="Hundreds of agents"
            highlightLastN={1}
            iconStartFrame={50}
            iconRiseFrame={58}
            startFrame={64}
            framesPerWord={6}
            fadeOutAt={86}
            fadeOutFrames={6}
            fontSize={50}
            iconRisePx={120}
            icon={<ModelCircles />}
          />

          {/* 3 — Patterns */}
          <AnimatedText
            text="Patterns"
            highlightLastN={1}
            iconStartFrame={94}
            iconRiseFrame={102}
            startFrame={108}
            framesPerWord={6}
            fadeOutAt={124}
            fadeOutFrames={6}
            fontSize={54}
            icon={<NetworkNodes />}
          />

          {/* 4 — Timing */}
          <AnimatedText
            text="Timing"
            highlightLastN={1}
            iconStartFrame={128}
            iconRiseFrame={134}
            startFrame={140}
            framesPerWord={6}
            fadeOutAt={154}
            fadeOutFrames={6}
            fontSize={54}
            icon={<StopwatchIcon />}
          />

          {/* 5 — Position Sizing */}
          <AnimatedText
            text="Position Sizing"
            highlightLastN={1}
            iconStartFrame={158}
            iconRiseFrame={164}
            startFrame={170}
            framesPerWord={6}
            fadeOutAt={186}
            fadeOutFrames={6}
            fontSize={50}
            icon={<MoneyBagIcon />}
          />

          {/* 6 — Manipulation Signals */}
          <AnimatedText
            text="Manipulation Signals"
            highlightLastN={1}
            iconStartFrame={190}
            iconRiseFrame={196}
            startFrame={202}
            framesPerWord={6}
            fadeOutAt={220}
            fadeOutFrames={6}
            fontSize={50}
            icon={<AlertCircleIcon />}
          />
        </div>

        {/* Brain + head silhouette. Its own element, outside the text flow. */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${brainDriftY}px)) scale(${brainSpring})`,
            opacity: overallBrainOpacity,
            zIndex: 5,
          }}
        >
          <BrainHeadIcon headOpacity={headOpacity} brainScale={1} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const scene02Meta = {
  id: "Council-Scene02",
  component: Scene02,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 190,
};
