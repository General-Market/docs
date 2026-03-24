import React, { useCallback } from "react";
import { Audio, staticFile, useVideoConfig } from "remotion";
import type { SilenceWindow } from "../types";
import { secondsToFrame } from "../../../lib/utils/frameConvert";

interface Props {
  musicPath: string;
  silenceWindows: SilenceWindow[];
  baseVolume?: number;
}

/**
 * Music layer with hard-cut silence windows.
 * Unlike MusicLayer (smooth ducking), this cuts music to 0
 * during specified windows for dramatic effect.
 *
 * Music arc from production notes:
 * P1 Setup:    lo-fi chill, building
 * P2 Money:    tension, darker, bass grows
 *   "...zero": SILENCE (hard cut)
 * P2 Insider:  returns darker, building
 * P3 FLIP:     BASS DROP then DEAD AIR
 * Close fun:   lo-fi returns, playful
 * Close loop:  DEAD SILENCE (no music)
 */
export const Short01Music: React.FC<Props> = ({
  musicPath,
  silenceWindows,
  baseVolume = 0.14,
}) => {
  const { durationInFrames } = useVideoConfig();

  const volume = useCallback(
    (f: number) => {
      // Check silence windows
      for (const w of silenceWindows) {
        if (f >= w.startFrame && f < w.endFrame) return 0;
      }

      // Ramp edges near silence windows (5-frame ramp)
      const rampFrames = 5;
      for (const w of silenceWindows) {
        // Ramp down into silence
        if (f >= w.startFrame - rampFrames && f < w.startFrame) {
          const progress = (w.startFrame - f) / rampFrames;
          return baseVolume * progress;
        }
        // Ramp up out of silence
        if (f >= w.endFrame && f < w.endFrame + rampFrames) {
          const progress = (f - w.endFrame) / rampFrames;
          return baseVolume * progress;
        }
      }

      // Fade in at start
      if (f < 30) return baseVolume * (f / 30);

      // Fade out at end
      if (f > durationInFrames - 60) {
        return baseVolume * ((durationInFrames - f) / 60);
      }

      return baseVolume;
    },
    [silenceWindows, baseVolume, durationInFrames],
  );

  return (
    <Audio
      src={staticFile(musicPath)}
      volume={volume}
      startFrom={0}
    />
  );
};

// Pre-computed silence windows from actual shot timings at 30fps
// DJI voice, splice-edited v4 (73.41s total, 32 shots)
export const SHORT01_SILENCE_WINDOWS: SilenceWindow[] = [
  // Shot 7 "That's not fandom" — tension drop (12.83s to 14.15s)
  {
    startFrame: secondsToFrame(12.83),
    endFrame: secondsToFrame(14.15),
  },
  // Shot 18 "$0" — dead silence (36.21s to 38.11s)
  {
    startFrame: secondsToFrame(36.21),
    endFrame: secondsToFrame(38.11),
  },
  // Shot 28: dead air (61.23s to 63.19s)
  {
    startFrame: secondsToFrame(61.23),
    endFrame: secondsToFrame(63.19),
  },
];
