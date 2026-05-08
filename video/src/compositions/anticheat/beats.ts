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
export const MUSIC_START_FROM_AUDIO = 2087;

// Beats that fall inside the music's playing window for the video.
// 36 beats, scene-relative ranges:
//   Hook (0–254):   beats 0–8
//   Bars (228–306): beat 9
//   Rigged (306–484): beats 11–17
//   Stat (460–605): beats 17–21
//   Solution (563–796): beats 21–30
//   Reassure (768–874): beats 29–32
//   Bridge (846–1026): beats 32–35
//   EndCard (>992): no beats — music has tailed out by then.
export const VIDEO_BEATS: readonly number[] = [
  23, 49, 74, 100, 125, 151, 177, 203, 228, 254, 280, 306, 332, 357, 383,
  408, 435, 460, 486, 511, 537, 563, 589, 614, 640, 666, 691, 717, 743,
  768, 794, 820, 846, 871, 897, 923,
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
