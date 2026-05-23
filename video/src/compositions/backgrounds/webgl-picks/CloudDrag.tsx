// Faithful port of the original "draggable cloud" demo.
// A soft white rectangle is run through a stack of feTurbulence + feMorphology
// + feGaussianBlur + feDisplacementMap passes so it ends up looking like a
// hand-drawn cloud with four colored shadow layers (blue mid-shadow, dark
// underbelly, longer dark trail, soft sky-shadow). The original lets the
// user drag the cloud with the mouse and crank a weather slider from sun to
// storm; here the drag is simulated as a slow figure-8 around screen-center
// and the weather slider ramps over the second half of the scene, with
// random lightning flashes once it tops out.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  random,
} from "remotion";

// ── Sky gradient & cloud constants (verbatim) ──────────────────────────────
const SKY = "linear-gradient(0deg, #62a0d8 0%, #2178d1 50%, #085cb3 100%)";

// Cloud rectangle size (in CSS px). Bigger than the source because the scene
// is 1920x1080 instead of the source's clamped viewport.
const CLOUD_W = 920;
const CLOUD_H = 380;

export const CloudDrag: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const t = frame / durationInFrames;
  const seconds = frame / fps;

  // ── Simulated drag — slow figure-8 (Lissajous) around screen center.
  // Mimics a user lazily moving the cloud with the mouse.
  const dragX = Math.sin(seconds * 0.55) * 260;
  const dragY = Math.cos(seconds * 0.85) * 130;

  // ── Weather slider — ramps from 0 to 100 over the second half of the
  // scene. The original `updateWeather(value)` interpolates several values
  // off this slider.
  const weather = interpolate(t, [0.4, 0.95], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sky saturation & brightness from the source:
  //   saturation = lerp(100, 30, t)
  //   brightness = lerp(100, 50, t)
  const saturation = interpolate(weather, [0, 100], [100, 30]);
  const brightness = interpolate(weather, [0, 100], [100, 50]);

  // Shadow flood-opacities from the source (shadow2/3/4/5):
  const shadow2Op = interpolate(weather, [0, 100], [0, 0.4]);
  const shadow3Op = interpolate(weather, [0, 100], [0.1, 0.4]);
  const shadow4Op = interpolate(weather, [0, 100], [0.2, 0.6]);
  const shadow5Op = interpolate(weather, [0, 100], [0.2, 0.7]);

  // ── Lightning — random flashes once weather hits its top.
  // Source schedules a new flash 300-1500ms apart with random x,y inside
  // a 33%-of-cloud region; the glow animates 0.8s with `lightning-glow`
  // keyframes. We pick a fresh seed each ~0.8s slot and pulse opacity.
  const flashOn = weather > 95;
  const flashSlotDuration = 0.9;
  const flashSlot = Math.floor(seconds / flashSlotDuration);
  const flashRoll = random(`flash-${flashSlot}`);
  const slotT = seconds - flashSlot * flashSlotDuration;
  // Match the source `lightning-glow` keyframes:
  //   0% { opacity: 0.8; }
  //   15% { opacity: 0; }
  //   100% { opacity: 0; }
  const flashEnvelope =
    slotT < 0.12 ? 0.8 - (slotT / 0.12) * 0.8 : 0;
  const flashFires = flashOn && flashRoll > 0.45;
  const flashOpacity = flashFires ? flashEnvelope : 0;
  const lxRand = random(`lx-${flashSlot}`) - 0.5;
  const lyRand = random(`ly-${flashSlot}`);
  const lightningX = lxRand * width * 0.28;
  const lightningY = lyRand * height * 0.18;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Sky — saturation/brightness drop as weather climbs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: SKY,
          filter: `saturate(${saturation}%) brightness(${brightness}%)`,
        }}
      />

      {/* SVG filter definitions — verbatim from the source.
          The chain blurs the SourceGraphic and runs four feDisplacementMap
          passes against two feTurbulence noises, plus four colored shadows
          (rgb 215/66/0/0 with shadow2-5 opacities) that are offset, eroded,
          blurred and displaced before being merged into the final cloud. */}
      <svg
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden
      >
        <defs>
          <filter
            id="cloud-filter"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              seed={462}
              baseFrequency="0.011"
              numOctaves={5}
              result="noise1"
            />
            <feTurbulence
              type="fractalNoise"
              seed={462}
              baseFrequency="0.011"
              numOctaves={2}
              result="noise2"
            />
            <feGaussianBlur in="SourceGraphic" stdDeviation={20} result="blur1" />
            <feDisplacementMap
              in="blur1"
              scale={100}
              in2="noise1"
              result="cloud1"
            />

            {/* Layer 2 — soft grey mid-shadow */}
            <feFlood
              floodColor="rgb(215,215,215)"
              floodOpacity={shadow2Op === 0 ? 0.001 : shadow2Op}
            />
            <feComposite operator="in" in2="SourceGraphic" />
            <feOffset dx={-10} dy={-3} />
            <feMorphology radius={20} />
            <feGaussianBlur stdDeviation={20} />
            <feDisplacementMap scale={100} in2="noise1" result="cloud2" />

            {/* Layer 3 — blue mid-shadow */}
            <feFlood floodColor="rgb(66,105,146)" floodOpacity={shadow3Op} />
            <feComposite operator="in" in2="SourceGraphic" />
            <feOffset dx={-10} dy={40} />
            <feMorphology radius="0 40" />
            <feGaussianBlur stdDeviation={20} />
            <feDisplacementMap scale={80} in2="noise2" result="cloud3" />

            {/* Layer 4 — dark underbelly */}
            <feFlood floodColor="rgb(0,0,0)" floodOpacity={shadow4Op} />
            <feComposite operator="in" in2="SourceGraphic" />
            <feOffset dx={20} dy={60} />
            <feMorphology radius="0 65" />
            <feGaussianBlur stdDeviation={30} />
            <feDisplacementMap scale={100} in2="noise2" result="cloud4" />

            {/* Layer 5 — long dark rain trail */}
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
        </defs>
      </svg>

      {/* The cloud — a soft rounded rectangle that the filter shapes.
          Wrapped in a container that holds the filter; the rectangle inside
          carries the simulated drag translate. */}
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
            width: CLOUD_W,
            height: CLOUD_H,
            background: "#fff",
            borderRadius: "50%",
            transform: `translate(calc(-50% + ${dragX}px), calc(-50% + ${dragY}px))`,
          }}
        />
      </div>

      {/* Lightning glow — anchored to the cloud center with a small random
          offset inside the cloud bounds. Mix-blend-mode: overlay matches
          the source. */}
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

      {/* Weather slider chrome — sun on the left, lightning bolt on the right,
          a draggable thumb whose left% tracks `weather`. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 40,
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "10px 22px",
          background: "rgba(0,0,0,0.18)",
          borderRadius: 28,
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 18,
          zIndex: 1000,
        }}
      >
        <SunIcon />
        <div
          style={{
            position: "relative",
            width: 380,
            height: 8,
            borderRadius: 4,
            background:
              "linear-gradient(to right, rgba(255,255,255,.3), rgba(0,0,0,.5))",
            outline: "1px solid rgba(255,255,255,0.1)",
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
              background: weather > 0 ? "white" : "transparent",
              border: "1px solid white",
              transform: "translate(-50%, -50%)",
              boxSizing: "border-box",
            }}
          />
        </div>
        <StormIcon />
      </div>
    </AbsoluteFill>
  );
};

// ── Inline icons — match the source's nucleo `iconCancel`/`iconSun` SVGs ───

const SunIcon: React.FC = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 20 20"
    aria-hidden
    style={{ color: "white", mixBlendMode: "difference" }}
  >
    <circle cx={10} cy={10} r={4} fill="currentColor" />
    {[
      [10, 2, 10, 3.5],
      [15.657, 4.343, 14.596, 5.404],
      [18, 10, 16.5, 10],
      [15.657, 15.657, 14.596, 14.596],
      [10, 18, 10, 16.5],
      [4.343, 15.657, 5.404, 14.596],
      [2, 10, 3.5, 10],
      [4.343, 4.343, 5.404, 5.404],
    ].map(([x1, y1, x2, y2], i) => (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    ))}
  </svg>
);

const StormIcon: React.FC = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 512 512"
    aria-hidden
    fill="currentColor"
    style={{ color: "white", mixBlendMode: "difference" }}
  >
    <path d="M96 416a16 16 0 01-14.3-23.16l24-48a16 16 0 0128.62 14.32l-24 48A16 16 0 0196 416zM120 480a16 16 0 01-14.3-23.16l16-32a16 16 0 0128.62 14.32l-16 32A16 16 0 01120 480zM376 416a16 16 0 01-14.3-23.16l24-48a16 16 0 0128.62 14.32l-24 48A16 16 0 01376 416zM400 480a16 16 0 01-14.3-23.16l16-32a16 16 0 0128.62 14.32l-16 32A16 16 0 01400 480z" />
    <path d="M405.84 136.9a151.25 151.25 0 00-47.6-81.9 153 153 0 00-241.81 51.86C60.5 110.16 16 156.65 16 213.33 16 272.15 63.91 320 122.8 320h66.31l-12.89 77.37A16 16 0 00192 416h32v64a16 16 0 0029 9.3l80-112a16 16 0 00-13-25.3h-27.51l8-32h103.84a91.56 91.56 0 001.51-183.1z" />
  </svg>
);
