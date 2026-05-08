// Beat grid for the anticheat short.
//
// The Audio component starts the music file at MUSIC_START_FROM_AUDIO
// frames in (see AntiCheatFull). MUSIC_START_FROM_AUDIO is hardcoded
// so the beat grid is stable — it doesn't drift when scene durations
// change.
//
// Source data: video/audio-analysis/dagored-march.json (BPM 69.8, 116
// beats over 113.14s). Each beat at audio time T_audio maps to video
// frame round(T_audio * FPS - MUSIC_START_FROM_AUDIO).
//
// Locked invariant: the music's strongest energy plateau (audio frames
// ~3079–3084, t≈102.6–102.8s) lands on the Switch→EndCard cut. After
// Reassure +0.5s (+15f) and Switch +0.6s (+18f) the cut moves from
// frame 1115 to 1148 (38.27s); MUSIC_START_FROM_AUDIO drops by 33 to
// keep the drum spike on the new cut. Audio now plays from second 64.37.
export const MUSIC_START_FROM_AUDIO = 1931;

// Beats that fall inside the music's playing window for the video.
// 42 beats at BPM 69.8 (≈26 frames apart), pulled directly from the
// audio analysis and shifted by the new MUSIC_START_FROM_AUDIO. Scene
// ranges with the current durations and transitions:
//   Hook (0–254):       beats  0–9   (frames  24–230)
//   Bars (236–365):     beats 10–14  (frames 256–359)
//   Rigged (365–543):   beats 15–21  (frames 384–539)
//   Stat (527–672):     beats 21–25  (frames 539–667)
//   Solution (644–877): beats 26–33  (frames 667–873)
//   Reassure (859–980): beats 34–37  (frames 873–976)
//   Switch (962–1148):  beats 37–41  (frames 976–1079)
//   EndCard (1124–end): no beats — the music is in its outro by then.
export const VIDEO_BEATS: readonly number[] = [
  24, 50, 76, 102, 127, 153, 179, 205, 230, 256, 281, 307, 333, 359, 384,
  410, 436, 462, 488, 513, 539, 564, 591, 616, 642, 667, 693, 719, 745,
  770, 796, 822, 847, 873, 899, 924, 950, 976, 1002, 1027, 1053, 1079,
];

export const beat = (i: number): number => {
  if (i < 0 || i >= VIDEO_BEATS.length) {
    throw new Error(`beat index ${i} out of range [0, ${VIDEO_BEATS.length})`);
  }
  return VIDEO_BEATS[i];
};

export const nearestBeat = (frame: number): number => {
  let best = VIDEO_BEATS[0];
  let bestDist = Math.abs(frame - best);
  for (const b of VIDEO_BEATS) {
    const d = Math.abs(frame - b);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
};

export const nearestBeatAfter = (frame: number): number | null => {
  for (const b of VIDEO_BEATS) if (b >= frame) return b;
  return null;
};

export const nearestBeatBefore = (frame: number): number | null => {
  for (let i = VIDEO_BEATS.length - 1; i >= 0; i--) {
    if (VIDEO_BEATS[i] <= frame) return VIDEO_BEATS[i];
  }
  return null;
};

// Translate an absolute beat frame to a scene-local frame.
export const beatLocal = (absoluteBeat: number, sceneStart: number): number =>
  absoluteBeat - sceneStart;

// Triangular envelope around a beat. Returns 0..1.
//   peak (1.0) at the beat frame.
//   ramps up linearly over `attack` frames before the beat.
//   ramps down linearly over `decay` frames after the beat.
//   0 outside that window.
//
// The single shared valve every FX overlay reads through. Linear on
// purpose: easing belongs to the consumer, not the source.
export const beatPulse = (
  frame: number,
  beatIndex: number,
  attack = 4,
  decay = 14,
): number => {
  const target = beat(beatIndex);
  const delta = frame - target;
  if (delta < -attack || delta > decay) return 0;
  if (delta <= 0) return (delta + attack) / attack;
  return 1 - delta / decay;
};
