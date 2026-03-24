/**
 * ColdOpenAudio — four-layer station immersion for the DB cold open.
 *
 * Frames 0-90: Frankfurt Hauptbahnhof at rush hour, rendered in sound.
 *
 * Layer 1: Station ambience — fades in over 15f, holds at 0.45
 * Layer 2: Sub-bass drone — fades in over 20f, BUILDS from 0.08 → 0.20
 *          toward frame 90 (tension accumulates with the visual)
 * Layer 3: Clock tick — enters at f30, volume 0.10 (unconscious urgency)
 * Layer 4: Machinery hum — full duration, volume 0.04 (subsonic building rumble)
 *
 * All four layers cut HARD at frame 90. No fade out.
 * The abrupt silence before the bass hit is the most important moment.
 */
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

const CUT_FRAME = 90;

/* ── Layer 1: Station ambience ─────────────────────────────── */

const AMBIENCE_FADE_FRAMES = 15;
const AMBIENCE_HOLD = 0.45;

function ambienceVolume(frame: number): number {
  if (frame < AMBIENCE_FADE_FRAMES) {
    return AMBIENCE_HOLD * (frame / AMBIENCE_FADE_FRAMES);
  }
  return AMBIENCE_HOLD;
}

/* ── Layer 2: Sub-bass drone (builds toward the cut) ───────── */

const DRONE_FADE_FRAMES = 20;
const DRONE_FLOOR = 0.08;
const DRONE_CEIL = 0.20;

function droneVolume(frame: number): number {
  if (frame < DRONE_FADE_FRAMES) {
    // Fade in to floor level
    return DRONE_FLOOR * (frame / DRONE_FADE_FRAMES);
  }
  // After fade-in: ramp linearly from floor to ceiling approaching the cut
  const rampProgress =
    (frame - DRONE_FADE_FRAMES) / (CUT_FRAME - DRONE_FADE_FRAMES);
  return DRONE_FLOOR + (DRONE_CEIL - DRONE_FLOOR) * rampProgress;
}

/* ── Layer 3: Clock tick ───────────────────────────────────── */

const TICK_START = 30;
const TICK_VOLUME = 0.10;

function tickVolume(): number {
  return TICK_VOLUME;
}

/* ── Layer 4: Machinery hum ────────────────────────────────── */

const HUM_VOLUME = 0.04;

function humVolume(): number {
  return HUM_VOLUME;
}

/* ── Composition ───────────────────────────────────────────── */

export const ColdOpenAudio: React.FC = () => {
  return (
    <Sequence from={0} durationInFrames={CUT_FRAME} name="Cold Open Audio">
      {/* Station ambience — the room tone of departure */}
      <Audio
        src={staticFile("compositions/vision-vc/music/station-ambience.mp3")}
        volume={ambienceVolume}
      />

      {/* Sub-bass drone — pressure that builds without announcing itself */}
      <Audio
        src={staticFile("sfx/dramatic-suspense-drone.mp3")}
        volume={droneVolume}
      />

      {/* Clock tick — delayed entry, barely audible, does its work below awareness */}
      <Sequence from={TICK_START} durationInFrames={CUT_FRAME - TICK_START}>
        <Audio
          src={staticFile("sfx/env-clock-tick.mp3")}
          volume={tickVolume}
        />
      </Sequence>

      {/* Machinery hum — the subsonic weight of a building that moves trains */}
      <Audio
        src={staticFile("sfx/env-machinery-hum.mp3")}
        volume={humVolume}
      />
    </Sequence>
  );
};
