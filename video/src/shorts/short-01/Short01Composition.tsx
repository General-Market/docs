import React, { useState, useEffect } from "react";
import {
  AbsoluteFill,
  Series,
  Audio,
  staticFile,
  continueRender,
  delayRender,
} from "remotion";
import type { Caption } from "../../lib/types";

// Lib reuse
import { Vignette } from "../../lib/components/Overlays/Vignette";
import { FilmGrain } from "../../lib/components/Overlays/FilmGrain";
import { ProgressBar } from "../../lib/components/Overlays/ProgressBar";
import { secondsToFrame } from "../../lib/utils/frameConvert";

// Short-01 components
import { ShortProvider } from "./ShortContext";
import { ShotRenderer } from "./components/ShotRenderer";
import { MoodMusic } from "./audio/MoodMusic";
import { Short01Ambient } from "./audio/Short01Ambient";
import { SHORT01_SILENCE_WINDOWS } from "./audio/Short01Music";
import { shots } from "./shots";
import { LAYOUT, COLORS } from "./types";

const ASSET_DIR = "shorts/short-01";

const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

// Pre-compute frame offsets for each shot
const shotFrameOffsets: number[] = [];
let runningOffset = 0;
for (const shot of shots) {
  shotFrameOffsets.push(runningOffset);
  runningOffset += secondsToFrame(shot.durationSeconds);
}
const TOTAL_FRAMES = runningOffset;

// Safe captions loader
const useSafeCaptions = (path: string): Caption[] => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [handle] = useState(() => delayRender("Loading captions"));

  useEffect(() => {
    fetch(staticFile(path))
      .then((r) => r.json())
      .then((data: Caption[]) => {
        if (Array.isArray(data)) setCaptions(data);
        continueRender(handle);
      })
      .catch(() => {
        continueRender(handle);
      });
  }, [path, handle]);

  return captions;
};


export const Short01Composition: React.FC = () => {
  const captions = useSafeCaptions(`${ASSET_DIR}/captions.json`);

  return (
    <ShortProvider assetDir={ASSET_DIR}>
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.BG_BASE,
        fontFamily: FONT_FAMILY,
        overflow: "hidden",
      }}
    >
      {/* Shot sequence */}
      <Series>
        {shots.map((shot, i) => {
          const prevEmotion = i > 0 ? shots[i - 1].chibiEmotion : undefined;
          const nextEmotion = i < shots.length - 1 ? shots[i + 1].chibiEmotion : undefined;
          // Only pass continuity if prev/next shot doesn't force a new entrance
          const prevContinuity = prevEmotion && !shot.chibiEntrance ? prevEmotion : undefined;
          const nextContinuity = nextEmotion && !shots[i + 1]?.chibiEntrance ? nextEmotion : undefined;
          return (
            <Series.Sequence
              key={shot.id}
              durationInFrames={secondsToFrame(shot.durationSeconds)}
            >
              <ShotRenderer
                shot={shot}
                captions={captions}
                globalFrameOffset={shotFrameOffsets[i]}
                prevShotEmotion={prevContinuity}
                nextShotEmotion={nextContinuity}
              />
            </Series.Sequence>
          );
        })}
      </Series>

      {/* Global audio layers */}
      <Audio
        src={staticFile(`${ASSET_DIR}/voice.mp3`)}
        volume={1}
      />

      {/* Mood-based multi-track music */}
      <MoodMusic baseVolume={0.45} />

      <Short01Ambient
        ambientPath={`${ASSET_DIR}/sfx/ambient-hum.mp3`}
        muteRanges={SHORT01_SILENCE_WINDOWS}
        baseVolume={0.02}
      />

      {/* Global overlays */}
      <Vignette opacity={0.3} spread={50} />
      <FilmGrain opacity={0.02} />
      <ProgressBar color={COLORS.ACCENT_BLUE} height={3} />
    </AbsoluteFill>
    </ShortProvider>
  );
};

// Composition metadata for Root.tsx
export const short01Meta = {
  id: "Short01",
  component: Short01Composition,
  durationInFrames: TOTAL_FRAMES,
  fps: LAYOUT.FPS as 30,
  width: LAYOUT.WIDTH as 1080,
  height: LAYOUT.HEIGHT as 1920,
};
