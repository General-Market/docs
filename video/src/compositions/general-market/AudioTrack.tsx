import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';

interface SfxCue {
  file: string;
  startFrame: number;
  durationInFrames?: number;
  volume?: number;
}

// All entries below are drawn from sfx-review.json "white" list and verified
// to exist in public/sfx/. Do not add SFX from the "black" list.
const CUES: SfxCue[] = [
  // ---------- Scene 1: LIQUIDITY (frames 0-149) ----------
  // Subtle build under the opening
  { file: 'transition-bridge.mp3', startFrame: 0, durationInFrames: 30, volume: 0.55 },
  // Title slam — "Always liquid."
  { file: 'drop-cinematic-hit.mp3', startFrame: 15, durationInFrames: 45, volume: 0.85 },
  { file: 'text-appear-blip.mp3', startFrame: 15, durationInFrames: 20, volume: 0.7 },
  // Subtitle typewriter
  { file: 'text-pop-rapid-sequence.mp3', startFrame: 35, durationInFrames: 40, volume: 0.5 },
  // Grids complete fill — quiet confirm
  { file: 'shape-settle-line.mp3', startFrame: 80, durationInFrames: 40, volume: 0.55 },

  // ---------- Scene 2: COINS + BRACKETS (frames 150-299) ----------
  // Coin appears on OTHERS
  { file: 'metal-coin-flip.mp3', startFrame: 155, durationInFrames: 40, volume: 0.75 },
  // Small bracket draws — short whoosh
  { file: 'cut-fast-swish.mp3', startFrame: 162, durationInFrames: 25, volume: 0.5 },
  // Coin appears on GM
  { file: 'metal-coin-flip.mp3', startFrame: 180, durationInFrames: 40, volume: 0.8 },
  // Large bracket draws — bigger whoosh
  { file: 'whoosh-scene-grid.mp3', startFrame: 188, durationInFrames: 50, volume: 0.7 },
  // Bracket settle accent
  { file: 'shape-drop-bounce.mp3', startFrame: 220, durationInFrames: 25, volume: 0.55 },

  // ---------- Scene 3: GRID EXPANDS (frames 300-449) ----------
  // Title entry
  { file: 'text-appear-blip.mp3', startFrame: 305, durationInFrames: 20, volume: 0.7 },
  // Cinematic grid expansion
  { file: 'bass-drop-sub.mp3', startFrame: 318, durationInFrames: 80, volume: 0.85 },
  // Counter ticks 0 -> 300000 (rapid count-up)
  { file: 'metric-count-up.mp3', startFrame: 330, durationInFrames: 60, volume: 0.7 },
  // Radial pulse peak
  { file: 'boom-cinematic.mp3', startFrame: 388, durationInFrames: 60, volume: 0.85 },
  { file: 'bass-drop-ripple.mp3', startFrame: 388, durationInFrames: 60, volume: 0.6 },

  // ---------- Scene 4: CATEGORIES (frames 450-599) ----------
  // Title entry
  { file: 'text-appear-blip.mp3', startFrame: 455, durationInFrames: 20, volume: 0.7 },
  // Sweeping rapid-pop across the cycling categories
  { file: 'text-pop-rapid-sequence.mp3', startFrame: 470, durationInFrames: 110, volume: 0.6 },
  // Quiet drone underneath the sweep
  { file: 'dramatic-suspense-drone.mp3', startFrame: 460, durationInFrames: 130, volume: 0.25 },
  // End accent on "everything"
  { file: 'logo-shimmer-resolve.mp3', startFrame: 590, durationInFrames: 30, volume: 0.7 },

  // ---------- Scene 5: SETTLEMENT (frames 600-749) ----------
  // Title entry
  { file: 'text-appear-blip.mp3', startFrame: 605, durationInFrames: 20, volume: 0.7 },
  // Slow heartbeat under the left grid pulse
  { file: 'heartbeat.mp3', startFrame: 620, durationInFrames: 100, volume: 0.45 },
  // Rapid clock ticks for the right counter 0 -> 144
  { file: 'env-clock-tick.mp3', startFrame: 620, durationInFrames: 100, volume: 0.55 },
  { file: 'dramatic-countdown-tick.mp3', startFrame: 660, durationInFrames: 60, volume: 0.5 },
  // Settle accent
  { file: 'metal-latch-unlock.mp3', startFrame: 730, durationInFrames: 30, volume: 0.7 },

  // ---------- Scene 6: FORMULA (frames 750-929) ----------
  // Bars fade in
  { file: 'cut-fast-swish.mp3', startFrame: 780, durationInFrames: 25, volume: 0.55 },
  // Four strikethroughs at 800, 820, 840, 860
  { file: 'text-shatter-glass.mp3', startFrame: 800, durationInFrames: 25, volume: 0.65 },
  { file: 'text-shatter-glass.mp3', startFrame: 820, durationInFrames: 25, volume: 0.7 },
  { file: 'text-shatter-glass.mp3', startFrame: 840, durationInFrames: 25, volume: 0.75 },
  { file: 'text-shatter-glass.mp3', startFrame: 860, durationInFrames: 25, volume: 0.8 },
  // OTHERS bar reduced to stub — heavy thud
  { file: 'phys-stomp-heavy.mp3', startFrame: 880, durationInFrames: 30, volume: 0.85 },
  // "pure edge" reveal
  { file: 'dramatic-reveal.mp3', startFrame: 885, durationInFrames: 50, volume: 0.75 },

  // ---------- Outro: CTA (frames 930-1019) ----------
  // Final stinger / logo reveal
  { file: 'stinger-logo-reveal.mp3', startFrame: 930, durationInFrames: 60, volume: 0.85 },
  { file: 'logo-shimmer-resolve.mp3', startFrame: 945, durationInFrames: 45, volume: 0.7 },
];

export const AudioTrack: React.FC = () => {
  return (
    <>
      {CUES.map((cue, i) => (
        <Sequence
          key={`${cue.file}-${i}`}
          from={cue.startFrame}
          durationInFrames={cue.durationInFrames ?? 60}
          layout="none"
        >
          <Audio src={staticFile(`sfx/${cue.file}`)} volume={cue.volume ?? 1} />
        </Sequence>
      ))}
    </>
  );
};
