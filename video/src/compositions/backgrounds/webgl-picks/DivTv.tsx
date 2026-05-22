// Source: a CRT-television demo where the screen is a <div> whose
// border-image is a TV photo, and whose background-image keyframes through
// different "channels": waving → dancing → static → happy-dance → black.
// The TV wobbles 3D briefly on enter, then channels switch over time.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

const TV_FRAME =
  "https://roboleary.net/demos/HvnZUakQ/img/tv.webp";
const CHANNELS = [
  { src: "https://www.roboleary.net/demos/HvnZUakQ/img/waving.webp", size: "100%" },
  { src: "https://www.roboleary.net/demos/HvnZUakQ/img/gene-kelly-dancing2.webp", size: "150%" },
  { src: "https://www.roboleary.net/demos/HvnZUakQ/img/static.webp", size: "100%" },
  { src: "https://www.roboleary.net/demos/HvnZUakQ/img/happy-dance.webp", size: "100%" },
];

export const DivTv: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;

  // Two-step wobble like the CSS animation: rotates +40deg, alternate reverse,
  // 0.25s, 2 iterations. Total wobble = 0.5s.
  const wobbleProgress = Math.min(1, frame / (fps * 0.5));
  const wobble = Math.sin(wobbleProgress * Math.PI * 4) * (1 - wobbleProgress) * 30;

  // Channel index over the "switch" 4-second window after wobble.
  const switchT = Math.max(0, (frame - fps * 0.5) / (fps * 4));
  let channelIdx = 0;
  if (switchT < 0.4) channelIdx = 0;
  else if (switchT < 0.55) channelIdx = 1;
  else if (switchT < 0.7) channelIdx = 2;
  else if (switchT < 0.95) channelIdx = 3;
  else channelIdx = -1; // off (black)

  // Reveal of "I'm just a div" caption — matches the source's @keyframes reveal
  const captionOpacity = interpolate(t, [0.85, 0.92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Static-noise overlay strength
  const staticAlpha = channelIdx === 2 ? 0.7 : 0;
  const ch = channelIdx >= 0 ? CHANNELS[channelIdx] : null;

  return (
    <AbsoluteFill
      style={{
        background: "hsl(80, 100%, 50%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "min(60dvw, 600px)",
          aspectRatio: "4 / 3.8",
          position: "relative",
          // border-image trick replicates the source
          borderStyle: "solid",
          borderImageSource: `url(${TV_FRAME})`,
          borderImageSlice: "19% 20% 34.3% 19%",
          borderImageWidth: "24% 20% 24% 20%",
          borderImageOutset: "calc(min(60dvw, 600px) / 3)",
          backgroundColor: "white",
          backgroundImage: ch ? `url(${ch.src})` : "none",
          backgroundPosition: "50%",
          backgroundSize: ch ? ch.size : "auto",
          color: "black",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "grid",
          placeItems: "center",
          transform: `rotateY(${wobble}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Static noise overlay when on the "static" channel */}
        {staticAlpha > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `repeating-conic-gradient(rgba(255,255,255,${staticAlpha}) 0% 0.5%, rgba(0,0,0,${staticAlpha}) 0.5% 1%)`,
              mixBlendMode: "screen",
              opacity: staticAlpha,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Caption after the last fade-to-black */}
        <span
          style={{
            position: "relative",
            fontStyle: "italic",
            fontSize: "1.1rem",
            opacity: captionOpacity,
          }}
        >
          I'm just a div
        </span>
      </div>
    </AbsoluteFill>
  );
};
