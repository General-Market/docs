import React, { useCallback } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { secondsToFrame } from "../../../lib/utils/frameConvert";
import { useShortContext } from "../ShortContext";

const FPS = 30;
const FADE_FRAMES = 10;

interface MoodMusicProps {
  baseVolume?: number; // default 0.35
}

interface MoodSegment {
  track: string | null; // null = silence
  startSec: number;
  endSec: number;
}

const MOOD_SEGMENTS: MoodSegment[] = [
  // 1. Energetic dynamic — shots 1-2, HOOK punch (fast grab)
  { track: "music/energetic/energetic-dynamic.mp3", startSec: 0, endSec: 5.67 },
  // 2. Tension building — shots 3-6, K-drama escalation (strings + rising dread through compounding list)
  { track: "music/tension/tension-building.mp3", startSec: 5.67, endSec: 12.83 },
  // 3. SILENCE — shot 7, "That's not fandom" DROP (tension release = dead air payoff)
  { track: null, startSec: 12.83, endSec: 14.15 },
  // 4. Dramatic reveal — shot 8, "That's a trading desk" (payoff hit after silence)
  { track: "music/dramatic/dramatic-reveal.mp3", startSec: 14.15, endSec: 16.61 },
  // 5. Energetic intense — shots 9-14, Sony/Crunchyroll corporate $$$ (serious energy)
  { track: "music/energetic/energetic-intense.mp3", startSec: 16.61, endSec: 28.97 },
  // 6. Energetic action — shots 15-17, Fandom exploitation → $0 setup (forward push)
  { track: "music/energetic/energetic-action.mp3", startSec: 28.97, endSec: 36.21 },
  // 7. SILENCE — shot 18, $0 slam
  { track: null, startSec: 36.21, endSec: 38.11 },
  // 8. Inspiring motivational — shots 19-22, personal pivot → thesis (hopeful trust)
  { track: "music/inspiring/inspiring-motivational.mp3", startSec: 38.11, endSec: 48.76 },
  // 9. Inspiring uplifting — shots 23-25, Gen Z flip (building payoff)
  { track: "music/inspiring/inspiring-uplifting.mp3", startSec: 48.76, endSec: 58.23 },
  // 10. Energetic pump-up — shots 26-27, bass drop (quick hit)
  { track: "music/energetic/energetic-pump-up.mp3", startSec: 58.23, endSec: 61.23 },
  // 11. SILENCE — shot 28, dead air
  { track: null, startSec: 61.23, endSec: 63.19 },
  // 12. Happy upbeat — shots 29-32, fun meta close (energetic wrap)
  { track: "music/happy/happy-upbeat.mp3", startSec: 63.19, endSec: 73.41 },
];

/**
 * Mood-based multi-track music system.
 *
 * Replaces the single-track + silence-windows approach with discrete
 * audio segments, each mapped to a specific mood track. Each segment
 * fades in over 10 frames and fades out over 10 frames for smooth
 * transitions between moods.
 *
 * Music arc (Korean-drama tension build):
 *   P1 Setup  (0-16.5s):    energetic-dynamic (5.7s hook) -> tension-building (list) -> SILENCE (drop) -> dramatic-reveal
 *   P2 Money  (16.5-48.7s): energetic-intense -> energetic-action -> SILENCE -> inspiring-motivational
 *   P3 Flip   (48.7-63.1s): inspiring-uplifting -> energetic-pump-up -> SILENCE
 *   Close     (63.1-73.3s): happy-upbeat
 */
export const MoodMusic: React.FC<MoodMusicProps> = ({
  baseVolume = 0.35,
}) => {
  const { assetDir } = useShortContext();
  const musicDir = `${assetDir}/music/`;

  return (
    <>
      {MOOD_SEGMENTS.map((segment, i) => {
        // Skip silence segments — no audio to render
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
      // f is relative to the Sequence (0-based within this segment)

      // Fade in over FADE_FRAMES at start
      if (f < FADE_FRAMES) {
        return baseVolume * (f / FADE_FRAMES);
      }

      // Fade out over FADE_FRAMES at end
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
