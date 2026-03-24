/**
 * Long01Composition — 16:9 landscape version of Short01.
 *
 * Same shots, same audio, same timing — only the visual layout adapts
 * via FormatProvider + useLayout().
 */

import React, { useState, useEffect } from "react";
import {
  AbsoluteFill,
  Series,
  Audio,
  staticFile,
  useVideoConfig,
  continueRender,
  delayRender,
} from "remotion";
import type { Caption } from "../../lib/types";

import { FormatProvider } from "../../engine/FormatContext";
import { Vignette } from "../../lib/components/Overlays/Vignette";
import { FilmGrain } from "../../lib/components/Overlays/FilmGrain";
import { ProgressBar } from "../../lib/components/Overlays/ProgressBar";
import { secondsToFrame } from "../../lib/utils/frameConvert";

import { ShortProvider } from "./ShortContext";
import { ShotRenderer } from "./components/ShotRenderer";
import { MoodMusic } from "./audio/MoodMusic";
import { Short01Ambient } from "./audio/Short01Ambient";
import { SHORT01_SILENCE_WINDOWS } from "./audio/Short01Music";
import { shots } from "./shots";
import { COLORS } from "./types";

const ASSET_DIR = "shorts/short-01";
const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

// Pre-compute frame offsets (identical to Short01)
const shotFrameOffsets: number[] = [];
let runningOffset = 0;
for (const shot of shots) {
  shotFrameOffsets.push(runningOffset);
  runningOffset += secondsToFrame(shot.durationSeconds);
}
const TOTAL_FRAMES = runningOffset;

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

export const Long01Composition: React.FC = () => {
  const captions = useSafeCaptions(`${ASSET_DIR}/captions.json`);
  const { width, height } = useVideoConfig();

  return (
    <FormatProvider>
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
          <Audio src={staticFile(`${ASSET_DIR}/voice.mp3`)} volume={1} />
          <MoodMusic baseVolume={0.45} />
          <Short01Ambient
            ambientPath={`${ASSET_DIR}/sfx/ambient-hum.mp3`}
            muteRanges={SHORT01_SILENCE_WINDOWS}
            baseVolume={0.02}
          />

          {/* Global overlays */}
          <Vignette opacity={0.3} spread={50} />
          <FilmGrain opacity={0.02} width={width} height={height} />
          <ProgressBar color={COLORS.ACCENT_BLUE} height={3} />
        </AbsoluteFill>
      </ShortProvider>
    </FormatProvider>
  );
};

export const long01Meta = {
  id: "Long01",
  component: Long01Composition,
  durationInFrames: TOTAL_FRAMES,
  fps: 30 as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
