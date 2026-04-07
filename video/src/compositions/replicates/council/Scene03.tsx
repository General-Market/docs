import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import {
  AnimatedText,
  COUNCIL_DARK,
  COUNCIL_TEAL,
  COUNCIL_TITLE_FONT_SIZE,
} from "./AnimatedText";

const { fontFamily } = loadFont();
const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";

/* OpenAI woven knot — interlocking ring composed of six arcs */
const OpenAIIcon: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <g
      stroke="white"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d="M19 20 A13 13 0 0 1 41 20" />
      <path d="M44 22 A13 13 0 0 1 41 44" />
      <path d="M41 47 A13 13 0 0 1 19 47" />
      <path d="M16 44 A13 13 0 0 1 19 22" />
      <path d="M30 17 L30 28" />
      <path d="M30 32 L30 43" />
    </g>
  </svg>
);

/* Four-pointed star for Gemini */
const GeminiStar: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <path d="M30 6L34 24L52 30L34 36L30 54L26 36L8 30L26 24Z" fill="white" />
  </svg>
);

/* Sunburst / asterisk for Opus */
const OpusSunburst: React.FC<{ size?: number }> = ({ size = 60 }) => {
  const cx = 30;
  const cy = 30;
  const rays = 8;
  const inner = 8;
  const outer = 24;
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      {Array.from({ length: rays }).map((_, i) => {
        const angle = (i * Math.PI * 2) / rays;
        const x1 = cx + Math.cos(angle) * inner;
        const y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer;
        const y2 = cy + Math.sin(angle) * outer;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={6} fill="white" />
    </svg>
  );
};

type CardDef = {
  color: string;
  Icon: React.FC<{ size?: number }>;
  label: string;
  allowWrap: boolean;
};

const CARDS: CardDef[] = [
  { color: GPT_GREEN, Icon: OpenAIIcon, label: "GPT 5.4", allowWrap: false },
  { color: GEMINI_BLUE, Icon: GeminiStar, label: "Gemini 3.1 Pro", allowWrap: true },
  { color: OPUS_ORANGE, Icon: OpusSunburst, label: "Opus 4.6", allowWrap: false },
];

const CardRow: React.FC<{ frame: number; labelStartFrame: number }> = ({
  frame,
  labelStartFrame,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 60,
        alignItems: "flex-start",
      }}
    >
      {CARDS.map(({ color, Icon, label, allowWrap }, idx) => {
        const labelOpacity = interpolate(
          frame,
          [labelStartFrame, labelStartFrame + 8],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 24,
                backgroundColor: color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={72} />
            </div>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color,
                textAlign: "center",
                whiteSpace: allowWrap ? "normal" : "nowrap",
                opacity: labelOpacity,
                lineHeight: 1.3,
                maxWidth: allowWrap ? 120 : undefined,
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const Scene03: React.FC = () => {
  const frame = useCurrentFrame();

  /*
   * 200-frame budget
   * 0-100  : "We built AI Council" — AnimatedText reveal, hold, fade out
   * 110    : card row fades in at top: 40%
   * 150    : "Each model processing independently" — AnimatedText reveal at top: 75%
   * 195-200: whole block fades
   */

  const cardsOpacity = interpolate(frame, [108, 124], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardsRise = interpolate(frame, [108, 124], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardsFadeOut = interpolate(frame, [195, 200], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        fontFamily,
      }}
    >
      <AnimatedText
        text="We built AI Council"
        highlightLastN={2}
        startFrame={0}
        fadeOutAt={90}
        fadeOutFrames={10}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        fontWeight={700}
        color={COUNCIL_DARK}
        highlightColor={COUNCIL_TEAL}
      />

      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: `translate(-50%, calc(-50% + ${cardsRise}px))`,
          opacity: cardsOpacity * cardsFadeOut,
        }}
      >
        <CardRow frame={frame} labelStartFrame={124} />
      </div>

      <AnimatedText
        text="Each model processing independently"
        highlightLastN={1}
        startFrame={150}
        fadeOutAt={195}
        fadeOutFrames={5}
        framesPerWord={6}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        fontWeight={700}
        color={COUNCIL_DARK}
        highlightColor={COUNCIL_TEAL}
        style={{ top: "50%" }}
      />
    </AbsoluteFill>
  );
};

export const scene03Meta = {
  id: "Council-Scene03",
  component: Scene03,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 200,
};
