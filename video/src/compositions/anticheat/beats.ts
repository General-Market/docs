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
// Locked invariant: the music's strongest energy plateau (audio
// t≈102.52s, the climax drum spike) lands at video time 39.15s
// (frame 1175). With the previous start (1931) the spike fell at
// 38.15s; user wanted it pushed +1s to coincide with the EndCard
// underline completion. MUSIC_START_FROM_AUDIO drops by 30 so the
// audio plays from second 63.37 — the spike now lands ~27f INSIDE
// EndCard rather than on the Switch→EndCard cut at frame 1148.
export const MUSIC_START_FROM_AUDIO = 1901;

// Beats that fall inside the music's playing window for the video.
// 44 beats at BPM 69.8 (≈26 frames apart), pulled from the audio
// analysis and shifted by MUSIC_START_FROM_AUDIO. Two extra early
// beats now fit because the music starts 30f sooner.
//   Hook (0–254):       beats  0–9   (frames   3–235)
//   Bars (236–365):     beats 10–13  (frames 260–337)
//   Rigged (365–543):   beats 14–20  (frames 363–518)
//   Stat (527–672):     beats 20–25  (frames 518–646)
//   Solution (644–877): beats 25–32  (frames 646–852)
//   Reassure (859–980): beats 33–37  (frames 877–980)
//   Switch (962–1148):  beats 38–42  (frames 1006–1109)
//   EndCard (1148–end): spike at frame 1175; music outro at 41.27s.
export const VIDEO_BEATS: readonly number[] = [
  3, 29, 54, 80, 106, 132, 157, 183, 209, 235, 260, 286, 311, 337, 363,
  389, 414, 440, 466, 492, 518, 543, 569, 594, 621, 646, 672, 697, 723,
  749, 775, 800, 826, 852, 877, 903, 929, 954, 980, 1006, 1032, 1057,
  1083, 1109,
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

// Absolute start frame of every scene in AntiCheatFull. Derived from
// scene durations and TransitionSeries overlaps; recompute if either
// changes. Lets scene components drive beat-pulse FX from
// useCurrentFrame() without knowing their parent offset.
export const SCENE_STARTS = {
  Hook: 0,
  Bars: 236,
  Rigged: 365,
  Stat: 527,
  Solution: 644,
  Reassure: 859,
  Switch: 962,
  EndCard: 1166,
} as const;

export type SceneName = keyof typeof SCENE_STARTS;

// The drum spike — strongest energy plateau in the audio (t≈102.52s).
// Lands inside EndCard at scene-local frame 9. Visual climax anchor.
export const SPIKE_ENDCARD_LOCAL = 9;

// Max beat envelope across every beat that falls inside a scene's
// window, expressed in scene-local frames. Pass useCurrentFrame()
// directly. Returns 0..1 — peaks on each beat, decays in between.
export const beatPulseScene = (
  localFrame: number,
  scene: SceneName,
  attack = 4,
  decay = 14,
): number => {
  const start = SCENE_STARTS[scene];
  let max = 0;
  for (const b of VIDEO_BEATS) {
    const sceneLocalBeat = b - start;
    const delta = localFrame - sceneLocalBeat;
    if (delta < -attack || delta > decay) continue;
    const env =
      delta <= 0 ? (delta + attack) / attack : 1 - delta / decay;
    if (env > max) max = env;
  }
  return max;
};

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
