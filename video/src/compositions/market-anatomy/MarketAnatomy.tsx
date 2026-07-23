import React from "react";
import {
  AbsoluteFill,
  Audio,
  Loop,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { MARKETS } from "./data";
import { MarketAnatomyTable } from "./MarketAnatomyTable";

// Inter is the closest Google-Fonts surrogate for SF Pro. SF Pro Display
// leads the stack on installed Macs; Inter and Helvetica Neue cover the rest.
loadInter("normal", { subsets: ["latin"], weights: ["400", "500", "600"] });

const FPS = 30;
const W = 1920;
const H = 1080;

// Twitter clip — short, single table, no movement.
// 0.4s fade in, 5.2s read, 0.4s fade out = 6s total.
export const MARKET_ANATOMY_DURATION = Math.round(6 * FPS);

const BROLL_SRC = staticFile(
  "broll/youtube-MLm07I49RiE/broll_1-36-35_to_1-37-04.mp4",
);
const MUSIC_SRC = staticFile(
  "music/twitter/Aylex - Evolution (freetouse.com).mp3",
);

// Pick the market to feature. US equities is the densest dataset and the
// most legible to a general audience. Swap to any id from data.ts.
const FEATURED_MARKET_ID = "us-equities";
const market =
  MARKETS.find((m) => m.id === FEATURED_MARKET_ID) ?? MARKETS[0];

const Backdrop: React.FC = () => {
  const brollLoopFrames = Math.round(29 * FPS);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0A0A0B" }}>
      <Loop durationInFrames={brollLoopFrames}>
        <OffthreadVideo
          src={BROLL_SRC}
          muted
          // Real-time motion. Apple-style backdrops play vivid; the card
          // does the work of separating subject from texture.
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </Loop>
    </AbsoluteFill>
  );
};

export const MarketAnatomy: React.FC = () => {
  const frame = useCurrentFrame();

  // Whole card fades in/out — the only motion in the piece.
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [MARKET_ANATOMY_DURATION - 12, MARKET_ANATOMY_DURATION],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const cardOpacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ background: "#0A0A0B" }}>
      <Backdrop />

      {/* Music bed — Aylex Evolution. Short fade in, hold, short fade out. */}
      <Audio
        src={MUSIC_SRC}
        volume={(f) => {
          const fIn = interpolate(f, [0, 18], [0, 0.32], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const fOut = interpolate(
            f,
            [MARKET_ANATOMY_DURATION - 24, MARKET_ANATOMY_DURATION],
            [0.32, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return Math.min(fIn, fOut);
        }}
      />

      {/* The card — static. No spring, no float. Just present. */}
      <AbsoluteFill style={{ opacity: cardOpacity }}>
        <MarketAnatomyTable market={market} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const marketAnatomyMeta = {
  id: "MarketAnatomy",
  component: MarketAnatomy,
  durationInFrames: MARKET_ANATOMY_DURATION,
  fps: FPS,
  width: W,
  height: H,
};
