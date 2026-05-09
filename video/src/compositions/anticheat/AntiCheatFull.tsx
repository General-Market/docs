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
import { antiCheatSwitchMeta } from "./AntiCheatSwitch";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";
import {
  snapZoomIn,
  snapZoomIntense,
  snapZoomOut,
  snapZoomSoft,
  pullLong,
} from "./transitions";
import { MUSIC_START_FROM_AUDIO } from "./beats";

// Snap-zoom-through-blur. Both halves of the camera path move in the
// same direction so velocity stays high through the cut — no "stuck
// lag" at the centre. fg makes the dramatic motion, bg moves at its
// own (much smaller) magnitude. Variation per cut is in direction,
// magnitude, and how the bg behaves relative to the fg.
//
// Tightened pass: shorter durations, smaller magnitudes, less blur.
// Cuts now snap instead of swelling.
//
//   Hook → Bars         snap-zoom in        18f
//   Bars → Rigged       HARD CUT
//   Rigged → Stat       snap-zoom intense   16f
//   Stat → Solution     snap-zoom out + veil 28f
//   Solution → Reassure soft snap           18f
//   Reassure → Bridge   soft snap           18f
//   Bridge → EndCard    long pull           24f
const T_HOOK_BARS = 18;
const T_RIGGED_STAT = 16;
const T_STAT_SOLUTION = 28;
const T_SOLUTION_REASSURE = 18;
const T_REASSURE_BRIDGE = 18;
const T_BRIDGE_END = 24;

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
  antiCheatSwitchMeta.durationInFrames +
  antiCheatEndCardMeta.durationInFrames -
  TRANSITION_FRAMES;

// Music timing — MUSIC_START_FROM_AUDIO is hardcoded in beats.ts so the
// beat grid stays stable across scene-duration changes. The drum spike
// (audio t≈102.52s) now lands at video frame 1175 (39.15s) — 27f inside
// EndCard rather than on the Switch→EndCard cut at frame 1148. The
// EndCard underline completes around then; sync hooks read off VIDEO_BEATS.
const AUDIO_FILE_FRAMES = Math.floor(113.142857 * FPS); // Dagored — Dead Man's March
const MUSIC_END_FRAME = Math.min(
  TOTAL_FRAMES,
  AUDIO_FILE_FRAMES - MUSIC_START_FROM_AUDIO,
);
const MUSIC_FADE_IN = Math.round(FPS * 0.5);
const MUSIC_VOLUME = 0.55;
// Fade-out lines up with the song's natural outro (audio second 104.63),
// which now lands at video second 41.27 with MUSIC_START_FROM_AUDIO=1901.
const MUSIC_FADE_OUT_END = Math.round(41.27 * FPS);
const MUSIC_FADE_OUT_DURATION = Math.round(FPS * 1.0);

export const AntiCheatFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Sequence from={0} durationInFrames={MUSIC_END_FRAME}>
        <Audio
          src={staticFile("music/twitter/Dagored - The Dead Man's March (freetouse.com).mp3")}
          startFrom={MUSIC_START_FROM_AUDIO}
          volume={(frame) => {
            const fadeIn = interpolate(
              frame,
              [0, MUSIC_FADE_IN],
              [0, MUSIC_VOLUME],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const fadeOut = interpolate(
              frame,
              [
                MUSIC_FADE_OUT_END - MUSIC_FADE_OUT_DURATION,
                MUSIC_FADE_OUT_END,
              ],
              [MUSIC_VOLUME, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return Math.min(fadeIn, fadeOut);
          }}
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
          durationInFrames={antiCheatSwitchMeta.durationInFrames}
        >
          <antiCheatSwitchMeta.component />
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
