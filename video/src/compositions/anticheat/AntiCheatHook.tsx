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

// Two sequential half-canvas mini-scenes form the hook now. Each holds
// a single device + a single question. Everything reads as already-
// settled from frame 0 — no entry animations — so the viewer lands on
// the question, not on its arrival.
//
//   Scene A  0…63   phone right  · "Why do you trade against insider traders ?"
//   Scene B  64…126 laptop left  · "If you use an anti-cheat against wall hackers ?"
const SCENE_A_DURATION = 64;
const SCENE_B_DURATION = 63;
const HOOK_DURATION = SCENE_A_DURATION + SCENE_B_DURATION;

// Last 15 frames of each scene the device flies up-right out of frame
// — the CSS slide is the transition into the next scene, no separate
// TransitionSeries presentation between Hook and Bars.
const EXIT_FRAMES = 15;
const EXIT_X_FRACTION = 0.85;
const EXIT_Y_FRACTION = -0.95;

const BROLL = {
  // Wall-hack broll reads as "wall hackers" instantly — the only cheat
  // footage the new hook needs.
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

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const AntiCheatHook: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <DotGrid />

      <Sequence from={0} durationInFrames={SCENE_A_DURATION} layout="none">
        <QuestionScene
          device="phone"
          devicePosition="right"
          question={"Why do you trade against insider traders ?"}
          questionTint="#E03B4A"
          laptopSegments={PHONE_SEGMENTS}
          sceneDuration={SCENE_A_DURATION}
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
          question={"If you use an anti-cheat against wall hackers ?"}
          laptopSegments={LAPTOP_SEGMENTS}
          sceneDuration={SCENE_B_DURATION}
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
  sceneDuration: number;
}> = ({
  device,
  devicePosition,
  question,
  questionTint,
  laptopSegments,
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const isDeviceRight = devicePosition === "right";

  // Device exit — last EXIT_FRAMES travel up-right. ease-in cubic so the
  // device loiters in frame, then accelerates off into the next scene.
  const exitT = clamp01(
    (frame - (sceneDuration - EXIT_FRAMES)) / EXIT_FRAMES,
  );
  const exitEased = exitT * exitT;
  const exitX = exitEased * (W * EXIT_X_FRACTION);
  const exitY = exitEased * (H * EXIT_Y_FRACTION);

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
          transform: `translate(${exitX.toFixed(2)}px, ${exitY.toFixed(2)}px)`,
          willChange: "transform",
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
