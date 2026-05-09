import React from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font } from "../../common/fonts";
import { AntiCheatHookHalfScene } from "./AntiCheatHookHalfScene";
import { DotGrid } from "./DotGrid";
import { FPS, H, W, colors } from "./theme";

// Two half-canvas mini-scenes form the hook. Scene A's phone exits by
// flying right and spinning fast on itself — three.js carries the spin
// while CSS carries the translate. Scene B slides in from above, covering
// Scene A's leftover text on the left as it lands. Frame 0 is already
// settled (no entry anim) so the viewer hits the question immediately.
//
//   Scene A  64f   phone right  · "Why trading against insider traders ?"
//   Scene B  63f   laptop left  · "When gaming Anti-Cheats ban wall hackers"
const SCENE_A_DURATION = 64;
const SCENE_B_DURATION = 63;
const T_TRANSITION = 15;
const HOOK_DURATION = SCENE_A_DURATION + SCENE_B_DURATION - T_TRANSITION;
const TRANSITION_START = SCENE_A_DURATION - T_TRANSITION; // 49

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

      <Sequence from={0} durationInFrames={SCENE_A_DURATION} layout="none">
        <QuestionScene
          device="phone"
          devicePosition="right"
          question="Why trading against insider traders ?"
          questionTint="#E03B4A"
          segments={PHONE_SEGMENTS}
          brollAspect={1080 / 1920}
          exitWindowStart={TRANSITION_START}
        />
      </Sequence>

      <Sequence
        from={TRANSITION_START}
        durationInFrames={SCENE_B_DURATION}
        layout="none"
      >
        <QuestionScene
          device="laptop"
          devicePosition="left"
          question="When gaming Anti-Cheats ban wall hackers"
          segments={LAPTOP_SEGMENTS}
          entryWindow={T_TRANSITION}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Question scene — half device, half question ───────────────────────────────
// `exitWindowStart` (phone scene): scene-local frame at which the phone
//   begins flying right and spinning. Defaults to never.
// `entryWindow` (laptop scene): number of scene-local frames the whole
//   scene takes to slide in from above. Defaults to 0 (instant).

const QuestionScene: React.FC<{
  device: "laptop" | "phone";
  devicePosition: "left" | "right";
  question: string;
  questionTint?: string;
  segments: BrollSegment[];
  brollAspect?: number;
  exitWindowStart?: number;
  entryWindow?: number;
}> = ({
  device,
  devicePosition,
  question,
  questionTint,
  segments,
  brollAspect = 16 / 9,
  exitWindowStart,
  entryWindow = 0,
}) => {
  const frame = useCurrentFrame();
  const isDeviceRight = devicePosition === "right";

  const exitT =
    exitWindowStart !== undefined
      ? clamp01((frame - exitWindowStart) / T_TRANSITION)
      : 0;
  const exitEased = exitT * exitT;
  const phoneExitX = exitEased * (W * 1.0); // flies fully off the right edge
  const phoneExitOpacity = 1 - exitT * 0.3;

  const entryT =
    entryWindow > 0 ? clamp01(frame / entryWindow) : 1;
  // smoothstep so the slide eases in
  const entryEased = entryT * entryT * (3 - 2 * entryT);
  const sceneSlideY = (1 - entryEased) * -H;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        transform: `translateY(${sceneSlideY.toFixed(2)}px)`,
        willChange: "transform",
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
          transform: `translateX(${phoneExitX.toFixed(2)}px)`,
          opacity: phoneExitOpacity,
          willChange: "transform, opacity",
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

