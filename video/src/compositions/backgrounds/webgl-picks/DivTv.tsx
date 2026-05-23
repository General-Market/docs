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
// Total wobble runs 0.5s starting at t=0. With "alternate" the second iter
// plays in reverse, so the element rests at 0deg after 0.5s.
const WOBBLE_ITER_S = 0.25;

// The switch animation runs 4s with a 1s delay (so absolute t=1s → t=5s).
// Channel transition timing taken from the source's switch keyframes
// (percentages are of the 4s switch duration, then offset by +1s):
//   0%   (t=1.0s) waving (default size)
//   40%  (t=2.6s) swap to dancing, size jumps to 150%
//   55%  (t=3.2s) swap to static, size back to default
//   70%  (t=3.8s) swap to happy-dance
//   100% (t=5.0s) all images cleared, screen is empty (white)
const SWITCH_DELAY_S = 1;
const SWITCH_DURATION_S = 4;

const channelAtT = (t: number): Channel => {
  if (t < 0) return CHANNELS[0]; // before switch starts: waving on screen
  if (t < 0.4) return CHANNELS[0];
  if (t < 0.55) return CHANNELS[1];
  if (t < 0.7) return CHANNELS[2];
  if (t < 1.0) return CHANNELS[3];
  return CHANNELS[4];
};

// Smooth ease in/out (matches CSS default `ease` reasonably well for sub-1s
// keyframes). Sine half-wave 0→1 over the iteration.
const easedSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

// The caption reveal — source has @keyframes reveal with 4s duration + 1s
// delay. Opacity stays 0 until 90% of the 4s (t=4.6s absolute), then snaps
// to 1 from 91% (t=4.64s) to the end (t=5.0s). With `forwards` it stays
// visible after the animation completes.
const captionOpacity = (seconds: number) => {
  if (seconds < 4.6) return 0;
  if (seconds < 4.64) {
    return interpolate(seconds, [4.6, 4.64], [0, 1]);
  }
  return 1;
};

export const DivTv: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  // ── Wobble — two 0.25s iterations of rotateY 0→40 alternating direction.
  // Iter 1 (0→0.25s): 0 → 40. Iter 2 (0.25s→0.5s, reversed): 40 → 0.
  // After 0.5s the element rests at 0deg.
  const wobbleProgress = seconds / WOBBLE_ITER_S; // 0..2 over 0.5s, then >2
  let rotateY = 0;
  if (wobbleProgress < 1) {
    rotateY = 40 * easedSine(wobbleProgress);
  } else if (wobbleProgress < 2) {
    rotateY = 40 * (1 - easedSine(wobbleProgress - 1));
  }

  // ── Channel selection on the switch timeline. Switch starts at t=1s and
  // runs 4s, so absolute t=[1s, 5s] maps to switchT=[0, 1]. Before t=1s the
  // screen sits on the initial "waving" channel.
  const switchT = (seconds - SWITCH_DELAY_S) / SWITCH_DURATION_S;
  const channel = channelAtT(switchT);

  // ── Caption reveal — opacity 0 until t=4.6s, then snaps to 1 by t=4.64s
  // and stays visible (matches `animation-fill-mode: forwards`).
  const capOp = captionOpacity(seconds);

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
