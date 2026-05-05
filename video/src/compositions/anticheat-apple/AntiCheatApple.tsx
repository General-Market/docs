import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  FPS,
  GRADE_FILTER,
  GRADE_TINT,
  H,
  LETTERBOX_PX,
  W,
  colors,
} from "./theme";
import { antiCheatAppleHookMeta } from "./AntiCheatHook";
import { antiCheatAppleStatMeta } from "./AntiCheatStat";
import { antiCheatAppleRiggedMeta } from "./AntiCheatRigged";
import { antiCheatAppleSolutionMeta } from "./AntiCheatSolution";
import { antiCheatAppleReassureMeta } from "./AntiCheatReassure";
import { antiCheatAppleEndCardMeta } from "./AntiCheatEndCard";

// ─── Composition timing ──────────────────────────────────────────────────────
//
// Six scenes, five transitions. Each transition is a 12-frame fade — the kind
// of dissolve Apple uses between launch beats. Transitions overlap their
// adjacent sequences (Remotion's TransitionSeries semantics — see
// node_modules/@remotion/transitions/dist/TransitionSeries.js, which subtracts
// the transition duration from the next start frame). The total composition
// length is therefore sum(scenes) - sum(transition overlaps).
//
//   Hook       300  | 0    → 300
//   ↓ fade 12 frames (overlap)
//   Stat       225  | 288  → 513
//   ↓ fade 12
//   Rigged     210  | 501  → 711
//   ↓ fade 12  ← also the white-flash spike
//   Solution   195  | 699  → 894
//   ↓ fade 12
//   Reassure   180  | 882  → 1062
//   ↓ fade 12
//   EndCard    210  | 1050 → 1260
//
// Sum of scenes: 300 + 225 + 210 + 195 + 180 + 210 = 1320
// Less 5 × 12-frame overlaps: 1320 − 60 = 1260 frames at 30fps = 42 seconds.
const TRANSITION_FRAMES = 12;
const TOTAL_FRAMES = 1260;

// White-flash beat between Rigged and Solution. Peaks at the boundary of the
// 12-frame Rigged→Solution dissolve. The standard fade still runs underneath;
// the flash sits above it. Total visible burn: 24 frames — 9 frames up to
// pure white, 6 frames held white, 9 frames decay back to transparent.
const FLASH_PEAK_FRAME = 705; // midpoint of the Rigged→Solution overlap (699–711)
const FLASH_RAMP_UP = 9;
const FLASH_HOLD = 6;
const FLASH_RAMP_DOWN = 9;
const FLASH_DURATION = FLASH_RAMP_UP + FLASH_HOLD + FLASH_RAMP_DOWN; // 24
const FLASH_FROM = FLASH_PEAK_FRAME - (FLASH_RAMP_UP + FLASH_HOLD / 2);

const SCENES = [
  antiCheatAppleHookMeta,
  antiCheatAppleStatMeta,
  antiCheatAppleRiggedMeta,
  antiCheatAppleSolutionMeta,
  antiCheatAppleReassureMeta,
  antiCheatAppleEndCardMeta,
] as const;

const WhiteFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [
      0,
      FLASH_RAMP_UP,
      FLASH_RAMP_UP + FLASH_HOLD,
      FLASH_RAMP_UP + FLASH_HOLD + FLASH_RAMP_DOWN,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.flash,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const AntiCheatApple: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {/* Six scenes, dissolved together. */}
      <TransitionSeries>
        {SCENES.map((scene, i) => {
          const Comp = scene.component;
          const isLast = i === SCENES.length - 1;
          return (
            <React.Fragment key={scene.id}>
              <TransitionSeries.Sequence
                durationInFrames={scene.durationInFrames}
              >
                <Comp />
              </TransitionSeries.Sequence>
              {isLast ? null : (
                <TransitionSeries.Transition
                  presentation={fade()}
                  timing={linearTiming({
                    durationInFrames: TRANSITION_FRAMES,
                  })}
                />
              )}
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {/* The introducing beat. Between Rigged and Solution. */}
      <Sequence
        from={FLASH_FROM}
        durationInFrames={FLASH_DURATION}
        layout="none"
      >
        <WhiteFlash />
      </Sequence>

      {/* Rec. 709 grade — brightness lift, contrast nudge, slight
          desaturation, a 4% cool-blue screen on top. Subtle per frame,
          unmistakable across the film. Sits above the scenes so it grades
          everything they paint, but below the letterbox so the bars stay
          pure black. */}
      <AbsoluteFill style={{ filter: GRADE_FILTER, pointerEvents: "none" }}>
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            backgroundColor: GRADE_TINT,
          }}
        />
      </AbsoluteFill>

      {/* 2.39:1 letterbox — black bars top and bottom. Visible band 1920×820. */}
      <AbsoluteFill
        style={{
          top: 0,
          bottom: "auto",
          height: LETTERBOX_PX,
          backgroundColor: colors.stage,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          top: "auto",
          bottom: 0,
          height: LETTERBOX_PX,
          backgroundColor: colors.stage,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const antiCheatAppleMeta = {
  id: "AntiCheatApple",
  component: AntiCheatApple,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
