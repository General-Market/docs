// CssPhone — single centred phone built from CSS, broll plays on its
// "screen" via OffthreadVideo. Same pattern as FlatPhone in
// AntiCheatSolution.tsx — no WebGL, no GLTF, no race for a canvas.
//
// Driven by four scalars per frame:
//   translateY  pixels, vertical shift
//   rotateXDeg  forward/back tilt
//   rotateYDeg  yaw (rare; used for the "rotation" beat)
//   scale       uniform scale

import React from "react";
import { OffthreadVideo } from "remotion";

export type CssPhoneProps = {
  brollSrc: string;
  translateY: number;
  rotateXDeg: number;
  rotateYDeg: number;
  scale: number;
};

const PHONE_W = 480;
const PHONE_H = 1000;
const BEZEL = 14;
const RADIUS = 56;
const INNER_W = PHONE_W - BEZEL * 2;
const INNER_H = PHONE_H - BEZEL * 2;

export const CssPhone: React.FC<CssPhoneProps> = ({
  brollSrc,
  translateY,
  rotateXDeg,
  rotateYDeg,
  scale,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: PHONE_W,
        height: PHONE_H,
        marginLeft: -PHONE_W / 2,
        marginTop: -PHONE_H / 2,
        transform: `translateY(${translateY}px) rotateX(${rotateXDeg}deg) rotateY(${rotateYDeg}deg) scale(${scale})`,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {/* Phone body — black shell, soft drop shadow, faint inner highlight. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: RADIUS,
          background:
            "linear-gradient(180deg, #1c1c24 0%, #0a0a12 50%, #14141c 100%)",
          boxShadow:
            "0 60px 120px rgba(40, 20, 80, 0.32), 0 24px 48px rgba(20, 10, 50, 0.22), inset 0 0 0 1.5px rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        {/* Inner screen frame — black background, rounded, clips the broll. */}
        <div
          style={{
            position: "absolute",
            left: BEZEL,
            top: BEZEL,
            width: INNER_W,
            height: INNER_H,
            borderRadius: RADIUS - BEZEL,
            overflow: "hidden",
            background: "#000",
          }}
        >
          <OffthreadVideo
            src={brollSrc}
            muted
            pauseWhenBuffering={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Subtle glass reflection across the top of the screen. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              height: "22%",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
        {/* Notch — small pill at the top centre. Pure cosmetic. */}
        <div
          style={{
            position: "absolute",
            top: BEZEL + 8,
            left: "50%",
            marginLeft: -56,
            width: 112,
            height: 28,
            borderRadius: 14,
            background: "#000",
            zIndex: 2,
          }}
        />
      </div>
    </div>
  );
};
