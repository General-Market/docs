import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { useAudioEngine } from "./AudioEngine";

export interface SFXEvent {
  frame: number;
  file: string; // relative to sfxDir
  volume?: number;
  durationFrames?: number;
}

interface Props {
  sfxDir: string;
  events: SFXEvent[];
  /** Shot's position in the composition timeline (enables auto-leveling). */
  globalFrameOffset?: number;
}

export const SFXTrigger: React.FC<Props> = ({
  sfxDir,
  events,
  globalFrameOffset,
}) => {
  const audioEngine = useAudioEngine();

  return (
    <>
      {events.map((e, i) => {
        const baseVol = e.volume ?? 0.6;

        // Auto-level: duck SFX when voice is active
        const volumeProp =
          audioEngine && globalFrameOffset != null
            ? (f: number) =>
                audioEngine.autoLevel(
                  "sfx",
                  baseVol,
                  globalFrameOffset + e.frame + f,
                )
            : baseVol;

        return (
          <Sequence
            key={`sfx-${i}`}
            from={e.frame}
            durationInFrames={e.durationFrames ?? 30}
            layout="none"
          >
            <Audio
              src={staticFile(
                e.file.includes("/") ? e.file : `${sfxDir}/${e.file}`,
              )}
              volume={volumeProp}
            />
          </Sequence>
        );
      })}
    </>
  );
};
