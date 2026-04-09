import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Dosis";
import { FPS, BRAND_GREEN } from "../theme";

// ── Font ────────────────────────────────────────────────────────────────────
const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["200", "600"],
});

// ── Types ───────────────────────────────────────────────────────────────────

interface Line {
  text: string;
  /** Delay in seconds from moment start */
  delay: number;
  /** Duration of the letter animation in seconds */
  duration: number;
  color: string;
  fontSize: number;
  fontWeight: 200 | 600;
}

interface Moment {
  /** Absolute start in seconds */
  at: number;
  /** Total hold duration in seconds */
  hold: number;
  lines: Line[];
  /** SFX to trigger (relative to moment start, in seconds) */
  sfx?: Array<{ file: string; at: number; volume: number }>;
}

// ── Moment definitions ──────────────────────────────────────────────────────

const MOMENTS: Moment[] = [
  // 1) "No orderbook. No price. Result at settlement."
  {
    at: 126.2,
    hold: 5,
    lines: [
      {
        text: "No orderbook.",
        delay: 0,
        duration: 1.8,
        color: "#fff",
        fontSize: 64,
        fontWeight: 200,
      },
      {
        text: "No price.",
        delay: 1.0,
        duration: 1.8,
        color: "#fff",
        fontSize: 64,
        fontWeight: 200,
      },
      {
        text: "Result at settlement.",
        delay: 2.0,
        duration: 2.2,
        color: BRAND_GREEN,
        fontSize: 64,
        fontWeight: 600,
      },
    ],
    sfx: [
      { file: "sfx/boom-cinematic.mp3", at: 1.0, volume: 0.45 },
    ],
  },

  // 2) "QUANTITY > QUALITY"
  {
    at: 212.12,
    hold: 4,
    lines: [
      {
        text: "QUANTITY > QUALITY",
        delay: 0,
        duration: 2.8,
        color: BRAND_GREEN,
        fontSize: 88,
        fontWeight: 600,
      },
    ],
    sfx: [
      { file: "sfx/drop-cinematic-hit.mp3", at: 0.0, volume: 0.5 },
    ],
  },

  // 3) "General Market" end card
  {
    at: 280.8,
    hold: 3,
    lines: [
      {
        text: "General Market",
        delay: 0,
        duration: 2.4,
        color: "#fff",
        fontSize: 80,
        fontWeight: 600,
      },
    ],
    sfx: [
      { file: "sfx/stinger-logo-reveal.mp3", at: 0.0, volume: 0.4 },
    ],
  },
];

// ── Letter animation (ported from OpeningSequence.tsx) ──────────────────────
//
// Original CSS keyframes:
//   0%:   rotateY(-90deg), letter-spacing 80px, opacity 0.2, shadow 50px
//   50%:  rotateY(0deg),   letter-spacing 14px, opacity 0.8, shadow 1px
//   85%:  translateZ(100px),                    opacity 0.8, shadow 1px
//   100%: translateZ(130px),                    opacity 0
//
// Adapted: the fade-out ramp (85-100%) is compressed so text stays readable
// longer within each moment's hold duration. We keep rotateY and converging
// spacing identical to the original.

function getLetterStyle(
  progress: number,
  color: string,
  fontSize: number,
  fontWeight: number,
): React.CSSProperties {
  const rotateY = interpolate(progress, [0, 0.5], [-90, 0], {
    extrapolateRight: "clamp",
  });

  const letterSpacing = interpolate(progress, [0, 0.5], [80, 14], {
    extrapolateRight: "clamp",
  });

  const translateZ = interpolate(progress, [0.5, 0.85, 1.0], [0, 100, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(
    progress,
    [0, 0.5, 0.85, 1.0],
    [0.2, 0.9, 0.9, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const shadowBlur = interpolate(
    progress,
    [0, 0.5, 0.85, 1.0],
    [50, 1, 1, 10],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return {
    display: "inline-block",
    fontFamily,
    fontSize,
    fontWeight,
    textTransform: "uppercase",
    color: "hsla(0,0%,0%,0)",
    opacity,
    letterSpacing,
    textShadow: `0 0 ${shadowBlur}px ${color}`,
    transform: `rotateY(${rotateY}deg) translateZ(${translateZ}px)`,
    transformStyle: "preserve-3d",
    transformOrigin: "50% 50%",
    whiteSpace: "nowrap",
  };
}

// ── Animated letter ─────────────────────────────────────────────────────────

const AnimatedLetter: React.FC<{
  char: string;
  progress: number;
  color: string;
  fontSize: number;
  fontWeight: number;
}> = ({ char, progress, color, fontSize, fontWeight }) => {
  return (
    <span style={getLetterStyle(progress, color, fontSize, fontWeight)}>
      {char}
    </span>
  );
};

// ── Single animated line ────────────────────────────────────────────────────

const AnimatedLine: React.FC<{
  line: Line;
}> = ({ line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayFrames = Math.round(line.delay * fps);
  const durationFrames = Math.round(line.duration * fps);
  const localFrame = frame - delayFrames;

  if (localFrame < -2 || localFrame > durationFrames + 5) return null;

  const progress = interpolate(
    localFrame,
    [0, durationFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const words = line.text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        perspective: 600,
      }}
    >
      {words.map((word, wi) => (
        <span
          key={wi}
          style={{
            margin: "0 12px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {Array.from(word).map((char, ci) => (
            <span
              key={ci}
              style={{
                display: "inline-block",
                perspective: 1000,
                transformOrigin: "50% 50%",
              }}
            >
              <AnimatedLetter
                char={char}
                progress={progress}
                color={line.color}
                fontSize={line.fontSize}
                fontWeight={line.fontWeight}
              />
            </span>
          ))}
        </span>
      ))}
    </div>
  );
};

// ── Single moment (backdrop + lines + SFX) ──────────────────────────────────

const MomentOverlay: React.FC<{
  moment: Moment;
}> = ({ moment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const holdFrames = Math.round(moment.hold * fps);

  // Backdrop fade: in over 0.4s, out over 0.4s
  const fadeIn = Math.round(0.4 * fps);
  const fadeOut = Math.round(0.4 * fps);
  const backdropOpacity = interpolate(
    frame,
    [0, fadeIn, holdFrames - fadeOut, holdFrames],
    [0, 0.88, 0.88, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      {/* Dark backdrop */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(10, 10, 10, ${backdropOpacity})`,
        }}
      />

      {/* Centered text stack */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
        }}
      >
        {moment.lines.map((line, i) => (
          <AnimatedLine key={i} line={line} />
        ))}
      </AbsoluteFill>

      {/* SFX triggers */}
      {moment.sfx?.map((sfx, i) => (
        <Sequence key={`sfx-${i}`} from={Math.round(sfx.at * fps)}>
          <Audio
            src={staticFile(sfx.file)}
            volume={sfx.volume}
            startFrom={0}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ── Full-duration overlay ───────────────────────────────────────────────────

export const OpeningSequenceText: React.FC = () => {
  return (
    <AbsoluteFill>
      {MOMENTS.map((moment, i) => {
        const startFrame = Math.round(moment.at * FPS);
        // Extra buffer so the translateZ drift + fade-out completes
        const durationFrames = Math.round(moment.hold * FPS) + 15;

        return (
          <Sequence
            key={`moment-${i}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <MomentOverlay moment={moment} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
