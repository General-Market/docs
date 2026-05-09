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
// t≈102.52s, the climax drum spike) lands at video time 34.53s
// (frame 1036), which is 9f INSIDE EndCard — same SPIKE_ENDCARD_LOCAL
// it always was. The Hook was halved (254→112f) and T_HOOK_BARS dropped
// from 18→15, shifting every scene from Bars onward 139f earlier. Music
// start moves +139f into the audio file (1901→2040) to cancel the
// drift. Audio now plays from second 68.00.
export const MUSIC_START_FROM_AUDIO = 2040;

// Beats that fall inside the music's playing window for the video.
// 38 beats at BPM 69.8 (≈26 frames apart), pulled from the audio
// analysis and shifted by MUSIC_START_FROM_AUDIO. Six early beats
// dropped off the front because the music now starts 139f deeper.
//   Hook (0–112):        beats 0–4    (frames  18–96)
//   Bars (97–226):       beats 5–9    (frames 121–224)
//   Rigged (226–404):    beats 10–14  (frames 250–379)
//   Stat (388–533):      beats 15–20  (frames 404–533)
//   Solution (505–738):  beats 21–28  (frames 507–713)
//   Reassure (720–841):  beats 29–32  (frames 738–841)
//   Switch (823–1027):   beats 33–37  (frames 841–944)
//   EndCard (1027–end):  spike at frame 1036; music outro at 36.63s.
export const VIDEO_BEATS: readonly number[] = [
  18, 44, 70, 96, 121, 147, 172, 198, 224, 250, 275, 301, 327, 353, 379,
  404, 430, 455, 482, 507, 533, 558, 584, 610, 636, 661, 687, 713, 738,
  764, 790, 815, 841, 867, 893, 918, 944, 970,
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
  Bars: 97,
  Rigged: 226,
  Stat: 388,
  Solution: 505,
  Reassure: 720,
  Switch: 823,
  EndCard: 1027,
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
