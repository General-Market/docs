/**
 * MusicTrack — the score, as its own layer over the baked voice (final.mp4).
 *
 * Four cues carry the emotional arc (overlays/music.ts): the dark exposé, the
 * turn, the warm close. Each cue enters at a punchy point *inside* its track
 * (`trimStart`, an exact beat at high energy) so the music lands at force on the
 * first frame — never the slow 0:00 climb.
 *
 * A cue can outlast its track's remaining audio, so we loop the *trimmed*
 * segment: one <Audio trimBefore={trimStart}> per pass, back-to-back, each
 * re-entering just as punchy as the first. Passes crossfade at the seam; the
 * cue as a whole fades in at `at` and out at `until` so the hand-offs don't
 * click. Volume is ducked under the voice.
 */

import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { MUSIC_CUES } from "./overlays/music";

const FPS = 30;
const CUE_FADE_IN = 0.8;
const CUE_FADE_OUT = 1.2;
const SEAM_FADE = 0.6; // crossfade between loop passes of the same track

export const MusicTrack: React.FC = () => {
  return (
    <>
      {MUSIC_CUES.map((cue) => {
        const cueStart = Math.round(cue.at * FPS);
        const cueFrames = Math.max(1, Math.round((cue.until - cue.at) * FPS));
        const trimmedLen = Math.max(0.5, cue.trackDuration - cue.trimStart);
        const passFrames = Math.max(1, Math.round(trimmedLen * FPS));
        const trimBeforeFrames = Math.round(cue.trimStart * FPS);
        const seam = Math.round(SEAM_FADE * FPS);
        const cueFadeIn = Math.round(CUE_FADE_IN * FPS);
        const cueFadeOut = Math.round(CUE_FADE_OUT * FPS);

        // How many trimmed passes are needed to cover the cue.
        const passes = Math.max(1, Math.ceil(cueFrames / passFrames));

        return Array.from({ length: passes }).map((_, p) => {
          const localFrom = p * passFrames;
          const from = cueStart + localFrom;
          // Clip the last pass to the cue boundary.
          const remaining = cueFrames - localFrom;
          const thisPass = Math.min(passFrames, remaining);
          if (thisPass <= 0) return null;

          const isFirstPass = p === 0;
          const isCueTail = localFrom + thisPass >= cueFrames;

          return (
            <Sequence
              key={`${cue.file}-${p}`}
              from={from}
              durationInFrames={thisPass}
              layout="none"
              name={`${cue.label}${passes > 1 ? ` (pass ${p + 1}/${passes})` : ""}`}
            >
              <Audio
                src={staticFile(`anticheat-edit/music/${cue.file}`)}
                trimBefore={trimBeforeFrames}
                volume={(f) => {
                  // Pass-level envelope: crossfade seams between loop passes.
                  const fadeInFrames = isFirstPass ? cueFadeIn : seam;
                  const fadeOutFrames = isCueTail ? cueFadeOut : seam;
                  const env = interpolate(
                    f,
                    [0, fadeInFrames, thisPass - fadeOutFrames, thisPass],
                    [0, cue.gain, cue.gain, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  );
                  return env;
                }}
              />
            </Sequence>
          );
        });
      })}
    </>
  );
};
