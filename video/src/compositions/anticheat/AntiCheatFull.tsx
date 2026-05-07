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
import { antiCheatBridgeMeta } from "./AntiCheatBridge";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";
import {
  snapZoomIn,
  snapZoomIntense,
  snapZoomOut,
  snapZoomSoft,
  pullLong,
} from "./transitions";

// Snap-zoom-through-blur. Both halves of the camera path move in the
// same direction so velocity stays high through the cut — no "stuck
// lag" at the centre. fg makes the dramatic motion, bg moves at its
// own (much smaller) magnitude. Variation per cut is in direction,
// magnitude, and how the bg behaves relative to the fg.
//
//   Hook → Bars         snap-zoom in        26f   fg 1→1.45  bg 1→1.06
//   Bars → Rigged       HARD CUT
//   Rigged → Stat       snap-zoom intense   24f   fg 1→1.65  bg pulls back
//   Stat → Solution     snap-zoom out + veil 42f  fg 1→0.72
//   Solution → Reassure soft snap           28f   fg 1→1.22  bg ~still
//   Reassure → Bridge   soft snap           28f   fg 1→1.18  bg ~still
//   Bridge → EndCard    long pull           34f   fg 1→0.82  bg ~still
const T_HOOK_BARS = 26;
const T_RIGGED_STAT = 24;
const T_STAT_SOLUTION = 42;
const T_SOLUTION_REASSURE = 28;
const T_REASSURE_BRIDGE = 28;
const T_BRIDGE_END = 34;

const TRANSITION_FRAMES =
  T_HOOK_BARS +
  T_RIGGED_STAT +
  T_STAT_SOLUTION +
  T_SOLUTION_REASSURE +
  T_REASSURE_BRIDGE +
  T_BRIDGE_END;

const TOTAL_FRAMES =
  antiCheatHookMeta.durationInFrames +
  antiCheatBarsMeta.durationInFrames +
  antiCheatRiggedMeta.durationInFrames +
  antiCheatStatMeta.durationInFrames +
  antiCheatSolutionMeta.durationInFrames +
  antiCheatReassureMeta.durationInFrames +
  antiCheatBridgeMeta.durationInFrames +
  antiCheatEndCardMeta.durationInFrames -
  TRANSITION_FRAMES;

// Music shuts down the moment we land on the EndCard — the natural
// tail of the track ends precisely as the Bridge→EndCard transition
// completes. We start late into the file so the back half of the
// march carries the cut and runs out exactly on the final scene.
const AUDIO_FILE_FRAMES = Math.floor(113.142857 * FPS); // Dagored — Dead Man's March
const MUSIC_END_FRAME =
  TOTAL_FRAMES - antiCheatEndCardMeta.durationInFrames + T_BRIDGE_END;
const MUSIC_START_FROM_AUDIO = Math.max(0, AUDIO_FILE_FRAMES - MUSIC_END_FRAME);
const MUSIC_FADE_IN = Math.round(FPS * 0.5);
const MUSIC_VOLUME = 0.55;

export const AntiCheatFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Sequence from={0} durationInFrames={MUSIC_END_FRAME}>
        <Audio
          src={staticFile("music/twitter/Dagored - The Dead Man's March (freetouse.com).mp3")}
          startFrom={MUSIC_START_FROM_AUDIO}
          volume={(frame) =>
            interpolate(
              frame,
              [0, MUSIC_FADE_IN],
              [0, MUSIC_VOLUME],
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
          presentation={snapZoomIn()}
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
          presentation={snapZoomIntense()}
          timing={linearTiming({ durationInFrames: T_RIGGED_STAT })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatStatMeta.durationInFrames}
        >
          <antiCheatStatMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={snapZoomOut(colors.bg)}
          timing={linearTiming({ durationInFrames: T_STAT_SOLUTION })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatSolutionMeta.durationInFrames}
        >
          <antiCheatSolutionMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={snapZoomSoft()}
          timing={linearTiming({ durationInFrames: T_SOLUTION_REASSURE })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatReassureMeta.durationInFrames}
        >
          <antiCheatReassureMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={snapZoomSoft()}
          timing={linearTiming({ durationInFrames: T_REASSURE_BRIDGE })}
        />

        <TransitionSeries.Sequence
          durationInFrames={antiCheatBridgeMeta.durationInFrames}
        >
          <antiCheatBridgeMeta.component />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={pullLong()}
          timing={linearTiming({ durationInFrames: T_BRIDGE_END })}
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
