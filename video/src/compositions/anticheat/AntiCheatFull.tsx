import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { FPS, H, W, colors } from "./theme";
import { antiCheatStatMeta, antiCheatBarsMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatSwitchMeta } from "./AntiCheatSwitch";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";
import {
  snapZoomIntense,
  snapZoomOut,
  snapZoomSoft,
  pullLong,
} from "./transitions";
import { MUSIC_START_FROM_AUDIO, VIDEO_BEATS } from "./beats";

// Beat-locked glow envelope. Sharp attack, longer decay — the halo
// flares on the kick and ebbs back to rest before the next one.
const GLOW_ATTACK = 4;
const GLOW_DECAY = 18;

const beatGlow = (frame: number): number => {
  let max = 0;
  for (const b of VIDEO_BEATS) {
    const delta = frame - b;
    if (delta < -GLOW_ATTACK || delta > GLOW_DECAY) continue;
    const env =
      delta <= 0 ? (delta + GLOW_ATTACK) / GLOW_ATTACK : 1 - delta / GLOW_DECAY;
    if (env > max) max = env;
  }
  return max;
};

// Snap-zoom-through-blur. Both halves of the camera path move in the
// same direction so velocity stays high through the cut — no "stuck
// lag" at the centre. fg makes the dramatic motion, bg moves at its
// own (much smaller) magnitude. Variation per cut is in direction,
// magnitude, and how the bg behaves relative to the fg.
//
// Tightened pass: shorter durations, smaller magnitudes, less blur.
// Cuts now snap instead of swelling.
//
//   Bars → Rigged       soft snap           18f
//   Rigged → Stat       snap-zoom intense   16f
//   Stat → Solution     snap-zoom out + veil 28f
//   Solution → Reassure soft snap           18f
//   Reassure → Bridge   soft snap           18f
//   Bridge → EndCard    long pull           24f
// Iceberg scene removed — its scapegoat content (liquidation hunters,
// front runners, orderbook spoofers, insider traders) now lives as a
// card lineup at the head of the Stat scene.
const T_BARS_RIGGED = 18;
const T_RIGGED_STAT = 16;
const T_STAT_SOLUTION = 28;
const T_SOLUTION_REASSURE = 18;
const T_REASSURE_BRIDGE = 18;
const T_BRIDGE_END = 24;

const TRANSITION_FRAMES =
  T_BARS_RIGGED +
  T_RIGGED_STAT +
  T_STAT_SOLUTION +
  T_SOLUTION_REASSURE +
  T_REASSURE_BRIDGE +
  T_BRIDGE_END;

// Trim the first 10 frames off the head — the opening Bars carousel
// pre-roll was burning real estate before the first hard beat. Content
// is shifted by wrapping the body in <Sequence from={-TRIM_HEAD_FRAMES}>
// below; TOTAL_FRAMES is reduced by the same amount so the tail still
// lands cleanly.
const TRIM_HEAD_FRAMES = 10;

const RAW_TOTAL_FRAMES =
  antiCheatBarsMeta.durationInFrames +
  antiCheatRiggedMeta.durationInFrames +
  antiCheatStatMeta.durationInFrames +
  antiCheatSolutionMeta.durationInFrames +
  antiCheatReassureMeta.durationInFrames +
  antiCheatSwitchMeta.durationInFrames +
  antiCheatEndCardMeta.durationInFrames -
  TRANSITION_FRAMES;
const TOTAL_FRAMES = RAW_TOTAL_FRAMES - TRIM_HEAD_FRAMES;

// Music timing — MUSIC_START_FROM_AUDIO is hardcoded in beats.ts so the
// beat grid stays stable across scene-duration changes. The drum spike
// (audio t≈102.52s) lands at video frame 1036 (34.53s) — 9f inside
// EndCard, same SPIKE_ENDCARD_LOCAL anchor as before the Hook cut.
// Sync hooks read off VIDEO_BEATS.
const AUDIO_FILE_FRAMES = Math.floor(113.142857 * FPS); // Dagored — Dead Man's March
const MUSIC_END_FRAME = Math.min(
  TOTAL_FRAMES,
  AUDIO_FILE_FRAMES - MUSIC_START_FROM_AUDIO,
);
const MUSIC_FADE_IN = Math.round(FPS * 0.5);
const MUSIC_VOLUME = 0.55;
// Fade-out lines up with the song's natural outro (audio second 104.63),
// which lands at video second 36.63 with MUSIC_START_FROM_AUDIO=2040.
const MUSIC_FADE_OUT_END = Math.round(36.63 * FPS);
const MUSIC_FADE_OUT_DURATION = Math.round(FPS * 1.0);

export const AntiCheatFull: React.FC = () => {
  const frame = useCurrentFrame();
  // Beats are authored against the RAW (untrimmed) composition timeline.
  // Adding TRIM_HEAD_FRAMES here keeps the bloom firing on the same
  // VISUAL moments after the head trim.
  const pulse = beatGlow(frame + TRIM_HEAD_FRAMES);
  const lerp = (a: number, b: number) => a + (b - a) * pulse;
  // Resting halo always present; on-beat halo flares wider and brighter.
  const a1 = lerp(0.45, 0.95);
  const a2 = lerp(0.55, 1.0);
  const a3 = lerp(0.30, 0.70);
  const r1 = lerp(4, 6);
  const r2 = lerp(22, 38);
  const r3 = lerp(56, 88);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        // Inherited white bloom behind every glyph — Apple-keynote style.
        // Pulses on every audio beat from VIDEO_BEATS.
        textShadow: `0 0 ${r1}px rgba(255, 255, 255, ${a1}), 0 0 ${r2}px rgba(255, 255, 255, ${a2}), 0 0 ${r3}px rgba(255, 255, 255, ${a3})`,
      }}
    >
      {/* Shift the entire body (music + visuals) by -TRIM_HEAD_FRAMES so
          the first 10 frames of the original Bars pre-roll are clipped.
          Audio and visuals shift together — every beat still lands on
          the same visual moment as before. The music file simply plays
          from MUSIC_START_FROM_AUDIO + 10 instead of MUSIC_START_FROM_AUDIO. */}
      <Sequence from={-TRIM_HEAD_FRAMES}>
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
          durationInFrames={antiCheatBarsMeta.durationInFrames}
        >
          <antiCheatBarsMeta.component />
        </TransitionSeries.Sequence>

        {/* Bars → Rigged: soft snap. The carousel hands off to the
            "everyone is rigged" article wall — same descent, fewer steps. */}
        <TransitionSeries.Transition
          presentation={snapZoomSoft()}
          timing={linearTiming({ durationInFrames: T_BARS_RIGGED })}
        />

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
      </Sequence>
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
