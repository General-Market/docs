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
// 41 beats at BPM 69.8 (≈26 frames apart). Scene-relative ranges with
// the current scene durations and transition lengths:
//   Hook (0–254):       beats 0–9   (frames 17–248)
//   Bars (236–365):     beats 9–13  (frames 248–351)
//   Rigged (365–543):   beats 14–20 (frames 377–531)
//   Stat (527–672):     beats 20–25 (frames 531–660)
//   Solution (644–877): beats 25–33 (frames 660–866)
//   Reassure (859–965): beats 34–36 (frames 866–943)
//   Switch (947–1127):  beats 37–40 (frames 969–1046)
//   EndCard (1103–end): no beats — the music is in its outro by then.
export const VIDEO_BEATS: readonly number[] = [
  17, 43, 69, 94, 120, 146, 172, 197, 223, 248, 274, 300, 326, 351, 377,
  403, 429, 455, 480, 506, 531, 558, 583, 609, 634, 660, 686, 712, 737,
  763, 789, 814, 840, 866, 891, 917, 943, 969, 994, 1020, 1046,
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
