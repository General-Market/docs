import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";

// ---------------------------------------------------------------------------
// Timing helpers — all values in local seconds (this component starts at 0)
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

const TITLE_IN = sec(0.16);
const TITLE_OUT = sec(3.44);

const BULLETS_IN = sec(11.28);
const BULLETS_OUT = sec(22.24);
const BULLET_STAGGER = sec(0.3);

const AUDIENCE_IN = sec(36.4);
const AUDIENCE_OUT = sec(41.76);

const LETS_START_IN = sec(41.76);
const LETS_START_OUT = sec(42.8);

// ---------------------------------------------------------------------------
// CountdownTimer — exported for placement at full video duration
// ---------------------------------------------------------------------------

export const CountdownTimer: React.FC<{
  totalDurationFrames: number;
}> = ({ totalDurationFrames }) => {
  const frame = useCurrentFrame();

  const totalSeconds = 5 * 60; // 5:00
  const progress = Math.min(frame / totalDurationFrames, 1);
  const remaining = Math.max(totalSeconds - Math.floor(progress * totalSeconds), 0);
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const enterOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulse when under 30s
  const pulse = remaining <= 30 && remaining > 0
    ? 1 + 0.03 * Math.sin(frame * 0.3)
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 48,
        opacity: enterOpacity,
        transform: `scale(${pulse})`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          background: "rgba(10, 10, 10, 0.7)",
          borderRadius: 8,
          padding: "8px 16px",
          fontFamily: monoFont,
          fontSize: 26,
          fontWeight: 700,
          color: remaining <= 30 ? "#ff6b6b" : "#fafafa",
          letterSpacing: 2,
        }}
      >
        {display}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Title card
// ---------------------------------------------------------------------------

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = TITLE_OUT - TITLE_IN;

  const enterScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(
    frame,
    [duration - 12, duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const opacity = Math.min(enterOpacity, exitOpacity);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "40px 72px",
          maxWidth: 1200,
          transform: `scale(${enterScale})`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 56,
            fontWeight: 800,
            color: "#fafafa",
            textAlign: "center",
            lineHeight: 1.2,
            letterSpacing: -1,
          }}
        >
          How to Launch Your First{" "}
          <span style={{ color: BRAND_GREEN }}>General Market</span> Bot in 5
          Minutes
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Promise bullets
// ---------------------------------------------------------------------------

const BULLETS = ["Liquidity", "Capital Lock", "Risk Management"] as const;

const PromiseBullets: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = BULLETS_OUT - BULLETS_IN;

  const exitOpacity = interpolate(
    frame,
    [duration - 15, duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: 160,
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "36px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {BULLETS.map((label, i) => {
          const bulletLocal = frame - i * BULLET_STAGGER;

          const slideX = spring({
            frame: Math.max(bulletLocal, 0),
            fps,
            config: { damping: 16, stiffness: 140, mass: 0.7 },
          });

          const bulletOpacity = interpolate(bulletLocal, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const x = interpolate(slideX, [0, 1], [-60, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={label}
              style={{
                fontFamily: monoFont,
                fontSize: 32,
                fontWeight: 500,
                color: "#fafafa",
                opacity: bulletOpacity,
                transform: `translateX(${x}px)`,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{"[ ]"}</span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Audience label
// ---------------------------------------------------------------------------

const AudienceLabel: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = AUDIENCE_OUT - AUDIENCE_IN;

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const exitOpacity = interpolate(
    frame,
    [duration - 10, duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const opacity = Math.min(enterOpacity, exitOpacity);

  const enterY = interpolate(frame, [0, 10], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 120,
        opacity,
        transform: `translateY(${enterY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "16px 40px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <LabelChip text="BEGINNER" />
        <div
          style={{
            width: 2,
            height: 28,
            background: "rgba(255,255,255,0.25)",
          }}
        />
        <LabelChip text="FUND MANAGER" />
      </div>
    </AbsoluteFill>
  );
};

const LabelChip: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      fontFamily: font,
      fontSize: 24,
      fontWeight: 700,
      color: "#fafafa",
      letterSpacing: 3,
      textTransform: "uppercase",
      borderBottom: `2px solid ${BRAND_GREEN}`,
      paddingBottom: 4,
    }}
  >
    {text}
  </div>
);

// ---------------------------------------------------------------------------
// "Let's start" flash
// ---------------------------------------------------------------------------

const LetsStartFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = LETS_START_OUT - LETS_START_IN;

  const scale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
  });

  const opacity = interpolate(frame, [duration - 6, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOpacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(enterOpacity, opacity),
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 72,
          fontWeight: 900,
          color: BRAND_GREEN,
          letterSpacing: 4,
          textTransform: "uppercase",
          transform: `scale(${scale})`,
        }}
      >
        Let&apos;s start.
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main overlay composition
// ---------------------------------------------------------------------------

export const HookOverlays: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Title card: 0.16s – 3.44s */}
      <Sequence from={TITLE_IN} durationInFrames={TITLE_OUT - TITLE_IN}>
        <TitleCard />
        <Audio src={staticFile("sfx/text-appear-blip.mp3")} volume={0.7} />
      </Sequence>

      {/* Promise bullets: 11.28s – 22.24s */}
      <Sequence from={BULLETS_IN} durationInFrames={BULLETS_OUT - BULLETS_IN}>
        <PromiseBullets />
        {BULLETS.map((_, i) => (
          <Sequence key={i} from={i * BULLET_STAGGER}>
            <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.5} />
          </Sequence>
        ))}
      </Sequence>

      {/* Audience label: 36.40s – 41.76s */}
      <Sequence from={AUDIENCE_IN} durationInFrames={AUDIENCE_OUT - AUDIENCE_IN}>
        <AudienceLabel />
      </Sequence>

      {/* "Let's start" flash: 41.76s – 42.80s */}
      <Sequence from={LETS_START_IN} durationInFrames={LETS_START_OUT - LETS_START_IN}>
        <LetsStartFlash />
        <Audio src={staticFile("sfx/cut-fast-swish.mp3")} volume={0.65} />
      </Sequence>
    </AbsoluteFill>
  );
};
