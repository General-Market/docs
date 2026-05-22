// Source: a draggable SVG cloud with feTurbulence + feDisplacementMap that
// shapes a soft rounded rectangle into a hand-drawn cloud, plus a "weather
// slider" that fades the sky toward storm. The original lets the user drag
// the cloud with the mouse; here we simulate a Lissajous-style drift, and
// crank the weather slider toward "storm" over the back half of the scene.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  random,
} from "remotion";

const SKY = "linear-gradient(0deg, #62a0d8 0%, #2178d1 50%, #085cb3 100%)";

export const CloudDrag: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const t = frame / durationInFrames;
  const seconds = frame / fps;

  // Simulated drag — Lissajous curve. The user "pushes" the cloud in a slow
  // figure-8 around the center of the screen.
  const dragX = Math.sin(seconds * 0.6) * 280;
  const dragY = Math.cos(seconds * 0.9) * 140;

  // Weather slider goes 0 → 100 over the scene's second half
  const weather = interpolate(t, [0.45, 0.95], [0, 100], {
    easing: Easing.bezier(0.4, 0, 0.2, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sky saturation/brightness
  const saturation = interpolate(weather, [0, 100], [100, 30]);
  const brightness = interpolate(weather, [0, 100], [100, 50]);

  // Shadow opacities — taken from the source's flood-opacity ramps
  const shadow3Op = interpolate(weather, [0, 100], [0.1, 0.4]);
  const shadow4Op = interpolate(weather, [0, 100], [0.2, 0.6]);
  const shadow5Op = interpolate(weather, [0, 100], [0.2, 0.7]);

  // Lightning — random flashes once weather hits 100
  const lightningOn = weather > 95;
  // Seed-driven random flash window every ~0.7s
  const flashSlot = Math.floor(seconds / 0.7);
  const flashRoll = random(`flash-${flashSlot}`);
  const flashTime = (seconds % 0.7);
  const flashOpacity = lightningOn && flashRoll > 0.35
    ? Math.max(0, 0.85 - flashTime * 4)
    : 0;
  const lightningX = (random(`lx-${flashSlot}`) - 0.5) * width * 0.3;
  const lightningY = random(`ly-${flashSlot}`) * height * 0.2;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Sky */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: SKY,
          filter: `saturate(${saturation}%) brightness(${brightness}%)`,
        }}
      />

      {/* SVG filter definitions */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="cloud-filter" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" seed={462} baseFrequency="0.011" numOctaves={5} result="noise1" />
          <feTurbulence type="fractalNoise" seed={462} baseFrequency="0.011" numOctaves={2} result="noise2" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={20} />
          <feDisplacementMap in="blur1" scale={100} in2="noise1" result="cloud1" />
          <feFlood floodColor="rgb(215,215,215)" floodOpacity={0.2} />
          <feComposite operator="in" in2="SourceGraphic" />
          <feOffset dx={-10} dy={-3} />
          <feMorphology radius={20} />
          <feGaussianBlur stdDeviation={20} />
          <feDisplacementMap scale={100} in2="noise1" result="cloud2" />
          <feFlood floodColor="rgb(66,105,146)" floodOpacity={shadow3Op} />
          <feComposite operator="in" in2="SourceGraphic" />
          <feOffset dx={-10} dy={40} />
          <feMorphology radius="0 40" />
          <feGaussianBlur stdDeviation={20} />
          <feDisplacementMap scale={80} in2="noise2" result="cloud3" />
          <feFlood floodColor="rgb(0,0,0)" floodOpacity={shadow4Op} />
          <feComposite operator="in" in2="SourceGraphic" />
          <feOffset dx={20} dy={60} />
          <feMorphology radius="0 65" />
          <feGaussianBlur stdDeviation={30} />
          <feDisplacementMap scale={100} in2="noise2" result="cloud4" />
          <feFlood floodColor="rgb(0,0,0)" floodOpacity={shadow5Op} />
          <feComposite operator="in" in2="SourceGraphic" />
          <feOffset dx={20} dy={70} />
          <feMorphology radius="0 200" />
          <feGaussianBlur stdDeviation={30} />
          <feDisplacementMap scale={100} in2="noise2" result="cloud5" />
          <feMerge>
            <feMergeNode in="cloud1" />
            <feMergeNode in="cloud2" />
            <feMergeNode in="cloud3" />
            <feMergeNode in="cloud4" />
            <feMergeNode in="cloud5" />
          </feMerge>
        </filter>
      </svg>

      {/* The cloud itself — soft rounded rect run through feTurbulence */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: "url(#cloud-filter)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 920,
            height: 380,
            background: "#fff",
            borderRadius: "50%",
            transform: `translate(calc(-50% + ${dragX}px), calc(-50% + ${dragY}px))`,
          }}
        />
      </div>

      {/* Lightning glow — only appears at high weather */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, white, rgba(255,255,255,0))",
          mixBlendMode: "overlay",
          filter: "blur(50px)",
          opacity: flashOpacity,
          transform: `translate(calc(-50% + ${dragX + lightningX}px), calc(-50% + ${dragY + lightningY}px))`,
          pointerEvents: "none",
        }}
      />

      {/* Weather slider chrome at the bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "8px 18px",
          background: "rgba(0,0,0,0.18)",
          borderRadius: 28,
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 18,
        }}
      >
        <span>☀</span>
        <div
          style={{
            position: "relative",
            width: 380,
            height: 8,
            borderRadius: 4,
            background: "linear-gradient(to right, rgba(255,255,255,.3), rgba(0,0,0,.5))",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${weather}%`,
              top: "50%",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "white",
              border: "1px solid white",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
        <span>⚡</span>
      </div>
    </AbsoluteFill>
  );
};
