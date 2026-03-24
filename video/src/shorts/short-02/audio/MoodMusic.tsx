// Stonecutter Short — Mood Music (Miami Multi-Track)
//
// Volume arc calibrated from reference video analysis report:
//   - Voice-to-music ratio: 2:1 (voice dominates 88% of video)
//   - Music only takes over in final CTA section (81-89s)
//   - All tracks normalized to -18 LUFS for consistent level
//
// baseVolume=0.10 → effective ~-39 dB with -19 dB tracks
// Voice at volume=1.0 → ~-33 dB mean
// Result: voice ~6 dB louder than music (≈2:1 ratio)
//
// Available Miami tracks (public/shorts/short-02/music/miami/):
//   reggaetton.mp3        — Powerful, brass (MAIN)
//   mi-gente.mp3          — Moombahton, fun (forex)
//   need-for-speed.mp3    — Trap, determined (stocks)
//   back-to-east.mp3      — R&B, party (BTC)
//   sad-jazz.mp3          — Film Score, melancholic (Goldman/Citadel)
//   never-going-broke.mp3 — Trap, serious (0DTE)
//   greed.mp3             — Trap, mysterious (memecoins)
//   esperanza.mp3         — Cheerful, beach (polymarket)
//   waka-floka.mp3        — Trap, mysterious (montage)
//   + more in miami/ folder

import React, { useCallback } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { secondsToFrame } from "../../../lib/utils/frameConvert";
import { useShortContext } from "../ShortContext";

const FPS = 30;
const FADE_FRAMES = 12;

interface MoodMusicProps {
  baseVolume?: number;
}

interface MoodSegment {
  track: string | null;
  startSec: number;
  endSec: number;
  /** Volume multiplier. Derived from reference report Section 6.2 energy ratios. */
  volumeScale: number;
}

// ─── Volume arc from reference report ────────────────────
//
// Report Section 6.2 voice/music energy ratios mapped to our story:
//
// Ref ratio 2.5:1 → scale 1.0  (standard voice-dominant)
// Ref ratio 1.4:1 → scale 1.5  (music rises — transformation peaks)
// Ref ratio 4.0:1 → scale 0.5  (very ducked — dark/defeated moments)
// Ref ratio 0.5:1 → scale 3.0  (music dominant — CTA/outro)
//
// Pattern from report:
//   Opening: medium → transformations: music rises briefly → dark moments: very ducked
//   → wind/escalation: highest music → mountain/defeat: declining
//   → CTA: music takes over → silence
//
const MOOD_SEGMENTS: MoodSegment[] = [
  // ── Opening (0-10s) — Ref: 0-10s, ratio ~2.3:1 ───────
  // "In Miami, flipping used cars... saw a forex trader"
  // Big reggaeton brass = MIAMI. Standard voice-dominant level.
  { track: "music/miami/reggaetton.mp3", startSec: 0, endSec: 10, volumeScale: 1.0 },

  // ── Forex desire (10-13s) — Ref: 10-15s, ratio ~2.8:1 ─
  // "Forex traders make more... I want to trade forex"
  // Slight dip — tension before first transformation.
  { track: "music/miami/mi-gente.mp3", startSec: 10, endSec: 13, volumeScale: 0.85 },

  // ── Forex→Stocks (13-24s) — Ref: 15-25s, ratio ~2.0:1 ─
  // "He became the forex trader... saw a stock trader"
  // Music rises slightly — escalation arc begins.
  { track: "music/miami/need-for-speed.mp3", startSec: 13, endSec: 24, volumeScale: 1.2 },

  // ── BTC desire (24-31s) — Ref: 25-30s, ratio ~1.4:1 ───
  // "He saw bitcoin futures... I want to trade bitcoin"
  // Music peaks — ref shows strongest music rise at this story beat.
  { track: "music/miami/back-to-east.mp3", startSec: 24, endSec: 31, volumeScale: 1.4 },

  // ── BTC transformation (31-36s) — Ref: 30-35s, ratio ~1.9:1
  // "And he traded bitcoin"
  // Back to main theme, standard level.
  { track: "music/miami/reggaetton.mp3", startSec: 31, endSec: 36, volumeScale: 1.0 },

  // ── Goldman Sachs (36-45s) — Ref: 35-45s, ratio ~2.2:1 ─
  // "But Goldman Sachs... hedge funds stronger"
  // SAD. Music ducks for voice clarity on dark revelation.
  { track: "music/miami/sad-jazz.mp3", startSec: 36, endSec: 45, volumeScale: 0.8 },

  // ── 0DTE escalation (45-50s) — Ref: 40-50s, ratio ~1.5:1
  // "So he switched to zero-DTE options"
  // Music rises — ref wind section is highest energy moment.
  { track: "music/miami/never-going-broke.mp3", startSec: 45, endSec: 50, volumeScale: 1.3 },

  // ── Memecoins (50-59s) — Ref: 50-55s, ratio ~2.5:1 ────
  // "jumped to memecoins... hedge funds showed up"
  // Declining energy per ref. Standard level.
  { track: "music/miami/greed.mp3", startSec: 50, endSec: 59, volumeScale: 1.0 },

  // ── Polymarket hope (59-67s) — Ref: 55-65s, ratio ~3.5:1
  // "prediction markets — Polymarket"
  // Very ducked per ref — voice takes strong lead.
  { track: "music/miami/esperanza.mp3", startSec: 59, endSec: 67, volumeScale: 0.6 },

  // ── Citadel defeat (67-75s) — Ref: 60-70s, ratio ~4.0:1
  // "Citadel and Jump Trading cutting into profits"
  // Lowest music point per ref. Nearly whisper.
  { track: "music/miami/sad-jazz.mp3", startSec: 67, endSec: 75, volumeScale: 0.4 },

  // ── Bass-drop silence (75-77s) ────────────────────────
  { track: null, startSec: 75, endSec: 77, volumeScale: 0 },

  // ── Montage return (77-81s) — Ref: 70-75s, ratio ~1.9:1
  // "I want to go back to flipping cars"
  // Standard energy — rapid montage.
  { track: "music/miami/waka-floka.mp3", startSec: 77, endSec: 81, volumeScale: 1.0 },

  // ── Resolution/CTA (81-89s) — Ref: 75-82s, MUSIC DOMINANT
  // "The edge was always in the niche. See you on AgiArena."
  // Per ref: music takes over in final section (ratio 0.5:1).
  // Scale 2.5x so music becomes louder than voice for outro.
  { track: "music/miami/reggaetton.mp3", startSec: 81, endSec: 89, volumeScale: 2.5 },
];

export const MoodMusic: React.FC<MoodMusicProps> = ({
  baseVolume = 0.10,
}) => {
  const { assetDir } = useShortContext();

  return (
    <>
      {MOOD_SEGMENTS.map((segment, i) => {
        if (segment.track === null) return null;

        const fromFrame = secondsToFrame(segment.startSec, FPS);
        const endFrame = secondsToFrame(segment.endSec, FPS);
        const duration = endFrame - fromFrame;
        const effectiveVolume = baseVolume * segment.volumeScale;

        return (
          <MoodTrack
            key={`mood-${i}-${segment.startSec}`}
            track={`${assetDir}/${segment.track}`}
            fromFrame={fromFrame}
            durationInFrames={duration}
            baseVolume={effectiveVolume}
          />
        );
      })}
    </>
  );
};

interface MoodTrackProps {
  track: string;
  fromFrame: number;
  durationInFrames: number;
  baseVolume: number;
}

const MoodTrack: React.FC<MoodTrackProps> = ({
  track,
  fromFrame,
  durationInFrames,
  baseVolume,
}) => {
  const volume = useCallback(
    (f: number) => {
      if (f < FADE_FRAMES) {
        return baseVolume * (f / FADE_FRAMES);
      }
      const fadeOutStart = durationInFrames - FADE_FRAMES;
      if (f >= fadeOutStart) {
        const remaining = durationInFrames - f;
        return baseVolume * (remaining / FADE_FRAMES);
      }
      return baseVolume;
    },
    [baseVolume, durationInFrames],
  );

  return (
    <Sequence from={fromFrame} durationInFrames={durationInFrames}>
      <Audio src={staticFile(track)} volume={volume} />
    </Sequence>
  );
};
