/**
 * AntiCheatEdit — the baked talk, played in the Tutorial side-panel rig.
 *
 * The talking head (final.mp4) is no longer a flat fullscreen plate. It rides
 * inside AntiCheatLayout: a rectangle that spring-animates to one side when a
 * schematic or article is due, freeing the other side as a CONTENT AREA where
 * that overlay is scaled to fit. When nothing is due the head returns to full
 * frame and breathes — a slow, beat-snapped push / pan so the talk never sits
 * still. Sides alternate per mechanism; articles take the opposite side from
 * their section's chart.
 *
 * Timing comes from the same OVERLAYS / ARTICLE_OVERLAYS arrays as before, now
 * merged and side-assigned in panelEvents.ts (their `at` values are untouched).
 * AtmosphereTrack + MusicTrack carry the sound; the inverted end card closes.
 *
 * Cuts and 1.2× speed-up are pre-rendered into final.mp4 (649.466s, 30fps).
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import metaJson from "./final.meta.json";
import { AntiCheatLayout } from "./AntiCheatLayout";
import { CaptionLayer } from "./CaptionLayer";
import { ChapterRail } from "./overlays/ChapterRail";
import { MusicTrack } from "./MusicTrack";
import { AtmosphereTrack } from "./AtmosphereTrack";
import { IntroHero, HERO_FROM, HERO_DUR } from "./overlays/IntroHero";
import {
  AntiCheatEndCard,
  antiCheatEndCardMeta,
} from "../anticheat/AntiCheatEndCard";

const FPS = 30;
const W = 1920;
const H = 1080;

const durationSeconds = Number((metaJson as { duration_seconds: number }).duration_seconds) || 1;
const bakedFrames = Math.max(1, Math.round(durationSeconds * FPS));

// The recording trails off on a qualifier — "…and make sure that if you don't
// trade technical, don't trade on markets where…". The line that lands is the
// one before it: "Always choose who is your counterparty." We end the speech
// there (10:45; "counterparty." finishes ~645.1s, "and" begins 645.28s) and
// hand straight to the outro. The dropped tail is ~4s of final.mp4 that simply
// never plays — clamped to the baked length for safety.
const SPEECH_END_SEC = 645.2;
const SPEECH_END_FRAMES = Math.min(bakedFrames, Math.round(SPEECH_END_SEC * FPS));

// The same close as AntiCheatFull — the inverted blue end card. It crossfades
// in over the last frames of the *speech* (not the baked end), then holds for
// reading time. Unlike the full cut, the warm score plays ON through the card:
// MusicTrack's final cue now runs to the composition end, so the outro lands on
// music, not silence.
const END_CARD_FRAMES = antiCheatEndCardMeta.durationInFrames;
const END_CARD_CROSSFADE = 14;
const END_CARD_START = SPEECH_END_FRAMES - END_CARD_CROSSFADE;
const compositionDurationFrames = END_CARD_START + END_CARD_FRAMES;

// Resting white bloom from AntiCheatFull's root. The full cut pulses this on
// every beat; here we hold it at its rest value so the end-card type carries
// the same soft halo it does in the film. The wordmark overrides it to none.
const REST_TEXT_SHADOW =
  "0 0 4px rgba(255, 255, 255, 0.45), 0 0 22px rgba(255, 255, 255, 0.55), 0 0 56px rgba(255, 255, 255, 0.30)";

export const AntiCheatEditComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#020E2B" }}>
      <Sequence durationInFrames={SPEECH_END_FRAMES} layout="none">
        <AntiCheatLayout />
      </Sequence>

      {/* Intro hero — the billion number stands behind the speaker and the
          product ring orbits him on the "one billion of volume on perps…" line.
          Sits above the head (behind-subject sandwich); below the captions. */}
      <Sequence from={HERO_FROM} durationInFrames={HERO_DUR} layout="none">
        <IntroHero />
      </Sequence>

      {/* Chapter rail — the persistent progress spine. Always on while the 13
          mechanisms play (mechanism 01 → the turn); top-edge chrome over the
          head, fades out as the answer begins. */}
      <Sequence durationInFrames={SPEECH_END_FRAMES} layout="none">
        <ChapterRail />
      </Sequence>

      {/* Emphasis captions — above the rig, hidden whenever a panel is active. */}
      <Sequence durationInFrames={SPEECH_END_FRAMES} layout="none">
        <CaptionLayer />
      </Sequence>

      <AtmosphereTrack />
      <MusicTrack />

      {/* End card — the same inverted close as AntiCheatFull. */}
      <Sequence
        from={END_CARD_START}
        durationInFrames={END_CARD_FRAMES}
        layout="none"
      >
        <EndCardClose>
          <AntiCheatEndCard />
        </EndCardClose>
      </Sequence>
    </AbsoluteFill>
  );
};

// Crossfades the end card in over the tail of the talk, then carries the
// resting white bloom the full cut applies from its root.
const EndCardClose: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, END_CARD_CROSSFADE], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity, textShadow: REST_TEXT_SHADOW }}>
      {children}
    </AbsoluteFill>
  );
};

export const anticheatEditMeta = {
  id: "AntiCheatEdit",
  component: AntiCheatEditComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: compositionDurationFrames,
};
