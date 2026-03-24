import React, { useCallback } from "react";
import { Audio, staticFile, useVideoConfig } from "remotion";
import type { Caption } from "../../types";
import { getMusicVolume } from "./volumeUtils";

interface Props {
  musicPath: string;
  captions: Caption[];
}

export const MusicLayer: React.FC<Props> = ({ musicPath, captions }) => {
  const { fps, durationInFrames } = useVideoConfig();

  const volume = useCallback(
    (f: number) => getMusicVolume(f, durationInFrames, captions, fps),
    [durationInFrames, captions, fps],
  );

  return (
    <Audio
      src={staticFile(musicPath)}
      volume={volume}
      startFrom={0}
    />
  );
};
