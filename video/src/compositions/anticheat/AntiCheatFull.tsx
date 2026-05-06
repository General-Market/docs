import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { FPS, H, W, colors } from "./theme";
import { antiCheatHookMeta } from "./AntiCheatHook";
import { antiCheatStatMeta, antiCheatBarsMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";
import {
  zoomPushHeavy,
  zoomPushSoft,
  zoomPullLong,
  zoomPullSlow,
  zoomWhip,
} from "./transitions";
import { HandheldDrift } from "./vibe";

// Every transition is a zoom-through-blur. Exiting scene zooms toward a
// peak scale, gaussian blur rises with the motion, the cut hides inside
// the blur peak, entering scene starts at that peak and dezooms back to
// rest as the blur clears. Direction, magnitude, easing, and duration
// vary per cut.
//
//   Hook → Bars        zoom push heavy (1 → 1.55, quart-in)   24f
//   Bars → Rigged      HARD CUT — the bars are the verdict
//   Rigged → Stat      whip zoom (1 → 1.85, quint-in)         20f
//   Stat → Solution    pull slow + veil (1 → 0.72, in-out)    32f   ← music dies
//   Solution → Reassure soft push (1 → 1.28, cubic-in)        22f
//   Reassure → EndCard long pull (1 → 0.82)                   26f
const T_HOOK_BARS = 24;
const T_RIGGED_STAT = 20;
const T_STAT_SOLUTION = 32;
const T_SOLUTION_REASSURE = 22;
const T_REASSURE_END = 26;

const TRANSITION_FRAMES =
  T_HOOK_BARS +
  T_RIGGED_STAT +
  T_STAT_SOLUTION +
  T_SOLUTION_REASSURE +
  T_REASSURE_END;

const TOTAL_FRAMES =
  antiCheatHookMeta.durationInFrames +
  antiCheatBarsMeta.durationInFrames +
  antiCheatRiggedMeta.durationInFrames +
  antiCheatStatMeta.durationInFrames +
  antiCheatSolutionMeta.durationInFrames +
  antiCheatReassureMeta.durationInFrames +
  antiCheatEndCardMeta.durationInFrames -
  TRANSITION_FRAMES;

// Music covers Hook + Bars + Rigged + Stat in the new (shorter) timeline.
// Two transitions land before Stat ends — Hook→Bars and Rigged→Stat.
const MUSIC_FRAMES =
  antiCheatHookMeta.durationInFrames +
  antiCheatBarsMeta.durationInFrames +
  antiCheatRiggedMeta.durationInFrames +
  antiCheatStatMeta.durationInFrames -
  T_HOOK_BARS -
  T_RIGGED_STAT;
const MUSIC_FADE_OUT = Math.round(FPS * 0.8);
const MUSIC_VOLUME = 0.55;

export const AntiCheatFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Sequence from={0} durationInFrames={MUSIC_FRAMES}>
        <Audio
          src={staticFile("anticheat-bed.mp3")}
          volume={(frame) =>
            interpolate(
              frame,
              [
                0,
                Math.round(FPS * 0.25),
                MUSIC_FRAMES - MUSIC_FADE_OUT,
                MUSIC_FRAMES,
              ],
              [0, MUSIC_VOLUME, MUSIC_VOLUME, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      </Sequence>
      <HandheldDrift amplitude={4} speed={0.045}>
      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={antiCheatHookMeta.durationInFrames}
        >
          <antiCheatHookMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={zoomPushHeavy()}
          timing={linearTiming({ durationInFrames: T_HOOK_BARS })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatBarsMeta.durationInFrames}
        >
          <antiCheatBarsMeta.component />
        </TransitionSeries.Sequence>

        {/* Bars → Rigged: held hard cut. The bars are the verdict. */}

        <TransitionSeries.Sequence
          durationInFrames={antiCheatRiggedMeta.durationInFrames}
        >
          <antiCheatRiggedMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={zoomWhip()}
          timing={linearTiming({ durationInFrames: T_RIGGED_STAT })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatStatMeta.durationInFrames}
        >
          <antiCheatStatMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={zoomPullSlow(colors.bg)}
          timing={linearTiming({ durationInFrames: T_STAT_SOLUTION })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatSolutionMeta.durationInFrames}
        >
          <antiCheatSolutionMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={zoomPushSoft()}
          timing={linearTiming({ durationInFrames: T_SOLUTION_REASSURE })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatReassureMeta.durationInFrames}
        >
          <antiCheatReassureMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={zoomPullLong()}
          timing={linearTiming({ durationInFrames: T_REASSURE_END })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatEndCardMeta.durationInFrames}
        >
          <antiCheatEndCardMeta.component />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      </HandheldDrift>
    </AbsoluteFill>
  );
};

export const antiCheatFullMeta = {
  id: "AntiCheatFull",
  component: AntiCheatFull,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
