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
const TEAL = "#4ECDC4";
const DARK = "#1A1A2E";
const GPT_GREEN = "#10A37F";
const GEMINI_BLUE = "#4285F4";
const OPUS_ORANGE = "#E07B39";

const useTypewriter = (text: string, startFrame: number, charsPerFrame = 0.6) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  return text.slice(0, charCount);
};

/* Simplified OpenAI knot icon */
const OpenAIIcon: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <path
      d="M30 10C22 10 16 16 16 24C16 28 18 31 21 33L21 42C21 44.2 22.8 46 25 46H35C37.2 46 39 44.2 39 42L39 33C42 31 44 28 44 24C44 16 38 10 30 10Z"
      stroke="white"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M25 33L25 22L35 28L25 33Z" fill="white" opacity={0.8} />
    <line x1="25" y1="38" x2="35" y2="38" stroke="white" strokeWidth="2" />
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
    enterFrame: 60,
  },
  {
    color: GEMINI_BLUE,
    Icon: GeminiStar,
    label: "Gemini 3.1 Pro",
    enterFrame: 64,
  },
  {
    color: OPUS_ORANGE,
    Icon: OpusSunburst,
    label: "Opus 4.6",
    enterFrame: 68,
  },
];

export const Scene03: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: "We built" typewriter (8-22)
  const builtText = useTypewriter("We built", 8, 0.6);

  // Phase 2: "AI Council" fade-in (20-32)
  const aiOpacity = interpolate(frame, [20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const aiY = interpolate(frame, [20, 32], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3: hold then fade out (32-52)
  const textOpacity = interpolate(frame, [48, 54], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card label fade — appears ~10 frames after each card lands
  const labelDelay = 10;

  // Subtitle: "Each model processing independently" (78-110)
  const wordEntries: { text: string; start: number; color: string }[] = [
    { text: "Each", start: 80, color: DARK },
    { text: "model", start: 86, color: DARK },
    { text: "processing", start: 92, color: DARK },
    { text: "independently", start: 100, color: TEAL },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Text phase: "We built AI Council" — single line */}
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

      {/* Cards phase */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, calc(-50% - 40px))",
          display: "flex",
          gap: 36,
          alignItems: "flex-start",
        }}
      >
        {CARDS.map(({ color, Icon, label, enterFrame }, idx) => {
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
                  width: 124,
                  height: 124,
                  borderRadius: 18,
                  backgroundColor: color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={64} />
              </div>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  opacity: labelOpacity,
                  lineHeight: 1.3,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Subtitle: "Each model processing independently" — single line */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, 130px)",
          display: "flex",
          gap: 10,
          whiteSpace: "nowrap",
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
                fontSize: 30,
                fontWeight: 700,
                color,
                opacity: frame >= start ? wordOpacity : 0,
                transform: `translateY(${frame >= start ? wordY : 12}px)`,
                display: "inline-block",
                whiteSpace: "nowrap",
              }}
            >
              {text}
            </span>
          );
        })}
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
  durationInFrames: 138,
};
