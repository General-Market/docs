import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { Scene01 } from "./Scene01";
import { Scene02 } from "./Scene02";
import { Scene03, scene03Meta } from "./Scene03";
import { Scene04, scene04Meta } from "./Scene04";
import { Scene05, scene05Meta } from "./Scene05";
import { scene01Meta } from "./Scene01";
import { scene02Meta } from "./Scene02";
import { GMBrandSFX } from "./GMBrandSFX";

/**
 * Standard crossfade duration at most scene boundaries (in frames).
 * 12 frames @ 30fps = 0.4s.
 */
const XFADE = 12;

/**
 * S03→S04: hard cut, zero overlap.
 * The same phone persists across the boundary — any overlap
 * or crossfade ghosts two phones. Clean cut preserves continuity.
 */
const S03_S04_OVERLAP = 0;

/**
 * S04→S05: smooth opacity crossfade.
 * 8 frames — just enough for a clean float, no zoom, no gimmick.
 */
const S04_S05_OVERLAP = 15;

/* Scene durations
 * Cut at 0:35 (frame 1050 absolute) — phone scene stays in S03
 * Cut at 0:48 (frame 1440 absolute) — 3D dark mode all in S05
 * S01: 0:00-0:08 (259 frames)
 * S02: 0:08-0:14 (175 frames)
 * S03: 0:14-0:36 = 22s = 680 frames (extended to fit "supercharge" text)
 * S04: 0:36-0:48 = 12s = 360 frames (starts after supercharge)
 * S05: 0:48-1:14 = 26s = 780 frames (was 695, gained dark mode start)
 */
const S01_DUR = 259;
const S02_DUR = 175;
const S03_DUR = 680;
const S04_DUR = 360;
const S05_DUR = 720;

/* Calculate absolute start positions */
const S01_START = 0;
const S02_START = S01_START + S01_DUR - XFADE;      // 247
const S03_START = S02_START + S02_DUR - XFADE;      // 410
const S04_START = S03_START + S03_DUR - S03_S04_OVERLAP; // 1155 (hard cut)
const S05_START = S04_START + S04_DUR - S04_S05_OVERLAP; // deeper overlap for zoom

const TOTAL_FRAMES = S05_START + S05_DUR;

/**
 * FadeWrapper — simple opacity crossfade for standard transitions.
 * fadeIn: frame range where opacity goes 0→1 (relative to sequence start)
 * fadeOut: frame range where opacity goes 1→0 (relative to sequence start)
 *
 * Deep zoom variant (scaleOut / scaleIn): instead of plain opacity,
 * the outgoing scene scales UP while fading, the incoming scene scales
 * up FROM a smaller size — "diving into the screen" effect.
 */
const FadeWrapper: React.FC<{
  children: React.ReactNode;
  duration: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  /** Scale from 1→scaleOut during fadeOut (deep zoom out) */
  scaleOut?: number;
  /** Scale from scaleIn→1 during fadeIn (deep zoom in) */
  scaleIn?: number;
}> = ({ children, duration, fadeInFrames = 0, fadeOutFrames = 0, scaleOut, scaleIn }) => {
  const frame = useCurrentFrame();
  const fadeIn = fadeInFrames > 0
    ? interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const fadeOut = fadeOutFrames > 0
    ? interpolate(frame, [duration - fadeOutFrames, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  let scale = 1;
  if (scaleOut && fadeOutFrames > 0) {
    scale *= interpolate(frame, [duration - fadeOutFrames, duration], [1, scaleOut], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  if (scaleIn && fadeInFrames > 0) {
    scale *= interpolate(frame, [0, fadeInFrames], [scaleIn, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut, transform: scale !== 1 ? `scale(${scale})` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * BlackBandReveal — rounded-rect clip-path expanding from center.
 * Like zooming into the letter "O". A black band with border-radius ~40px
 * grows from 0 height to full viewport height over `revealFrames`.
 */
const BlackBandReveal: React.FC<{
  children: React.ReactNode;
  duration: number;
  revealFrames: number;
}> = ({ children, duration, revealFrames }) => {
  const frame = useCurrentFrame();

  // Progress 0→1 over revealFrames
  const progress = interpolate(frame, [0, revealFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Eased progress — expo out for fast start, decelerating
  const eased = 1 - Math.pow(1 - progress, 3);

  // The band expands vertically from center.
  // insetY: starts at 50% (invisible), goes to 0% (full height)
  const insetY = (1 - eased) * 50;
  // Horizontal: starts at ~12.5% (3/4 width band) and expands to 0%
  const insetX = (1 - eased) * 12.5;
  // Border radius: starts large (like an "O"), shrinks to 0
  const radius = Math.round(40 * (1 - eased));

  const clipPath = `inset(${insetY.toFixed(1)}% ${insetX.toFixed(1)}% ${insetY.toFixed(1)}% ${insetX.toFixed(1)}% round ${radius}px)`;

  return (
    <AbsoluteFill style={{ clipPath }}>
      {children}
    </AbsoluteFill>
  );
};

export const GMBrandComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* ── SFX — frame-synced ── */}
      <GMBrandSFX />

      {/* ── Scene 01 ── */}
      <Sequence from={S01_START} durationInFrames={S01_DUR} name="Scene 01">
        <FadeWrapper duration={S01_DUR} fadeOutFrames={XFADE}>
          <Scene01 />
        </FadeWrapper>
      </Sequence>

      {/* ── Scene 02 ── */}
      <Sequence from={S02_START} durationInFrames={S02_DUR} name="Scene 02">
        <FadeWrapper duration={S02_DUR} fadeInFrames={XFADE} fadeOutFrames={XFADE}>
          <Scene02 />
        </FadeWrapper>
      </Sequence>

      {/* ── Scene 03 ──
           Fades in from S02. No fade out — S04 renders on top during overlap.
           S03's SegPhoneGoodMorning handles its own phone fade internally. */}
      <Sequence from={S03_START} durationInFrames={S03_DUR} name="Scene 03">
        <FadeWrapper duration={S03_DUR} fadeInFrames={XFADE}>
          <Scene03 />
        </FadeWrapper>
      </Sequence>

      {/* ── Scene 04 ──
           Starts S03_S04_OVERLAP frames before S03 ends.
           Draws ON TOP of S03 (later in DOM = higher z-index).
           No fade-in — S04 manages its own phone visibility.
           Fades out during overlap so the black band reveal can take over. */}
      <Sequence from={S04_START} durationInFrames={S04_DUR} name="Scene 04">
        <FadeWrapper duration={S04_DUR} fadeOutFrames={S04_S05_OVERLAP} scaleOut={3.0}>
          <Scene04 />
        </FadeWrapper>
      </Sequence>

      {/* ── Scene 05 ── fast smooth fade, no zoom gimmick */}
      <Sequence from={S05_START} durationInFrames={S05_DUR} name="Scene 05">
        <FadeWrapper duration={S05_DUR} fadeInFrames={S04_S05_OVERLAP} scaleIn={0.5}>
          <Scene05 />
        </FadeWrapper>
      </Sequence>
    </AbsoluteFill>
  );
};

export const gmBrandMeta = {
  id: "GMBrand",
  component: GMBrandComposition,
  width: 1280, height: 720, fps: 30,
  durationInFrames: TOTAL_FRAMES,
};

export const gmSceneMetas = [scene01Meta, scene02Meta, scene03Meta, scene04Meta, scene05Meta];
