// Replica of "Identify This Pattern in 10 Seconds" (1080x1920, 32.7s).
// One continuous 3D chart world (@remotion/three) — perspective camera on
// measured keyframes — plus 2D overlays (education card, hand, grain).
import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { COL, DURATION as DUR, FPS as F, H, W, CARD } from "./data";
import { World } from "./World";
import { Atmosphere, CardOverlay, HandOverlay } from "./CardOverlay";

export const FPS = F;
export const DURATION = DUR;

// Labels use Switzer (repo font) — loaded before first render.
const useLabelFont = (): boolean => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("short3d font"));
  useEffect(() => {
    const font = new FontFace(
      "Switzer",
      `url(${staticFile("fonts/switzer-800.woff2")}) format("woff2")`,
      { weight: "800" },
    );
    font
      .load()
      .then((f) => {
        document.fonts.add(f);
        setReady(true);
        continueRender(handle);
      })
      .catch(() => {
        setReady(true);
        continueRender(handle);
      });
  }, [handle]);
  return ready;
};

export const Short3DComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const fontReady = useLabelFont();

  // depth-of-field feel while the card is up (reference blurs the chart)
  const cardBlur =
    t > CARD.tIn0 - 0.2 && t < CARD.tOut1 + 0.15
      ? 9 * Math.min(1, Math.max(0, (t - (CARD.tIn0 - 0.2)) / 0.45)) *
        Math.min(1, Math.max(0, (CARD.tOut1 + 0.15 - t) / 0.4))
      : 0;
  // speed blur on the final cascade (camera drops fast t≈30.3-31.1)
  const fallBlur =
    t > 30.25 && t < 31.15 ? 3.4 * Math.sin(((t - 30.25) / 0.9) * Math.PI) : 0;
  const blur = Math.max(cardBlur, fallBlur);

  return (
    <AbsoluteFill style={{ backgroundColor: COL.bg }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        <ThreeCanvas
          width={W}
          height={H}
          style={{ width: W, height: H }}
          gl={{ toneMapping: THREE.NoToneMapping }}
          flat
        >
          <World fontReady={fontReady} />
        </ThreeCanvas>
      </div>
      <CardOverlay />
      <HandOverlay />
      <Atmosphere />
    </AbsoluteFill>
  );
};

export const short3dReplicateMeta = {
  id: "Short3D-Replicate",
  component: Short3DComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: DURATION,
};
