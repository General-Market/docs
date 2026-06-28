/**
 * CRX Demo — the product walkthrough, fit to exactly three minutes.
 *
 * Same treatment as YC2: original colors, untouched — no grade, no filter.
 * No cuts. One clip, one speed: the whole thing eased up just enough to land
 * on exactly 3:00.
 *
 *   rate = 184.448s ÷ 180s ≈ 1.0247×  (about 2.5% faster)
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

/** Measured length of public/crx-demo.mp4 (ffprobe: format.duration). */
export const CRX_DEMO_SOURCE_SECONDS = 184.448;
export const CRX_DEMO_FPS = 30;
/** Native recording size — kept as-is so nothing is cropped. */
export const CRX_DEMO_WIDTH = 1650;
export const CRX_DEMO_HEIGHT = 1078;

export type CRXDemoProps = {
  /** File in public/. */
  src: string;
  /** Final length to hit, exactly. CRX = 180. The speed is derived from this. */
  targetSeconds: number;
  /** Mute the source audio. */
  muted: boolean;
};

export const crxDemoDefaultProps: CRXDemoProps = {
  src: "crx-demo.mp4",
  targetSeconds: 180,
  muted: false,
};

export const crxDemoDurationInFrames = (p: CRXDemoProps, fps = CRX_DEMO_FPS) =>
  Math.round(p.targetSeconds * fps);

export const CRXDemoComposition: React.FC<CRXDemoProps> = ({
  src,
  targetSeconds,
  muted,
}) => {
  // The only way to lose 4.4s with no cuts: speed the whole clip a little.
  const rate = CRX_DEMO_SOURCE_SECONDS / targetSeconds;

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

export const crxDemoMeta = {
  id: "CRXDemo",
  component: CRXDemoComposition,
  durationInFrames: crxDemoDurationInFrames(crxDemoDefaultProps),
  fps: CRX_DEMO_FPS,
  width: CRX_DEMO_WIDTH,
  height: CRX_DEMO_HEIGHT,
};
