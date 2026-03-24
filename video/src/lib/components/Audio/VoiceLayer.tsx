import React from "react";
import { Audio, staticFile } from "remotion";

interface Props {
  voicePath: string;
  volume?: number;
  startFrame?: number;
}

export const VoiceLayer: React.FC<Props> = ({
  voicePath,
  volume = 1.0,
  startFrame = 0,
}) => {
  return (
    <Audio
      src={staticFile(voicePath)}
      volume={volume}
      startFrom={startFrame}
    />
  );
};
