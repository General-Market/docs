import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { font } from "../../common/fonts";
import { AntiCheatHookHalfScene } from "./AntiCheatHookHalfScene";
import { DotGrid } from "./DotGrid";
import { FPS, H, W, colors } from "./theme";

// Two half-canvas mini-scenes form the hook. Scene B slides in from above
// while Scene A scrolls out the bottom — the standard channel-change
// transition. Inside that scroll, the phone executes a roll evasion: it
// counter-translates Y to ignore the scroll, banks right with a fast Y-
// axis spin (barrel roll), and clears the frame independently of the
// rest of Scene A. The text and dot-field still ride the scroll.
//
//   Scene A  64f   phone right  · "Why trading against insider traders ?"
//   Scene B  63f   laptop left  · "When gaming Anti-Cheats ban wall hackers"
const SCENE_A_DURATION = 64;
const SCENE_B_DURATION = 63;
const T_TRANSITION = 15;
const HOOK_DURATION = SCENE_A_DURATION + SCENE_B_DURATION - T_TRANSITION;

const BROLL = {
  // Wall-hack broll reads as "wall hackers" instantly — the only cheat
  // footage the laptop scene needs.
  valorant: staticFile("cheat-broll/valorant-wallhack.mp4"),
  // Binance positions screen with the "14000$ profit" overlay painted
  // out in a dark-navy box so only the trading UI reads. Source is a
  // YouTube short pre-processed at 3× speed via ffmpeg. Plays on the
  // phone's screen instead of the hand-drawn chart.
  insiderTrading: staticFile("cheat-broll/insider-trading-clean.mp4"),
};

export type BrollSegment = {
  url: string;
  from: number;
  durationInFrames: number;
  startFrom: number;
};

const PHONE_SEGMENTS: BrollSegment[] = [
  {
    url: BROLL.insiderTrading,
    from: 0,
    durationInFrames: SCENE_A_DURATION,
    startFrom: 0,
  },
];
const LAPTOP_SEGMENTS: BrollSegment[] = [
  {
    url: BROLL.valorant,
    from: 0,
    durationInFrames: SCENE_B_DURATION,
    startFrom: 0,
  },
];

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const AntiCheatHook: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <DotGrid />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_A_DURATION}>
          <QuestionScene
            device="phone"
            devicePosition="right"
            question="Why trading against insider traders ?"
            questionTint="#E03B4A"
            segments={PHONE_SEGMENTS}
            brollAspect={1080 / 1920}
            sceneDuration={SCENE_A_DURATION}
            evadeOnExit
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-top" })}
          timing={linearTiming({ durationInFrames: T_TRANSITION })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENE_B_DURATION}>
          <QuestionScene
            device="laptop"
            devicePosition="left"
            question="When in 2026 gaming Anti-Cheats ban wall hackers"
            segments={LAPTOP_SEGMENTS}
            sceneDuration={SCENE_B_DURATION}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

// ─── Question scene — half device, half question ───────────────────────────────
//
// `evadeOnExit` (phone scene only): during the final T_TRANSITION frames
// of the scene, the device div counter-translates Y to negate the slide
// presentation's downward push, banks right, and the device itself spins
// fast on its Y axis in three.js. The text and bg ride the scroll
// normally; only the device peels off.

const QuestionScene: React.FC<{
  device: "laptop" | "phone";
  devicePosition: "left" | "right";
  question: string;
  questionTint?: string;
  segments: BrollSegment[];
  brollAspect?: number;
  sceneDuration: number;
  evadeOnExit?: boolean;
}> = ({
  device,
  devicePosition,
  question,
  questionTint,
  segments,
  brollAspect = 16 / 9,
  sceneDuration,
  evadeOnExit = false,
}) => {
  const frame = useCurrentFrame();
  const isDeviceRight = devicePosition === "right";

  const exitT = evadeOnExit
    ? clamp01((frame - (sceneDuration - T_TRANSITION)) / T_TRANSITION)
    : 0;
  const exitEased = exitT * exitT;

  // Counter-translate Y to neutralize the slide presentation pushing the
  // whole scene down by `exitT * 100%`. With this counter on the device
  // div alone, the device stays put vertically while the rest of Scene A
  // (text, bg) scrolls out the bottom normally.
  const counterY = -exitT * 100; // percent of own height
  const exitX = exitEased * W * 1.05; // overshoot a touch off the right edge

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
      }}
    >
      <div
        style={{
          width: W / 2,
          height: H,
          position: "relative",
          overflow: "hidden",
          order: isDeviceRight ? 0 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: isDeviceRight ? "flex-end" : "flex-start",
          padding: "0 56px",
        }}
      >
        <QuestionText
          text={question}
          align={isDeviceRight ? "right" : "left"}
          tint={questionTint}
        />
      </div>

      <div
        style={{
          width: W / 2,
          height: H,
          position: "relative",
          order: isDeviceRight ? 1 : 0,
          transform: evadeOnExit
            ? `translate(${exitX.toFixed(2)}px, ${counterY.toFixed(2)}%)`
            : undefined,
          willChange: evadeOnExit ? "transform" : undefined,
        }}
      >
        <AntiCheatHookHalfScene
          device={device}
          segments={segments}
          brollAspect={brollAspect}
          width={W / 2}
          height={H}
          emissiveIntensity={0.7}
          lightingIntensity={0.7}
          exitProgress={exitT}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Question text ─────────────────────────────────────────────────────────────

const QuestionText: React.FC<{
  text: string;
  align: "left" | "right";
  tint?: string;
}> = ({ text, align, tint }) => {
  return (
    <div
      style={{
        textAlign: align,
        fontFamily: font,
        fontSize: 124,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        color: tint ?? colors.fg,
        lineHeight: 1.02,
      }}
    >
      {text}
    </div>
  );
};

export const antiCheatHookMeta = {
  id: "AntiCheatHook",
  component: AntiCheatHook,
  durationInFrames: HOOK_DURATION,
  fps: FPS,
  width: W,
  height: H,
};
