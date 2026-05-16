// ExplorerProof — landing video that mirrors HoudiniSwap's format. A
// flat CSS phone in the middle plays a portrait screen recording of
// /explorer; a CSS-3D coin field drifts behind it; left/right side
// texts read GENERALMARKET and GENERALMARKET.IO; nine timed beats walk
// the camera through zoom/dezoom/pan moves; an end card crossfades in
// over the final two seconds.
//
// Drop the screen recording at video/public/broll/explorer-broll.mp4
// and the studio picks it up. Until then the studio falls back to
// glacier-drone.mp4 so the choreography is previewable.

import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { CoinsBackground } from "./CoinsBackground";
import { CssPhone } from "./CssPhone";
import { SideTexts } from "./SideTexts";
import { EndCard } from "./EndCard";

export type ExplorerProofProps = {
  brollPath: string;
};

// Real /explorer screen recording (mobile portrait, 450x972, ~18.5s).
// Recorded with Playwright against https://generalmarket.io/explorer —
// proves the testnet is live in the video itself.
const DEFAULT_BROLL_PATH = "broll/explorer-broll.mp4";
const FALLBACK_BROLL_PATH = "broll/explorer-broll.mp4";

const BG_COLOR = "#E0D8EC";

const BREAKPOINTS = [0, 300, 540, 780, 1020, 1260, 1500, 1740, 1980, 2100];
const EASE = Easing.bezier(0.4, 0, 0.6, 1);

const driveProp = (frame: number, values: number[]) =>
  interpolate(frame, BREAKPOINTS, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

export const ExplorerProof: React.FC<ExplorerProofProps> = ({ brollPath }) => {
  const frame = useCurrentFrame();
  const brollSrc = staticFile(brollPath);

  // ── Camera beats (matched to the 9 reference frames) ─────────────────
  //   1  0..300    dezoom wide
  //   2  300..540  zoom in on swap form
  //   3  540..780  phone up (tilt forward)
  //   4  780..1020 phone down (tilt back)
  //   5 1020..1260 dezoom
  //   6 1260..1500 dezoom + slight yaw right
  //   7 1500..1740 zoom close
  //   8 1740..1980 dezoom
  //   9 1980..2100 zoom into end card

  // Phone scale — wider swing makes each beat read as a real camera
  // move instead of a slow drift. 0.8 dezoom → 1.45 close-up.
  const phoneScale = driveProp(frame, [
    0.8, 1.25, 1.4, 1.4, 0.85, 0.85, 1.5, 0.8, 1.2, 1.2,
  ]);

  // Phone vertical translate — bigger lift/drop for the up/down beats.
  const phoneTranslateY = driveProp(frame, [
    0, 0, -140, 140, 0, 0, 0, 0, 0, 0,
  ]);

  // Tilt — sharper lean during the up/down beats. Degrees.
  const phoneRotateX = driveProp(frame, [
    0, 0, -10, 10, 0, 0, 0, 0, 0, 0,
  ]);

  // Yaw — beat 6 turns the phone to the right.
  const phoneRotateY = driveProp(frame, [
    0, 0, 0, 0, 0, 14, 0, 0, 0, 0,
  ]);

  // Coin field — recedes when we zoom in, blooms when we pull back.
  const coinsForward = driveProp(frame, [
    0.95, 0.3, 0.2, 0.2, 0.85, 0.9, 0.15, 1.0, 0.4, 0.4,
  ]);
  const coinsOpacity = driveProp(frame, [
    1.0, 0.7, 0.6, 0.6, 1.0, 1.0, 0.5, 1.0, 1.0, 1.0,
  ]);

  // Side texts dim during close-ups and the final beat.
  const sideTextsVis = driveProp(frame, [
    1.0, 0.8, 0.7, 0.7, 1.0, 1.0, 0.6, 1.0, 0.5, 0.5,
  ]);

  // End card crossfade over the last two seconds.
  const endCardProg = interpolate(frame, [2040, 2100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  // Z stack (bottom → top):
  //   coins (3D canvas) → wordmarks → phone → end card
  // The phone sits ON TOP of the wordmarks so the text passes behind
  // it during close-ups; the end card crossfades over everything.
  return (
    <AbsoluteFill style={{ background: BG_COLOR }}>
      <CoinsBackground
        forwardProgress={coinsForward}
        opacity={coinsOpacity}
        width={1920}
        height={1080}
      />
      <SideTexts visibility={sideTextsVis} />
      <CssPhone
        brollSrc={brollSrc}
        translateY={phoneTranslateY}
        rotateXDeg={phoneRotateX}
        rotateYDeg={phoneRotateY}
        scale={phoneScale}
        brollDurationSec={18.5}
        brollIntroSkipSec={3.0}
      />
      <EndCard progress={endCardProg} />
    </AbsoluteFill>
  );
};

export const explorerProofMeta = {
  id: "ExplorerProof",
  component: ExplorerProof,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 2100,
  defaultProps: { brollPath: FALLBACK_BROLL_PATH } as ExplorerProofProps,
};

// Re-export for callers who want to render against the eventual recording.
export { DEFAULT_BROLL_PATH };
