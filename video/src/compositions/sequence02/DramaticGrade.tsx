/**
 * DramaticGrade — cinematic regrade for the webcam video.
 *
 * Mimics the "after" look in a studio-lit B&W shot: desaturation, crushed
 * blacks, overhead key light, rim light, floor pool, heavy vignette. All
 * overlays breathe slowly so the light feels alive, not pasted on.
 *
 * Layered inside a stacking context (overflow: hidden + isolation: isolate)
 * so mix-blend-mode stays local to the container.
 */

import React from "react";
import { useCurrentFrame } from "remotion";

type Props = {
  children: React.ReactNode;
  /** 0 = pass-through, 1 = full cinematic grade. */
  intensity?: number;
};

export const DramaticGrade: React.FC<Props> = ({
  children,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();

  // Slow breath (~3.8s cycle) for the key spotlight — ±6% radius drift
  const breath = 1 + Math.sin(frame / 18) * 0.06;
  // Faster micro-flicker (~1.5s) for rim + floor pool — sim a practical source
  const flicker = 1 + Math.sin(frame / 7.3) * 0.015;
  // Slower drift for the vignette axis — makes the darkness itself breathe
  const vigDrift = 1 + Math.sin(frame / 42) * 0.03;

  const k = intensity;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Base video — desaturated, contrast-crushed, slightly flickered */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: [
            `grayscale(${0.92 * k})`,
            `contrast(${1 + 0.42 * k})`,
            `brightness(${(0.9 - 0.06 * k) * flicker})`,
            `saturate(${1 - 0.7 * k})`,
          ].join(" "),
        }}
      >
        {children}
      </div>

      {/* Warm tint wash — 1% sepia-ish lift on the highlights */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255, 232, 200, 0.06)",
          mixBlendMode: "overlay",
          pointerEvents: "none",
          opacity: k,
        }}
      />

      {/* Deep shadow crush — multiply, darkens everything outside the subject */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${78 * breath}% ${74 * breath}% at 50% 52%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.92) 74%, #000 100%)`,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          opacity: k,
        }}
      />

      {/* Key spotlight — warm pool on upper body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${44 * breath}% ${58 * breath}% at 50% 36%, rgba(255,248,235,${0.24 * k}) 0%, rgba(255,245,230,${0.09 * k}) 42%, transparent 72%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Rim light — narrow bright strip hugging the top edge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 36% 11% at 50% 0%, rgba(255,255,255,${0.4 * k * flicker}) 0%, transparent 82%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Shoulder edge lights — faint side streaks at ~30% height */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 10% 22% at 22% 40%, rgba(255,250,240,${0.14 * k * flicker}) 0%, transparent 75%),
            radial-gradient(ellipse 10% 22% at 78% 40%, rgba(255,250,240,${0.14 * k * flicker}) 0%, transparent 75%)
          `,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Floor pool — bright ellipse on the ground in front of the subject */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 24% 9% at 50% 92%, rgba(255,250,240,${0.34 * k * flicker}) 0%, rgba(255,250,240,${0.12 * k}) 45%, transparent 75%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Final vignette — corners fall to pitch black */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${100 * vigDrift}% ${100 * vigDrift}% at 50% 50%, transparent 34%, rgba(0,0,0,${0.58 * k}) 84%, rgba(0,0,0,${0.78 * k}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Grain — subtle film texture, keeps shadows from looking plastic */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundSize: "220px 220px",
          mixBlendMode: "overlay",
          opacity: 0.18 * k,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
