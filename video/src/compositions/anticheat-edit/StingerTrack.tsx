/**
 * StingerTrack — the SFX layer that scores the overlays. Every hit is computed
 * from the existing chart + article timelines (overlays/stingers.ts), so the
 * sound never drifts from the picture. Each one-shot holds at its gain, then
 * fades its tail so nothing rings on under the voice.
 */

import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { STINGER_HITS } from "./overlays/stingers";

const FPS = 30;

export const StingerTrack: React.FC = () => {
  return (
    <>
      {STINGER_HITS.map((h, i) => {
        const from = Math.max(0, Math.round(h.at * FPS));
        const durationFrames = Math.max(1, Math.round(h.dur * FPS));
        const fadeOut = Math.min(15, Math.round(durationFrames * 0.25));
        return (
          <Sequence
            key={`${h.file}-${i}`}
            from={from}
            durationInFrames={durationFrames}
            layout="none"
          >
            <Audio
              src={staticFile(h.file)}
              volume={(f) =>
                interpolate(
                  f,
                  [0, durationFrames - fadeOut, durationFrames],
                  [h.gain, h.gain, 0],
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
