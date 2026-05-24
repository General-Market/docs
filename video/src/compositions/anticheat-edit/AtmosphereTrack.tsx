/**
 * AtmosphereTrack — low beds under the music: the institutional hum, the dark
 * drone, the clock, the heartbeat and sub-rumble of the dread peak. All dark
 * textures clear by the turn (§9, 648s) so the resolution breathes.
 *
 * Mixed near-invisible (see overlays/atmos.ts gains). Long 2s fades keep the
 * loops seamless and the entries imperceptible.
 */

import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { ATMOS_CUES } from "./overlays/atmos";

const FPS = 30;
const FADE = 2.0;

export const AtmosphereTrack: React.FC = () => {
  return (
    <>
      {ATMOS_CUES.map((cue) => {
        const startFrame = Math.round(cue.at * FPS);
        const durationFrames = Math.max(1, Math.round((cue.until - cue.at) * FPS));
        const fade = Math.round(FADE * FPS);
        return (
          <Sequence
            key={`${cue.file}-${cue.at}`}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
            name={cue.label}
          >
            <Audio
              src={staticFile(`anticheat-edit/atmos/${cue.file}`)}
              loop={cue.loop}
              volume={(f) =>
                interpolate(
                  f,
                  [0, fade, durationFrames - fade, durationFrames],
                  [0, cue.gain, cue.gain, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                )
              }
            />
          </Sequence>
        );
      })}
    </>
  );
};
