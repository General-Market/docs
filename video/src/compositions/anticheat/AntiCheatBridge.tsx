import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { FPS, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom } from "./vibe";

// Bridge holds the "But that's not all..." reveal. The emoji burst
// already happened in Reassure (fired by the click) and rode the
// panel exit out of frame. By the time Bridge starts, the canvas
// is cleared and only the words land.
const SCENE_SECONDS = 4;
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

const WORDS_AT = toFrames(0.35);
const WORD_STAGGER = toFrames(0.18);
const ALL_AT = WORDS_AT + WORD_STAGGER * 3;
const DOTS_AT = ALL_AT + toFrames(0.35);
const DOT_STAGGER = toFrames(0.16);

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
        <Phrase />
        <DotGridVignette intensity={0.18} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

const Phrase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const groupFade = interpolate(
    frame,
    [WORDS_AT - toFrames(0.2), WORDS_AT + toFrames(0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
  const start = index === 3 ? ALL_AT : WORDS_AT + index * WORD_STAGGER;
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
