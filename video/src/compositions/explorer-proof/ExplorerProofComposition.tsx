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

import React, { useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  Video,
} from "remotion";
import { CoinsBackground } from "./CoinsBackground";
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

// Hook beat: first zoom snap lands at frame 60 (2s) so viewers see
// motion within the swipe-away window. Subsequent beats stay long
// enough to read the screen.
const BREAKPOINTS = [0, 60, 240, 480, 750, 1020, 1290, 1560, 1830, 2100];
// Sharp acceleration into the new pose, gentle settle out. Closer to a
// real camera operator's whip-pan than the symmetrical bezier we had.
const EASE = Easing.bezier(0.72, 0.02, 0.18, 1.0);

// Snap-and-hold camera. Hold for most of each beat, then snap to the
// next pose. 22 frames is long enough to look cinematic (not jerky)
// and short enough to read as a deliberate camera move, not a drift.
const SNAP_FRAMES = 22;

// Convert a "one value per beat" array into the double-breakpoint
// shape that produces a hold→snap→hold curve via `interpolate`.
function buildSnap(values: number[]): { bps: number[]; vs: number[] } {
  const bps: number[] = [];
  const vs: number[] = [];
  for (let i = 0; i < BREAKPOINTS.length; i += 1) {
    if (i === 0) {
      bps.push(BREAKPOINTS[i]);
      vs.push(values[i]);
    } else {
      // Snap zone: the last SNAP_FRAMES of the previous beat ramps
      // from the previous value to this beat's value. Then hold this
      // value until the next snap.
      bps.push(BREAKPOINTS[i] - SNAP_FRAMES, BREAKPOINTS[i]);
      vs.push(values[i - 1], values[i]);
    }
  }
  return { bps, vs };
}

const driveProp = (frame: number, values: number[]) => {
  const { bps, vs } = buildSnap(values);
  return interpolate(frame, bps, vs, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
};

const BROLL_INTRO_SKIP_FRAMES = 75; // 2.5s at 30fps

export const ExplorerProof: React.FC<ExplorerProofProps> = ({ brollPath }) => {
  const frame = useCurrentFrame();
  const brollSrc = staticFile(brollPath);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
  const phoneScaleBase = driveProp(frame, [
    0.8, 1.25, 1.4, 1.4, 0.85, 0.85, 1.5, 0.8, 1.2, 1.2,
  ]);

  // Phone vertical translate — bigger lift/drop for the up/down beats.
  const phoneTranslateYBase = driveProp(frame, [
    0, 0, -140, 140, 0, 0, 0, 0, 0, 0,
  ]);

  // Tilt — sharper lean during the up/down beats. Degrees.
  const phoneRotateXBase = driveProp(frame, [
    0, 0, -10, 10, 0, 0, 0, 0, 0, 0,
  ]);

  // Yaw — beat 6 turns the phone to the right.
  const phoneRotateYBase = driveProp(frame, [
    0, 0, 0, 0, 0, 14, 0, 0, 0, 0,
  ]);

  // ── Micro-motion during holds (camera breath)
  // Sub-1px / sub-0.005 amplitude on top of the snapped pose. Period
  // ~4s on scale, ~3s on translateY. Imperceptible per frame, but the
  // viewer reads it as a handheld feel — "alive" — instead of a still
  // image between snaps.
  const t = frame / 30;
  const breathScale = 1 + Math.sin(t * (Math.PI * 2) / 4.0) * 0.004;
  const breathTranslateY = Math.sin(t * (Math.PI * 2) / 3.2 + 1.1) * 2.5;
  const breathRotateX = Math.sin(t * (Math.PI * 2) / 5.0 + 0.4) * 0.35;
  const breathRotateY = Math.sin(t * (Math.PI * 2) / 4.5 + 2.0) * 0.4;

  const phoneScale = phoneScaleBase * breathScale;
  const phoneTranslateY = phoneTranslateYBase + breathTranslateY;
  const phoneRotateX = phoneRotateXBase + breathRotateX;
  const phoneRotateY = phoneRotateYBase + breathRotateY;

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

  // End card 3D reveal — 8s ramp so the coin grow + logo emerge has
  // time to land. Starts at frame 1740 (28s mark, beat 9 begins at 1830
  // but we want the end-card to start animating well before its beat).
  const endCardProg = interpolate(frame, [1740, 2100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  // Z stack (bottom → top):
  //   3D scene (coins + phone, sharing one HDRI) → wordmarks → end card
  // The phone lives inside the 3D scene so it picks up the same lights
  // as the coins. Wordmarks remain 2D — they slide behind the phone
  // during close-ups because the phone is opaque in screen space.
  return (
    <AbsoluteFill style={{ background: BG_COLOR }}>
      {/* Hidden video element. <Video> syncs playback to composition
          time; useVideoTexture inside Phone3D reads frames from this
          DOM element. Position off-screen so the bare <video> never
          paints, but it keeps decoding. */}
      <div
        style={{
          position: "absolute",
          width: 8,
          height: 8,
          left: -100,
          top: -100,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <Video
          ref={videoRef}
          src={brollSrc}
          muted
          loop
          startFrom={BROLL_INTRO_SKIP_FRAMES}
          pauseWhenBuffering={false}
        />
      </div>
      <CoinsBackground
        forwardProgress={coinsForward}
        opacity={coinsOpacity}
        width={1920}
        height={1080}
        phone={{
          videoRef,
          translateY: phoneTranslateY,
          rotateXDeg: phoneRotateX,
          rotateYDeg: phoneRotateY,
          scale: phoneScale,
        }}
        sideTextsVisibility={sideTextsVis}
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
