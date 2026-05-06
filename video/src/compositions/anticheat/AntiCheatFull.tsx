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
import { pullPunch, pushThrough, pullOnly, silentDezoom } from "./transitions";

// Five active transitions plus one held hard cut. Total absorbed:
//   pull-and-punch (Hook→Bars)        16f
//   pull-and-punch short (Rigged→Stat) 12f
//   silent dezoom (Stat→Solution)      22f   ← music dies here
//   push-through gentle (Solution→Reassure) 14f
//   pull-only (Reassure→EndCard)       14f
//                                     ────
//                                      78f  → composition shortens 29.5s → ~26.9s
//
// Bars→Rigged stays a hard cut. The bars already are the verdict.
const T_PULL_PUNCH = 24;
const T_PULL_PUNCH_SHORT = 18;
const T_SILENT_DEZOOM = 30;
const T_PUSH_THROUGH = 22;
const T_PULL_ONLY = 22;

const TRANSITION_FRAMES =
  T_PULL_PUNCH +
  T_PULL_PUNCH_SHORT +
  T_SILENT_DEZOOM +
  T_PUSH_THROUGH +
  T_PULL_ONLY;

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
// Two transitions land before Stat ends (Hook→Bars, Rigged→Stat) — the
// silent-dezoom into Solution starts at the very edge so we don't subtract
// it.
const MUSIC_FRAMES =
  antiCheatHookMeta.durationInFrames +
  antiCheatBarsMeta.durationInFrames +
  antiCheatRiggedMeta.durationInFrames +
  antiCheatStatMeta.durationInFrames -
  T_PULL_PUNCH -
  T_PULL_PUNCH_SHORT;
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
      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={antiCheatHookMeta.durationInFrames}
        >
          <antiCheatHookMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={pullPunch()}
          timing={linearTiming({ durationInFrames: T_PULL_PUNCH })}
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
          presentation={pullPunch()}
          timing={linearTiming({ durationInFrames: T_PULL_PUNCH_SHORT })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatStatMeta.durationInFrames}
        >
          <antiCheatStatMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={silentDezoom({ veilColor: colors.bg })}
          timing={linearTiming({ durationInFrames: T_SILENT_DEZOOM })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatSolutionMeta.durationInFrames}
        >
          <antiCheatSolutionMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={pushThrough()}
          timing={linearTiming({ durationInFrames: T_PUSH_THROUGH })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatReassureMeta.durationInFrames}
        >
          <antiCheatReassureMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={pullOnly()}
          timing={linearTiming({ durationInFrames: T_PULL_ONLY })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatEndCardMeta.durationInFrames}
        >
          <antiCheatEndCardMeta.component />
        </TransitionSeries.Sequence>
      </TransitionSeries>
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
