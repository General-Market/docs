import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { Scene01 } from "./Scene01";
import { Scene02 } from "./Scene02";
import { Scene03, scene03Meta } from "./Scene03";
import { Scene04, scene04Meta } from "./Scene04";
import { Scene05, scene05Meta } from "./Scene05";
import { scene01Meta } from "./Scene01";
import { scene02Meta } from "./Scene02";
import { OFReplicateSFX } from "./OFReplicateSFX";

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
 * S04→S05: deep zoom transition.
 * Longer than standard XFADE so the zoom is visible while
 * S04 still has content (before it goes fully black).
 */
const S04_S05_OVERLAP = 24;

/* Scene durations
 * Cut at 0:35 (frame 1050 absolute) — phone scene stays in S03
 * Cut at 0:48 (frame 1440 absolute) — 3D dark mode all in S05
 * S01: 0:00-0:08 (259 frames)
 * S02: 0:08-0:14 (175 frames)
 * S03: 0:14-0:35 = 21s = 630 frames (was 745, moved phone end to S04)
 * S04: 0:35-0:48 = 13s = 390 frames (was 339, gained phone start + lost dark mode end)
 * S05: 0:48-1:14 = 26s = 780 frames (was 695, gained dark mode start)
 */
const S01_DUR = 259;
const S02_DUR = 175;
const S03_DUR = 630;
const S04_DUR = 390;
const S05_DUR = 780;

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

export const OFReplicateComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* ── SFX only — Google Material Design sounds, frame-synced ── */}
      <OFReplicateSFX />

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
           Deep zoom out: scene scales to 3x over 24 frames while fading,
           so the zoom is visible while Gemini UI content is still bright. */}
      <Sequence from={S04_START} durationInFrames={S04_DUR} name="Scene 04">
        <FadeWrapper duration={S04_DUR} fadeOutFrames={S04_S05_OVERLAP} scaleOut={3}>
          <Scene04 />
        </FadeWrapper>
      </Sequence>

      {/* ── Scene 05 ──
           Deep zoom in: dark scene starts at 0.3x, grows to 1x over
           the full 24-frame overlap. "Diving into screen" at boundary. */}
      <Sequence from={S05_START} durationInFrames={S05_DUR} name="Scene 05">
        <FadeWrapper duration={S05_DUR} fadeInFrames={S04_S05_OVERLAP} scaleIn={0.3}>
          <Scene05 />
        </FadeWrapper>
      </Sequence>
    </AbsoluteFill>
  );
};

export const ofReplicateMeta = {
  id: "OFReplicate",
  component: OFReplicateComposition,
  width: 1280, height: 720, fps: 30,
  durationInFrames: TOTAL_FRAMES,
};

export const ofSceneMetas = [scene01Meta, scene02Meta, scene03Meta, scene04Meta, scene05Meta];
