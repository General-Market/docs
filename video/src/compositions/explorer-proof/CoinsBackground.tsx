// CoinsBackground — CSS-3D coin field behind the phone. Lavender room,
// translucent purple coins drifting in 3D space, spinning slowly. No
// WebGL canvas; everything is CSS transforms inside a perspective wrapper.
// Two scalar props drive the look:
//   forwardProgress  — 0..1, dollies coins from "deep" to "forward".
//   opacity          — 0..1, global fade for the entire field.
//
// Coin positions are seeded (mulberry32, seed 42) so the layout is
// stable across remounts and renders. Drift/rotation continue
// regardless of forwardProgress so the scene always breathes.

import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";

export type CoinsBackgroundProps = {
  forwardProgress: number;
  opacity: number;
  width: number;
  height: number;
};

const COIN_COUNT = 14;
const BG_COLOR = "#E0D8EC";
const MARK_URL = staticFile("gm-logo-white.svg");
const COIN_BODY = "#9b6cd6";
const COIN_RIM = "#7a4dbf";

const PERSPECTIVE = 1400;
const FRAME_W = 1920;
const FRAME_H = 1080;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Coin = {
  baseX: number;
  baseY: number;
  baseZ: number;
  forwardZ: number;
  baseScale: number;
  forwardScale: number;
  size: number;
  rotSpeed: number;
  spinPhase: number;
  tiltX: number;
  driftAmp: [number, number, number];
  driftFreq: [number, number, number];
  driftPhase: [number, number, number];
  baseAlpha: number;
};

function buildCoins(): Coin[] {
  const rng = mulberry32(42);
  const coins: Coin[] = [];
  for (let i = 0; i < COIN_COUNT; i += 1) {
    // Distribute across the frame, biased to the edges so the phone
    // (centre) reads cleanly. baseX/Y in pixel offsets from frame centre.
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (180 + rng() * 720); // ±180..±900
    const y = (rng() - 0.5) * 900; // ±450
    const z = -400 - rng() * 700; // -400..-1100 (deep)
    const forwardZ = 250 + rng() * 450; // 250..700 forward push

    const size = 180 + rng() * 220; // 180..400 px
    const baseScale = 0.7 + rng() * 0.3;
    const forwardScale = 1.05 + rng() * 0.35;

    // 6..14 second period at 30fps.
    const period = 6 + rng() * 8;
    const rotSpeed = (Math.PI * 2) / (period * 30);

    coins.push({
      baseX: x,
      baseY: y,
      baseZ: z,
      forwardZ,
      baseScale,
      forwardScale,
      size,
      rotSpeed,
      spinPhase: rng() * Math.PI * 2,
      tiltX: (rng() - 0.5) * 25, // mild constant X tilt
      driftAmp: [40 + rng() * 80, 40 + rng() * 80, 30 + rng() * 60],
      driftFreq: [
        (Math.PI * 2) / ((10 + rng() * 10) * 30),
        (Math.PI * 2) / ((10 + rng() * 10) * 30),
        (Math.PI * 2) / ((10 + rng() * 10) * 30),
      ],
      driftPhase: [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2],
      baseAlpha: 0.55 + rng() * 0.25,
    });
  }
  return coins;
}

const RAD2DEG = 180 / Math.PI;

const CoinView: React.FC<{
  coin: Coin;
  frame: number;
  forwardProgress: number;
  opacity: number;
}> = ({ coin, frame, forwardProgress, opacity }) => {
  const p = Math.max(0, Math.min(1, forwardProgress));

  const dx = coin.driftAmp[0] * Math.sin(frame * coin.driftFreq[0] + coin.driftPhase[0]);
  const dy = coin.driftAmp[1] * Math.sin(frame * coin.driftFreq[1] + coin.driftPhase[1]);
  const dz = coin.driftAmp[2] * Math.sin(frame * coin.driftFreq[2] + coin.driftPhase[2]);

  const x = coin.baseX + dx;
  const y = coin.baseY + dy;
  const z = coin.baseZ + dz + coin.forwardZ * p;

  const scale = coin.baseScale + (coin.forwardScale - coin.baseScale) * p;
  const spinDeg = (coin.spinPhase + frame * coin.rotSpeed) * RAD2DEG;

  // Far coins are softer and slightly blurred. Near coins are crisp.
  const depthBlur = Math.max(0, -z / 250); // 0 when z>=0, grows as z gets negative
  const alpha = coin.baseAlpha * opacity * (1 - Math.min(0.35, depthBlur * 0.08));

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: coin.size,
        height: coin.size,
        marginLeft: -coin.size / 2,
        marginTop: -coin.size / 2,
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${coin.tiltX}deg) rotateY(${spinDeg}deg) scale(${scale})`,
        transformStyle: "preserve-3d",
        opacity: alpha,
        filter: depthBlur > 1 ? `blur(${Math.min(3, depthBlur * 0.8).toFixed(2)}px)` : undefined,
        willChange: "transform, opacity",
      }}
    >
      {/* Coin body — purple disc with a softer rim ring */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${COIN_BODY} 0%, ${COIN_RIM} 75%, #5e3a9c 100%)`,
          boxShadow:
            "0 8px 24px rgba(80, 50, 160, 0.28), inset 0 2px 6px rgba(255,255,255,0.18), inset 0 -4px 10px rgba(40, 20, 80, 0.35)",
        }}
      />
      {/* White GM mark centred on the disc */}
      <img
        src={MARK_URL}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "55%",
          height: "55%",
          marginLeft: "-27.5%",
          marginTop: "-27.5%",
          display: "block",
          userSelect: "none",
        }}
      />
    </div>
  );
};

export const CoinsBackground: React.FC<CoinsBackgroundProps> = ({
  forwardProgress,
  opacity,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const coins = useMemo(() => buildCoins(), []);

  // Inner stage is fixed at 1920x1080; outer wrapper scales it to fit
  // whatever canvas size is requested. Keeps coin coordinates intuitive.
  const scaleX = width / FRAME_W;
  const scaleY = height / FRAME_H;

  return (
    <AbsoluteFill
      style={{
        width,
        height,
        background: BG_COLOR,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: "0 0",
          perspective: PERSPECTIVE,
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: FRAME_W,
            height: FRAME_H,
            transformStyle: "preserve-3d",
          }}
        >
          {coins.map((coin, i) => (
            <CoinView
              key={i}
              coin={coin}
              frame={frame}
              forwardProgress={forwardProgress}
              opacity={opacity}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
