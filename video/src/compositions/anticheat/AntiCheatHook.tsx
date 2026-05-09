import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { AntiCheatHookHalfScene } from "./AntiCheatHookHalfScene";
import { DotGrid } from "./DotGrid";
import { FPS, H, W, colors } from "./theme";

// Two sequential half-canvas mini-scenes form the hook now. Each holds
// a single device + a single question; the viewer reads one, then the
// other, then the rest of the film answers them. No pair lists, no
// reveal slab — the questions are the slab.
//
//   Scene A  0…126   phone right  · "Why do you trade against insider traders?"
//   Scene B  127…253 laptop left  · "If you use an anti-cheat against wall hackers?"
const HOOK_DURATION = 254;
const SCENE_A_DURATION = 127;
const SCENE_B_DURATION = HOOK_DURATION - SCENE_A_DURATION;

const BROLL = {
  // Wall-hack broll reads as "wall hackers" instantly — the only cheat
  // footage the new hook needs. cs2 / minecraft are retired here.
  valorant: staticFile("cheat-broll/valorant-wallhack.mp4"),
};

export type BrollSegment = {
  url: string;
  from: number;
  durationInFrames: number;
  startFrom: number;
};

const PHONE_SEGMENTS: BrollSegment[] = [];
const LAPTOP_SEGMENTS: BrollSegment[] = [
  {
    url: BROLL.valorant,
    from: 0,
    durationInFrames: SCENE_B_DURATION,
    startFrom: 0,
  },
];

export const AntiCheatHook: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <DotGrid />

      <Sequence from={0} durationInFrames={SCENE_A_DURATION} layout="none">
        <QuestionScene
          device="phone"
          devicePosition="right"
          question="Why do you trade against insider traders ?"
          questionTint="#E03B4A"
          laptopSegments={PHONE_SEGMENTS}
        />
      </Sequence>

      <Sequence
        from={SCENE_A_DURATION}
        durationInFrames={SCENE_B_DURATION}
        layout="none"
      >
        <QuestionScene
          device="laptop"
          devicePosition="left"
          question="If you use an anti-cheat against wall hackers ?"
          laptopSegments={LAPTOP_SEGMENTS}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Question scene — half device, half question ───────────────────────────────

const QuestionScene: React.FC<{
  device: "laptop" | "phone";
  devicePosition: "left" | "right";
  question: string;
  questionTint?: string;
  laptopSegments: BrollSegment[];
}> = ({ device, devicePosition, question, questionTint, laptopSegments }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isDeviceRight = devicePosition === "right";

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
          padding: "0 112px",
        }}
      >
        <QuestionText
          text={question}
          align={isDeviceRight ? "right" : "left"}
          tint={questionTint}
          frame={frame}
          fps={fps}
        />
      </div>

      <div
        style={{
          width: W / 2,
          height: H,
          position: "relative",
          overflow: "hidden",
          order: isDeviceRight ? 1 : 0,
        }}
      >
        <AntiCheatHookHalfScene
          device={device}
          laptopSegments={laptopSegments}
          laptopBrollAspect={16 / 9}
          width={W / 2}
          height={H}
          emissiveIntensity={0.7}
          lightingIntensity={0.7}
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
  frame: number;
  fps: number;
}> = ({ text, align, tint, frame, fps }) => {
  const t = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const opacity = interpolate(t, [0, 1], [0, 1]);
  const y = interpolate(t, [0, 1], [28, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y.toFixed(2)}px)`,
        willChange: "transform, opacity",
        textAlign: align,
        maxWidth: 760,
        fontFamily: font,
        fontSize: 100,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        color: tint ?? colors.fg,
        lineHeight: 1.04,
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
