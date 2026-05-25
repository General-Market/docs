// Vertical short (Shorts / Reels / TikTok) built around the CRT markets reel.
//
// The graph IS the hook — the same Lorenz-curve whip-through used in
// RetailPnLMarketsReel, untouched, scaled to fill the frame. The short loops it
// three ways and never ends:
//   pass 1 — full speed, the spectacle: every market bows the curve harder.
//   pass 2 — half speed, so the eye can hold each one.
//   pass 3 — half speed, in red: the wedge from the perfectly-fair diagonal is
//            shaded, so you see exactly how much the top keeps.
// Then it cuts back to pass 1 on a downbeat. A constant loop.
//
// Music is rainbows-pitch.mp3 (144 BPM). At 60fps a beat is 25 frames and a bar
// is 100. Every market whip lands on a beat; every pass change lands on a bar.

import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { RetailPnLMarketsReel } from "./RetailPnLMarketsReel";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

const W = 1080;
const H = 1920;
const FPS = 60;

// ── Beat grid (144 BPM @ 60fps) ─────────────────────────────────────────────
const BEAT = 25; // frames per beat (a bar is 4 beats = 100)

// Pass boundaries, all on a downbeat. 12 markets per pass.
const P1_HOLD = BEAT / FPS; // 1 beat per market — the reel's native fast feel
const P2_HOLD = (2 * BEAT) / FPS; // 2 beats per market — the slow second look
const P1_LEN = 12 * BEAT; // 300
const P2_LEN = 12 * 2 * BEAT; // 600
const P2_START = P1_LEN; // 300
const P3_START = P1_LEN + P2_LEN; // 900
const DURATION = P1_LEN + P2_LEN + P2_LEN; // 1500 → 25s
const SEAMS = [0, P2_START, P3_START, DURATION] as const;

// ── Music ───────────────────────────────────────────────────────────────────
// Same energetic slice the family rides: music starts at 50.293s, so the drop
// (53.8s) lands a beat into the loop. See RetailPnLShort / MUSIC.md.
const MUSIC = "music/rainbows-pitch.mp3";
const MUSIC_OFFSET = Math.round(50.293 * FPS); // 3018
const MUSIC_GAIN = 0.9;
const WHOOSH = "sfx/mg-whoosh-light.mp3";
const IMPACT = "sfx/drop-sub-impact.mp3";

// ── Reel band geometry ──────────────────────────────────────────────────────
const REEL_W = 1920;
const REEL_H = 1080;
const SCALE = W / REEL_W; // 0.5625 → full graph, full width
const REEL_TOP = 560; // centred band, headline above, pass dots below

const PALETTE = {
  text: "#F4F6F8",
  gold: "#F2B43A",
  dim: "#8A909B",
  veryDim: "#5C626D",
  red: "#EE2B2B",
};

// The reel, scaled to fill the width and parked at REEL_TOP. enableShutdown is
// off so each pass cuts clean on the twelfth market instead of powering down.
const ReelBand: React.FC<{ hold: number; highlight: boolean }> = ({
  hold,
  highlight,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: REEL_TOP,
      width: REEL_W,
      height: REEL_H,
      transform: `scale(${SCALE})`,
      transformOrigin: "0 0",
      borderRadius: 40,
      overflow: "hidden",
      boxShadow: "0 40px 120px -40px rgba(0,0,0,0.9)",
    }}
  >
    <RetailPnLMarketsReel
      holdSecondsPerSnapshot={hold}
      enableShutdown={false}
      highlightDiff={highlight}
    />
  </div>
);

const Background: React.FC = () => (
  <>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% 26%, #12161D 0%, #070A0E 60%, #04060A 100%)",
      }}
    />
    {/* A soft glow under the screen so the bright reel feels emissive. */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 70% 26% at 50% 47%, rgba(120,150,210,0.16) 0%, transparent 60%)",
      }}
    />
  </>
);

// Thesis line — pinned, so anyone joining mid-loop reads it. "instrument" carries
// the weight, so it carries the colour.
const Headline: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 150,
      left: 0,
      width: W,
      padding: "0 86px",
      textAlign: "center",
      fontFamily: INTER,
      fontSize: 60,
      fontWeight: 800,
      letterSpacing: "-0.03em",
      lineHeight: 1.08,
      color: PALETTE.text,
    }}
  >
    The <span style={{ color: PALETTE.gold }}>instrument</span> matters more than
    your strategy
  </div>
);

// Three dots below the screen — which pass you're watching.
const PassDots: React.FC<{ pass: number }> = ({ pass }) => (
  <div
    style={{
      position: "absolute",
      top: REEL_TOP + REEL_H * SCALE + 56,
      left: 0,
      width: W,
      display: "flex",
      justifyContent: "center",
      gap: 22,
    }}
  >
    {[0, 1, 2].map((i) => {
      const active = i === pass;
      const color = i === 2 ? PALETTE.red : PALETTE.gold;
      return (
        <div
          key={i}
          style={{
            width: active ? 56 : 16,
            height: 16,
            borderRadius: 999,
            background: active ? color : "rgba(255,255,255,0.18)",
            transition: "none",
          }}
        />
      );
    })}
  </div>
);

const Footer: React.FC = () => (
  <div
    style={{
      position: "absolute",
      bottom: 70,
      left: 0,
      width: W,
      textAlign: "center",
      fontFamily: INTER,
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: "0.04em",
      color: PALETTE.veryDim,
    }}
  >
    generalmarket.io
  </div>
);

// A short CRT glitch masks each pass cut so the loop reads as a channel change.
const GlitchSeam: React.FC = () => {
  const frame = useCurrentFrame();
  const inten = Math.max(
    0,
    ...SEAMS.map((s) => Math.max(0, 1 - Math.abs(frame - s) / 5)),
  );
  if (inten <= 0.001) return null;
  const off = 10 * inten;
  return (
    <>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity: 0.5 * inten,
          background:
            "linear-gradient(0deg, rgba(255,255,255,0.0) 0%, rgba(220,235,255,0.9) 48%, rgba(255,255,255,0.0) 52%)",
          transform: `translateY(${(0.5 - (frame % 2)) * 30}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity: 0.35 * inten,
          background: `linear-gradient(90deg, rgba(255,0,40,0.5), transparent 30%), linear-gradient(270deg, rgba(0,160,255,0.5), transparent 30%)`,
          transform: `translateX(${off}px)`,
        }}
      />
    </>
  );
};

const Score: React.FC = () => (
  <>
    <Audio
      src={staticFile(MUSIC)}
      startFrom={MUSIC_OFFSET}
      volume={(f) =>
        interpolate(
          f,
          [0, 10, DURATION - 70, DURATION],
          [0, MUSIC_GAIN, MUSIC_GAIN, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      }
    />
    {/* A light whoosh leads each pass change; its peak lands on the downbeat. */}
    {[P2_START, P3_START].map((cut) => (
      <Sequence
        key={`wh-${cut}`}
        from={cut - 12}
        durationInFrames={36}
        layout="none"
        name={`whoosh-${cut}`}
      >
        <Audio
          src={staticFile(WHOOSH)}
          volume={(f) =>
            interpolate(f, [0, 8, 26, 36], [0, 0.22, 0.22, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      </Sequence>
    ))}
    {/* Sub-impact on the red pass — the payoff lands with weight. */}
    <Sequence from={P3_START} durationInFrames={50} layout="none" name="impact">
      <Audio
        src={staticFile(IMPACT)}
        volume={(f) =>
          interpolate(f, [0, 2, 38, 50], [0, 0.34, 0.34, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </Sequence>
  </>
);

export const RetailPnLMarketsReelShort: React.FC = () => {
  const frame = useCurrentFrame();
  const pass = frame < P2_START ? 0 : frame < P3_START ? 1 : 2;

  return (
    <AbsoluteFill style={{ backgroundColor: "#04060A", fontFamily: INTER }}>
      <Background />

      <Sequence from={0} durationInFrames={P1_LEN} layout="none" name="pass-1">
        <ReelBand hold={P1_HOLD} highlight={false} />
      </Sequence>
      <Sequence
        from={P2_START}
        durationInFrames={P2_LEN}
        layout="none"
        name="pass-2"
      >
        <ReelBand hold={P2_HOLD} highlight={false} />
      </Sequence>
      <Sequence
        from={P3_START}
        durationInFrames={P2_LEN}
        layout="none"
        name="pass-3"
      >
        <ReelBand hold={P2_HOLD} highlight={true} />
      </Sequence>

      <Headline />
      <PassDots pass={pass} />
      <Footer />
      <GlitchSeam />
      <Score />
    </AbsoluteFill>
  );
};

export const retailPnLMarketsReelShortMeta = {
  id: "RetailPnLMarketsReelShort",
  component: RetailPnLMarketsReelShort,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
