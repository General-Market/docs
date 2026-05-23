/**
 * AntiCheatEdit — plays the baked final.mp4 with section-title overlays.
 *
 * Cuts and 1.2× speed-up are pre-rendered by /tmp/bake_final.sh via ffmpeg.
 * Remotion plays the single baked file under <OffthreadVideo>, and on top
 * of it we mount the GlowBars chart overlays at section-title timestamps.
 *
 * Overlays sit fullscreen on top of the video for ~6s each — the audio
 * keeps playing underneath, so the talk continues over the chart cuts.
 *
 * Section timestamps are computed from cuts.json — see overlays/timeline.ts.
 */

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import metaJson from "./final.meta.json";
import { OVERLAYS } from "./overlays/timeline";

const FPS = 30;
const W = 1920;
const H = 1080;

const durationSeconds = Number((metaJson as { duration_seconds: number }).duration_seconds) || 1;
const totalDurationFrames = Math.max(1, Math.round(durationSeconds * FPS));

const FADE_FRAMES = 8;

export const AntiCheatEditComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile("anticheat-edit/final.mp4")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {OVERLAYS.map((slot, i) => {
        const startFrame = Math.round(slot.at * FPS);
        const durationFrames = Math.round(slot.duration * FPS);
        const Component = slot.component;
        return (
          <Sequence
            key={`${slot.at}-${i}`}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
          >
            <FadeWrap durationFrames={durationFrames}>
              <Component />
            </FadeWrap>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const FadeWrap: React.FC<{ durationFrames: number; children: React.ReactNode }> = ({
  durationFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    interpolate(frame, [0, FADE_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(
      frame,
      [durationFrames - FADE_FRAMES, durationFrames],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const anticheatEditMeta = {
  id: "AntiCheatEdit",
  component: AntiCheatEditComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: totalDurationFrames,
};
