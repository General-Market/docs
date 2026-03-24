// TEMPLATE — Copy /src/shorts/_template/ to /src/shorts/your-short/
// Then: replace __TEMPLATE__ with your short ID
//
// ── CLONE CHECKLIST ──────────────────────────────────
// [ ] Copy _template/ to src/shorts/<id>/
// [ ] Replace __TEMPLATE__ with <id> in this file + shots.ts
// [ ] Create public/shorts/<id>/ with: backgrounds/, chibis/, music/, sfx/, voice.mp3, captions.json
// [ ] Write your shots in shots.ts
// [ ] Set COLORS in types.ts
// [ ] Add topic components to sceneRegistry.tsx
// [ ] Register in Root.tsx: import { meta } from "./shorts/<id>/TemplateComposition"
// [ ] Add music segments to MoodMusic segments prop

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

import { Vignette } from "../../lib/components/Overlays/Vignette";
import { FilmGrain } from "../../lib/components/Overlays/FilmGrain";
import { ProgressBar } from "../../lib/components/Overlays/ProgressBar";
import { secondsToFrame } from "../../lib/utils/frameConvert";

import { ShortProvider } from "./ShortContext";
import { ShotRenderer } from "./components/ShotRenderer";
import { MoodMusic } from "./audio/MoodMusic";
import { Ambient } from "./audio/Ambient";
import { shots } from "./shots";
import { LAYOUT, COLORS } from "./types";

const ASSET_DIR = "shorts/__TEMPLATE__";
const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

// Pre-compute frame offsets
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

export const TemplateComposition: React.FC = () => {
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

      <Audio src={staticFile(`${ASSET_DIR}/voice.mp3`)} volume={1} />
      <MoodMusic baseVolume={0.45} />
      <Ambient
        ambientPath={`${ASSET_DIR}/sfx/ambient-hum.mp3`}
        muteRanges={[]}
        baseVolume={0.02}
      />

      <Vignette opacity={0.3} spread={50} />
      <FilmGrain opacity={0.02} />
      <ProgressBar color={COLORS.ACCENT_1} height={3} />
    </AbsoluteFill>
    </ShortProvider>
  );
};

export const meta = {
  id: "__TEMPLATE__",
  component: TemplateComposition,
  durationInFrames: TOTAL_FRAMES,
  fps: LAYOUT.FPS as 30,
  width: LAYOUT.WIDTH as 1080,
  height: LAYOUT.HEIGHT as 1920,
};
