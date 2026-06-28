/**
 * YC2 — the Y Combinator founder video (take 2).
 *
 * Original colors, untouched — no grade, no filter. No cuts. One clip, one
 * speed: the whole thing eased up just enough to land on exactly one minute.
 *
 *   rate = 63.45s ÷ 60s ≈ 1.057×  (about 6% faster)
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

/** Measured length of public/yc2.mov (ffprobe: format.duration). */
export const YC2_SOURCE_SECONDS = 63.445333;
export const YC2_FPS = 30;
export const YC2_WIDTH = 1920;
export const YC2_HEIGHT = 1080;

export type YC2Props = {
  /** File in public/. */
  src: string;
  /** Final length to hit, exactly. YC = 60. The speed is derived from this. */
  targetSeconds: number;
  /** Mute the source audio. */
  muted: boolean;
};

export const yc2DefaultProps: YC2Props = {
  src: "yc2.mov",
  targetSeconds: 60,
  muted: false,
};

export const yc2DurationInFrames = (p: YC2Props, fps = YC2_FPS) =>
  Math.round(p.targetSeconds * fps);

export const YC2Composition: React.FC<YC2Props> = ({
  src,
  targetSeconds,
  muted,
}) => {
  // The only way to lose 3.4s with no cuts: speed the whole clip a little.
  const rate = YC2_SOURCE_SECONDS / targetSeconds;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile(src)}
        playbackRate={rate}
        muted={muted}
        pauseWhenBuffering={false}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};

export const yc2Meta = {
  id: "YC2",
  component: YC2Composition,
  durationInFrames: yc2DurationInFrames(yc2DefaultProps),
  fps: YC2_FPS,
  width: YC2_WIDTH,
  height: YC2_HEIGHT,
};
