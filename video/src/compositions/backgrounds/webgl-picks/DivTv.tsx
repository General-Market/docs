// Faithful port of the "I'm just a div" demo.
// A single <div> uses border-image to wear a CRT television frame as its
// border. Its background-image cycles through four channels (waving →
// dancing → static → happy-dance) before fading to black, and the whole
// thing wobbles around the Y axis at the start. A small italic caption
// "I'm just a div" reveals in the centre once the screen has gone dark.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ── Original asset URLs ────────────────────────────────────────────────────

const TV_FRAME = "https://roboleary.net/demos/HvnZUakQ/img/tv.webp";

type Channel = {
  src: string | null;
  size: string;
};

// Channels and their `background-size`, from the source's @keyframes switch
const CHANNELS: Channel[] = [
  {
    src: "https://www.roboleary.net/demos/HvnZUakQ/img/waving.webp",
    size: "auto",
  },
  {
    src: "https://www.roboleary.net/demos/HvnZUakQ/img/gene-kelly-dancing2.webp",
    size: "150%",
  },
  {
    src: "https://www.roboleary.net/demos/HvnZUakQ/img/static.webp",
    size: "auto",
  },
  {
    src: "https://www.roboleary.net/demos/HvnZUakQ/img/happy-dance.webp",
    size: "auto",
  },
  { src: null, size: "auto" }, // final fade to black
];

// The source's wobble keyframes: rotateY 0 → 40deg, alternate, 0.25s, 2 iters.
// Total wobble runs 0.5s of the animation.
const WOBBLE_DURATION_S = 0.5;

// The switch animation runs 4s on top of (concurrent with) the wobble.
// Channel transition timing taken from the source's switch keyframes:
//   0%   waving (full size)
//   40%  waving → swap to dancing, size jumps to 150%
//   55%  dancing → static (back to default size)
//   70%  static → happy-dance
//   100% all images cleared, screen is empty
const SWITCH_DURATION_S = 4;

const channelAtT = (t: number): Channel => {
  if (t < 0.4) return CHANNELS[0];
  if (t < 0.55) return CHANNELS[1];
  if (t < 0.7) return CHANNELS[2];
  if (t < 1.0) return CHANNELS[3];
  return CHANNELS[4];
};

// The caption reveal — source has @keyframes reveal with 0..90% opacity 0
// then 91..100% opacity 1, total 4s duration with 1s delay.
const captionOpacity = (sceneT: number) => {
  // Map the scene's normalised time to the same 4s+1s envelope.
  // (Scale assumes a 10s scene; once the screen has been black for a bit,
  // pop the caption in.)
  return interpolate(sceneT, [0.84, 0.91], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export const DivTv: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const seconds = frame / fps;
  const sceneT = frame / durationInFrames;

  // ── Wobble — sinusoidal sweep of rotateY 0..40 over 0.5s, two iterations,
  // alternating direction (matches the source's `wobble` keyframes set
  // `alternate, 2 iterations, 0.25s` => total 0.5s).
  const wobbleT = Math.min(1, seconds / WOBBLE_DURATION_S);
  const wobbleEnv = wobbleT < 1 ? Math.sin(wobbleT * Math.PI) : 0;
  const rotateY = wobbleEnv * 35 * Math.sin(wobbleT * Math.PI * 4);

  // ── Channel selection on the switch timeline (starts at t=0 like the
  // source's other animation; the wobble plays alongside it).
  const switchT = Math.min(1, seconds / SWITCH_DURATION_S);
  const channel = channelAtT(switchT);

  // ── Caption reveal.
  const capOp = captionOpacity(sceneT);

  return (
    <AbsoluteFill
      style={{
        background: "hsl(80, 100%, 50%)",
        display: "grid",
        placeItems: "center",
        perspective: "1200px",
      }}
    >
      <div
        style={{
          // The original sets `width: min(60dvw, 400px)` and aspect 4/3.8,
          // with border-image-outset of width/3 — the outset is what makes the
          // TV frame appear around the content box. Scaled up for 1920x1080.
          width: 600,
          aspectRatio: "4 / 3.8",
          position: "relative",
          backgroundColor: "white",
          backgroundImage: channel.src ? `url(${channel.src})` : "none",
          backgroundSize: channel.size,
          backgroundPosition: "50%",
          color: "black",
          fontFamily:
            '"Lucida Sans", "Lucida Sans Regular", "Lucida Grande", "Lucida Sans Unicode", Geneva, Verdana, sans-serif',
          display: "grid",
          placeItems: "center",
          // border-image — the TV frame asset is sliced at the original
          // percentages (top/right/bottom/left = 19/20/34.3/19).
          borderStyle: "solid",
          borderWidth: "24% 20% 24% 20%",
          borderImageSource: `url(${TV_FRAME})`,
          borderImageSlice: "19 20 34.3 19 fill",
          borderImageWidth: "24% 20% 24% 20%",
          borderImageOutset: "calc(600px / 3)",
          transform: `rotateY(${rotateY}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Static-noise overlay only while on the static channel */}
        {switchT >= 0.55 && switchT < 0.7 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-conic-gradient(rgba(255,255,255,0.75) 0% 0.5%, rgba(0,0,0,0.75) 0.5% 1%)",
              mixBlendMode: "screen",
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />
        )}
        <span
          style={{
            position: "relative",
            fontSize: "1.1rem",
            fontStyle: "italic",
            opacity: capOp,
          }}
        >
          I'm just a div
        </span>
      </div>
    </AbsoluteFill>
  );
};
