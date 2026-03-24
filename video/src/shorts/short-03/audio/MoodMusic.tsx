import React, { useCallback } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { secondsToFrame } from "../../../lib/utils/frameConvert";
import { useAudioEngine } from "../../../lib/components/Audio/AudioEngine";

const FPS = 30;
const FADE_FRAMES = 12;

export interface MoodSegment {
  track: string | null;
  startSec: number;
  endSec: number;
}

interface MoodMusicProps {
  baseVolume?: number;
  /** Override mood segments (derived from shot boundaries after cuts). */
  segments?: MoodSegment[];
}

// Default segments (fallback — composition typically passes `segments` prop).
const DEFAULT_SEGMENTS: MoodSegment[] = [
  { track: "music/chill/chill-ambient.mp3", startSec: 0, endSec: 52.56 },
  { track: null, startSec: 52.56, endSec: 57.12 },
];

export const MoodMusic: React.FC<MoodMusicProps> = ({
  baseVolume = 0.12,
  segments,
}) => {
  const moodSegments = segments ?? DEFAULT_SEGMENTS;

  return (
    <>
      {moodSegments.map((segment, i) => {
        if (segment.track === null) return null;

        const fromFrame = secondsToFrame(segment.startSec, FPS);
        const endFrame = secondsToFrame(segment.endSec, FPS);
        const duration = endFrame - fromFrame;

        return (
          <MoodTrack
            key={`mood-${i}-${segment.track}`}
            track={segment.track}
            fromFrame={fromFrame}
            durationInFrames={duration}
            baseVolume={baseVolume}
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
  const audioEngine = useAudioEngine();

  const volume = useCallback(
    (f: number) => {
      // Fade envelope (in/out)
      let fade = 1;
      if (f < FADE_FRAMES) {
        fade = f / FADE_FRAMES;
      }
      const fadeOutStart = durationInFrames - FADE_FRAMES;
      if (f >= fadeOutStart) {
        const remaining = durationInFrames - f;
        fade = remaining / FADE_FRAMES;
      }

      // Auto-level: duck/swell music based on voice loudness
      if (audioEngine) {
        return fade * audioEngine.autoLevel("music", baseVolume, fromFrame + f);
      }

      return fade * baseVolume;
    },
    [baseVolume, durationInFrames, audioEngine, fromFrame],
  );

  return (
    <Sequence from={fromFrame} durationInFrames={durationInFrames}>
      <Audio src={staticFile(track)} volume={volume} />
    </Sequence>
  );
};
