import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { font } from "../../common/fonts";
import { FPS, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom } from "./vibe";

const SCENE_SECONDS = 5.5;
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

// Emoji burst happens first; the words land while the emojis exit.
const BURST_AT = toFrames(0.15);
const BURST_FADE_AT = toFrames(2.4);
const BURST_GONE_AT = toFrames(3.0);
const WORDS_AT = toFrames(2.3);
const WORD_STAGGER = toFrames(0.18);
const ALL_AT = WORDS_AT + WORD_STAGGER * 3;
const DOTS_AT = ALL_AT + toFrames(0.35);
const DOT_STAGGER = toFrames(0.16);

// Same emoji vocabulary as GMBrand Scene04: hearts, party, dog, heart-eyes.
// The animation is what carries — the emoji choice is incidental.
const HEART_EYES = String.fromCodePoint(0x1f60d);
const DOG_FACE = String.fromCodePoint(0x1f436);
const RED_HEART = String.fromCodePoint(0x2764, 0xfe0f);
const PARTY = String.fromCodePoint(0x1f973);

type EmojiSeed = {
  emoji: string;
  endX: number;
  endY: number;
  size: number;
  seed: number;
  arcHeight: number;
};

// Endpoints scaled up for the 1920×1080 canvas (Scene04 was 1280×720).
const FLOATING_EMOJIS: EmojiSeed[] = [
  { emoji: HEART_EYES, endX: -380, endY: -260, size: 108, seed: 1, arcHeight: 180 },
  { emoji: PARTY, endX: -320, endY: -110, size: 100, seed: 2, arcHeight: 140 },
  { emoji: DOG_FACE, endX: -340, endY: 240, size: 70, seed: 3, arcHeight: 90 },
  { emoji: RED_HEART, endX: 430, endY: 80, size: 96, seed: 4, arcHeight: 200 },
  { emoji: RED_HEART, endX: 480, endY: 220, size: 84, seed: 5, arcHeight: 150 },
  { emoji: RED_HEART, endX: 410, endY: 350, size: 72, seed: 6, arcHeight: 120 },
  { emoji: RED_HEART, endX: 360, endY: -180, size: 64, seed: 7, arcHeight: 230 },
  { emoji: HEART_EYES, endX: 340, endY: -320, size: 76, seed: 8, arcHeight: 200 },
  { emoji: DOG_FACE, endX: -250, endY: -380, size: 56, seed: 9, arcHeight: 170 },
  { emoji: PARTY, endX: -440, endY: 90, size: 80, seed: 10, arcHeight: 150 },
];

const quadBezier = (t: number, p0: number, p1: number, p2: number) => {
  const m = 1 - t;
  return m * m * p0 + 2 * m * t * p1 + t * t * p2;
};

export const AntiCheatBridge: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.025}>
        <DotGrid />
        <EmojiBurst />
        <Phrase />
        <DotGridVignette intensity={0.18} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── Emoji burst — same launch+settle+exit pattern as Scene04 ─────────────

const EmojiBurst: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Whole-group exit: scale down + fade as the words land.
  const groupFade = interpolate(
    frame,
    [BURST_FADE_AT, BURST_GONE_AT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const groupScale = interpolate(
    frame,
    [BURST_FADE_AT, BURST_GONE_AT],
    [1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (groupFade <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        opacity: groupFade,
        transform: `scale(${groupScale})`,
        transformOrigin: "center center",
      }}
    >
      {FLOATING_EMOJIS.map((item, i) => (
        <FloatingEmoji
          key={i}
          {...item}
          frame={frame}
          fps={fps}
          startFrame={BURST_AT + i * 2}
        />
      ))}
    </AbsoluteFill>
  );
};

const FloatingEmoji: React.FC<
  EmojiSeed & { frame: number; fps: number; startFrame: number }
> = ({ emoji, endX, endY, size, seed, arcHeight, frame, fps, startFrame }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const pathT = interpolate(localFrame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const controlX = endX * 0.3 + (seed % 2 === 0 ? -1 : 1) * arcHeight * 0.4;
  const controlY = endY * 0.3 - arcHeight;
  const x = quadBezier(pathT, 0, controlX, endX);
  const y = quadBezier(pathT, 0, controlY, endY);

  const scaleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 6, stiffness: 120, mass: 0.4 },
  });
  const floatScale = 1 + Math.sin(localFrame * 0.08 + seed) * 0.06;
  const settled = pathT >= 0.99;
  const noiseX = settled ? noise2D("acbX" + seed, localFrame * 0.02, seed) * 8 : 0;
  const noiseY = settled ? noise2D("acbY" + seed, localFrame * 0.015, seed) * 5 : 0;

  const launchSpin =
    interpolate(pathT, [0, 1], [0, (seed % 2 === 0 ? 1 : -1) * (15 + seed * 3)], {
      extrapolateRight: "clamp",
    });
  const wobble = Math.sin(localFrame * 0.1 + seed * 2) * 4;
  const rotation = pathT < 0.95 ? launchSpin : wobble;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(${x + noiseX}px, ${y + noiseY}px) scale(${scaleSpring * floatScale}) rotate(${rotation}deg)`,
        fontSize: size,
        opacity: Math.min(scaleSpring * 1.5, 1),
        filter: "drop-shadow(2px 4px 8px rgba(10,10,12,0.10))",
        pointerEvents: "none",
      }}
    >
      {emoji}
    </div>
  );
};

// ─── "But that's not all..." — staggered word + colored dots ──────────────

const Phrase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const groupFade = interpolate(
    frame,
    [WORDS_AT - toFrames(0.2), WORDS_AT + toFrames(0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Tail-out so the snap into EndCard isn't fighting a fully-lit phrase.
  const exit = interpolate(
    frame,
    [SCENE_FRAMES - toFrames(0.8), SCENE_FRAMES],
    [1, 0.4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: groupFade * exit,
      }}
    >
      <div
        style={{
          fontSize: 132,
          fontWeight: 600,
          letterSpacing: -1.4,
          color: colors.fg,
          display: "flex",
          alignItems: "baseline",
          gap: 22,
        }}
      >
        {["But", "that’s", "not"].map((word, i) => (
          <Word key={i} word={word} index={i} frame={frame} fps={fps} />
        ))}
        <Word word="all" index={3} frame={frame} fps={fps} accent />
        <Dots frame={frame} fps={fps} />
      </div>
    </AbsoluteFill>
  );
};

const Word: React.FC<{
  word: string;
  index: number;
  frame: number;
  fps: number;
  accent?: boolean;
}> = ({ word, index, frame, fps, accent }) => {
  const start = (index === 3 ? ALL_AT : WORDS_AT + index * WORD_STAGGER);
  const local = frame - start;

  const reveal = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 130, mass: 0.7 },
  });
  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(reveal, [0, 1], [42, 0]);
  const x = interpolate(reveal, [0, 1], [24, 0]);

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translate(${x}px, ${y}px)`,
        color: accent ? colors.accent : colors.fg,
      }}
    >
      {word}
    </span>
  );
};

const Dots: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const tones = [colors.accent, colors.accentSoft, colors.fgSoft];
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 4,
        marginLeft: -4,
        alignItems: "baseline",
      }}
    >
      {tones.map((tone, i) => {
        const local = frame - (DOTS_AT + i * DOT_STAGGER);
        const pop = spring({
          frame: local,
          fps,
          config: { damping: 8, stiffness: 180, mass: 0.5 },
        });
        const opacity = interpolate(local, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontSize: 132,
              fontWeight: 700,
              color: tone,
              transformOrigin: "center bottom",
              transform: `scale(${pop})`,
              opacity,
            }}
          >
            .
          </span>
        );
      })}
    </span>
  );
};

export const antiCheatBridgeMeta = {
  id: "AntiCheatBridge",
  component: AntiCheatBridge,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: 1920,
  height: 1080,
};
