import React from "react";
import type { ShotDef, VoiceSegment } from "./types";
import { LAYOUT } from "./types";
import { VoiceSyncChibi } from "./components/VoiceSyncChibi";

interface Props {
  shot: ShotDef;
  globalFrameOffset: number;
  prevShotEmotion?: string;
  nextShotEmotion?: string;
  voiceSegments?: VoiceSegment[];
}

export const ChibiSlot: React.FC<Props> = ({
  shot,
  globalFrameOffset,
  prevShotEmotion,
  nextShotEmotion,
  voiceSegments,
}) => {
  if (!shot.chibiEmotion) return null;

  const durationFrames = Math.round(shot.durationSeconds * LAYOUT.FPS);

  return (
    <VoiceSyncChibi
      emotion={shot.chibiEmotion}
      animation={shot.chibiAnimation}
      entrance={shot.chibiEntrance}
      delay={shot.chibiDelay}
      isFirstShot={shot.isFirstShot}
      globalFrameOffset={globalFrameOffset}
      shotDurationFrames={durationFrames}
      entranceVfx={shot.chibiEntranceVfx}
      exitStyle={shot.chibiExit}
      zoomDrift={shot.chibiZoomDrift}
      rainCloud={shot.chibiRainCloud}
      expressions={shot.chibiExpressions}
      flipY={shot.chibiFlipY}
      prevShotEmotion={prevShotEmotion}
      nextShotEmotion={nextShotEmotion}
      voiceSegments={voiceSegments ?? shot.voiceSegments}
    />
  );
};
