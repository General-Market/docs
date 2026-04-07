import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();
const TEAL = "#0FE8AE";
const DARK = "#000000";
const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";

const useTypewriter = (text: string, startFrame: number, charsPerFrame = 0.6) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  return text.slice(0, charCount);
};

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
      {/* Top arc */}
      <path d="M19 20 A13 13 0 0 1 41 20" />
      {/* Upper-right arc */}
      <path d="M44 22 A13 13 0 0 1 41 44" />
      {/* Lower-right arc */}
      <path d="M41 47 A13 13 0 0 1 19 47" />
      {/* Bottom arc */}
      <path d="M16 44 A13 13 0 0 1 19 22" />
      {/* Inner interlock — two short bars echoing the knot crossings */}
      <path d="M30 17 L30 28" />
      <path d="M30 32 L30 43" />
    </g>
  </svg>
);

/* Four-pointed star for Gemini */
const GeminiStar: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <path
      d="M30 6L34 24L52 30L34 36L30 54L26 36L8 30L26 24Z"
      fill="white"
    />
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

const CARDS = [
  {
    color: GPT_GREEN,
    Icon: OpenAIIcon,
    label: "GPT 5.4",
    allowWrap: false,
    enterFrame: 110,
  },
  {
    color: GEMINI_BLUE,
    Icon: GeminiStar,
    label: "Gemini 3.1 Pro",
    allowWrap: true,
    enterFrame: 114,
  },
  {
    color: OPUS_ORANGE,
    Icon: OpusSunburst,
    label: "Opus 4.6",
    allowWrap: false,
    enterFrame: 118,
  },
];

export const Scene03: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /*
   * 200-frame budget
   * 0-30   : "We built AI Council" typewriter
   * 30-90  : hold
   * 90-100 : fade out
   * 100-110: blank
   * 110-130: cards spring in
   * 130-150: cards full size, hold
   * 150-180: subtitle word-by-word
   * 180-195: hold
   * 195-200: fade
   */

  // Phase 1: "We built" typewriter (0-14)
  const builtText = useTypewriter("We built", 0, 0.6);

  // Phase 2: "AI Council" fade-in (14-30)
  const aiOpacity = interpolate(frame, [14, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const aiY = interpolate(frame, [14, 26], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3: hold then fade (30-100)
  const textOpacity = interpolate(frame, [90, 100], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card label fade — appears ~10 frames after each card lands
  const labelDelay = 10;

  // Subtitle word entries (start after cards full at 150)
  const wordEntries: { text: string; start: number; color: string }[] = [
    { text: "Each", start: 150, color: DARK },
    { text: "model", start: 156, color: DARK },
    { text: "processing", start: 162, color: DARK },
    { text: "independently", start: 172, color: TEAL },
  ];

  // Whole-row fade at the end (195-200)
  const tailFade = interpolate(frame, [195, 200], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Phase 1-3: "We built AI Council" — single line, centered */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          opacity: textOpacity,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: DARK,
            whiteSpace: "pre",
          }}
        >
          {builtText}
        </span>
        <span
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: TEAL,
            opacity: aiOpacity,
            transform: `translateY(${aiY}px)`,
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          AI Council
        </span>
      </div>

      {/* Phase 4-7: cards + inline subtitle as a single horizontal row */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 56,
          opacity: tailFade,
        }}
      >
        {/* Inline subtitle, left of the cards */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            maxWidth: 280,
            columnGap: 10,
            rowGap: 4,
            alignItems: "baseline",
          }}
        >
          {wordEntries.map(({ text, start, color }, i) => {
            const wordY = spring({
              frame: frame - start,
              fps,
              from: 12,
              to: 0,
              config: { damping: 14, stiffness: 140, mass: 0.6 },
            });
            const wordOpacity = interpolate(frame, [start, start + 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color,
                  opacity: frame >= start ? wordOpacity : 0,
                  transform: `translateY(${frame >= start ? wordY : 12}px)`,
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  lineHeight: 1.25,
                }}
              >
                {text}
              </span>
            );
          })}
        </div>

        {/* Three cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 78,
            alignItems: "flex-start",
          }}
        >
          {CARDS.map(({ color, Icon, label, allowWrap, enterFrame }, idx) => {
            const cardScale = spring({
              frame: frame - enterFrame,
              fps,
              from: 0.15,
              to: 1,
              config: { damping: 13, stiffness: 130, mass: 0.85 },
            });

            const labelOpacity = interpolate(
              frame,
              [enterFrame + labelDelay, enterFrame + labelDelay + 8],
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
                  transform: `scale(${frame >= enterFrame ? cardScale : 0})`,
                }}
              >
                <div
                  style={{
                    width: 108,
                    height: 108,
                    borderRadius: 18,
                    backgroundColor: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={56} />
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color,
                    textAlign: "center",
                    whiteSpace: allowWrap ? "normal" : "nowrap",
                    opacity: labelOpacity,
                    lineHeight: 1.3,
                    maxWidth: allowWrap ? 80 : undefined,
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
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
