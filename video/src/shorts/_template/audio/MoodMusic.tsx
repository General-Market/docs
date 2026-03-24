// TEMPLATE — Copy /src/shorts/_template/ to /src/shorts/your-short/
// Then: replace __TEMPLATE__ with your short ID

import React, { useCallback } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { secondsToFrame } from "../../../lib/utils/frameConvert";
import { useShortContext } from "../ShortContext";

const FPS = 30;
const FADE_FRAMES = 10;

interface MoodMusicProps {
  baseVolume?: number;
}

interface MoodSegment {
  track: string | null;
  startSec: number;
  endSec: number;
}

// TODO: Define your mood segments here
const MOOD_SEGMENTS: MoodSegment[] = [
  // Example:
  // { track: "music/energetic/energetic-dynamic.mp3", startSec: 0, endSec: 5.0 },
  // { track: null, startSec: 5.0, endSec: 6.0 }, // silence
];

export const MoodMusic: React.FC<MoodMusicProps> = ({
  baseVolume = 0.35,
}) => {
  const { assetDir } = useShortContext();
  const musicDir = `${assetDir}/music/`;

  return (
    <>
      {MOOD_SEGMENTS.map((segment, i) => {
        if (segment.track === null) return null;

        const fromFrame = secondsToFrame(segment.startSec, FPS);
        const endFrame = secondsToFrame(segment.endSec, FPS);
        const duration = endFrame - fromFrame;

        return (
          <MoodTrack
            key={`mood-${i}-${segment.track}`}
            track={segment.track}
            musicDir={musicDir}
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
  musicDir: string;
  fromFrame: number;
  durationInFrames: number;
  baseVolume: number;
}

const MoodTrack: React.FC<MoodTrackProps> = ({
  track,
  musicDir,
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
      <Audio
        src={staticFile(
          track.includes("/") ? track : `${musicDir}${track}`,
        )}
        volume={volume}
      />
    </Sequence>
  );
};
