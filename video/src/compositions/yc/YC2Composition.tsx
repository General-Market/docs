/**
 * YC2 — the Y Combinator founder video (take 2).
 *
 * The source is 63.45s; YC allows exactly one minute. We don't cut it — we
 * speed the whole clip, a little and evenly, so it lands on the target. One
 * clip, one rate, no splices: ~1.057× for 63.45s → 60.00s.
 *
 * Colorimetry: a gentle grade on the video (de-haze with a touch more contrast
 * and saturation) plus the local ColorGrade warm wash over the top. Both are
 * props — dial them in the Studio.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { ColorGrade, type GradePreset } from "../vision/vc/overlays/ColorGrade";

/** Measured length of public/yc2.mov (ffprobe: format.duration). */
export const YC2_SOURCE_SECONDS = 63.445333;
export const YC2_FPS = 30;
export const YC2_WIDTH = 1920;
export const YC2_HEIGHT = 1080;

export interface YC2Props {
  /** File in public/. */
  src: string;
  /** Final length to hit, exactly. YC = 60. The rate is derived from this. */
  targetSeconds: number;
  /** CSS filter graded onto the video. */
  videoFilter: string;
  /** Local ColorGrade preset for the wash over the top. */
  grade: GradePreset;
  /** Wash strength, 0–1. */
  gradeIntensity: number;
  /** Mute the source audio. */
  muted: boolean;
}

export const yc2DefaultProps: YC2Props = {
  src: "yc2.mov",
  targetSeconds: 60,
  videoFilter: "contrast(1.16) saturate(0.98) brightness(0.96)",
  grade: "clinical",
  gradeIntensity: 0.2,
  muted: false,
};

export const yc2DurationInFrames = (targetSeconds: number, fps = YC2_FPS) =>
  Math.round(targetSeconds * fps);

export const YC2Composition: React.FC<YC2Props> = ({
  src,
  targetSeconds,
  videoFilter,
  grade,
  gradeIntensity,
  muted,
}) => {
  // One clip, one speed — compress the whole thing just enough to fit.
  const rate = YC2_SOURCE_SECONDS / targetSeconds;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile(src)}
        playbackRate={rate}
        muted={muted}
        pauseWhenBuffering={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: videoFilter,
        }}
      />
      <ColorGrade preset={grade} intensity={gradeIntensity} />
    </AbsoluteFill>
  );
};

export const yc2Meta = {
  id: "YC2",
  component: YC2Composition,
  durationInFrames: yc2DurationInFrames(yc2DefaultProps.targetSeconds),
  fps: YC2_FPS,
  width: YC2_WIDTH,
  height: YC2_HEIGHT,
};
