// Vertical short (Shorts / Reels / TikTok) built around the CRT markets reel.
//
// Four screens, one comparison each, on the music's bar grid. The reel graph is
// the constant hero; each screen names one pair that "moved the curve left" and
// flips the field — white with horizontal dot bands, blue with vertical ones.
// Screens hand off with the AntiCheatEdit pixel dissolve. The back two screens
// burn the graph red, shading the wedge from the perfectly-fair diagonal.
//
// Music: rainbows-pitch.mp3 (144 BPM) opened ON the drop (53.8s) so the short is
// already moving the instant it loads. A beat is 25 frames, a bar is 100; every
// screen change and caption move lands on the grid.

import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { EASE } from "../../common/easing";
import { RetailPnLPairChart } from "./RetailPnLPairChart";
import { RetailPnLReelShortBg } from "./RetailPnLReelShortBg";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

const W = 1080;
const H = 1920;
const FPS = 60;

// ── Beat grid (144 BPM @ 60fps): a beat is 25 frames, a bar is 100 ───────────
const BAR = 100;
const SCREEN = 3 * BAR; // 300 — three bars per screen
const STARTS = [0, SCREEN, 2 * SCREEN, 3 * SCREEN]; // 0, 300, 600, 900
const DURATION = 4 * SCREEN; // 1200 → 20s
const SEAMS = [SCREEN, 2 * SCREEN, 3 * SCREEN]; // pixel-dissolve points
const XF = 12; // half-width of a pixel transition, frames
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── Music ───────────────────────────────────────────────────────────────────
const MUSIC = "music/rainbows-pitch.mp3";
const MUSIC_OFFSET = Math.round(53.8 * FPS); // 3228 — open on the drop
const MUSIC_GAIN = 0.9;
const WHOOSH = "sfx/mg-whoosh-light.mp3";
const IMPACT = "sfx/drop-sub-impact.mp3";

// ── Pair chart — portrait Lorenz panel, ~60% of the height ───────────────────
const CW = 1000;
const CHART_SCALE = 0.95; // → 1121px tall ≈ 58% of the frame
const CHART_TOP = 360;
const CHART_LEFT = (W - CW * CHART_SCALE) / 2;

// ── Per-screen look ──────────────────────────────────────────────────────────
const WHITE_BG = "#F0F2F4";
const BLUE_BG = "#2D5BFF";
const ACCENT = "#2D5BFF";
const RED = "#EE2B2B";
type Screen = {
  bg: string;
  dir: "horizontal" | "vertical";
  tone: "accent" | "white";
  text: string;
  accent: string;
  dim: string;
  fair: string; // matches the data label
  rigged: string; // data label, for the chart lookup
  riggedCap: string; // shorter label shown in the caption
  curve: string; // fair-curve colour on the chart
  hi: boolean; // shade the red wedge
};
const WHITE_SCREEN = (
  fair: string,
  rigged: string,
  riggedCap: string,
  curve: string,
  hi: boolean,
): Screen => ({
  bg: WHITE_BG,
  dir: "horizontal",
  tone: "accent",
  text: "#0A0A0A",
  accent: curve,
  dim: "#6E727A",
  fair,
  rigged,
  riggedCap,
  curve,
  hi,
});
const BLUE_SCREEN = (
  fair: string,
  rigged: string,
  riggedCap: string,
  curve: string,
  hi: boolean,
): Screen => ({
  bg: BLUE_BG,
  dir: "vertical",
  tone: "white",
  text: "#FFFFFF",
  accent: "#FFFFFF",
  dim: "rgba(255,255,255,0.72)",
  fair,
  rigged,
  riggedCap,
  curve,
  hi,
});
const SCREENS: Screen[] = [
  WHITE_SCREEN("Prediction markets", "Sports betting", "sports betting", ACCENT, false),
  BLUE_SCREEN("Memecoins", "Online lottery", "the lottery", ACCENT, false),
  WHITE_SCREEN("Index funds", "Robinhood stocks", "stock picking", RED, true),
  BLUE_SCREEN("Crypto perps", "FX / CFDs", "CFDs", RED, true),
];

const screenAt = (frame: number) =>
  Math.min(3, Math.max(0, Math.floor(frame / SCREEN)));

// ── Chart stage — the current screen's pair, lifting left over ~2 bars ───────
const ChartStage: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = screenAt(frame);
  const s = SCREENS[idx];
  const local = frame - STARTS[idx];
  const progress = interpolate(local, [16, 2 * BAR], [0, 1], {
    ...CLAMP,
    easing: EASE.out,
  });
  return (
    <div
      style={{
        position: "absolute",
        left: CHART_LEFT,
        top: CHART_TOP,
        transform: `scale(${CHART_SCALE})`,
        transformOrigin: "0 0",
      }}
    >
      <RetailPnLPairChart
        fair={s.fair}
        rigged={s.rigged}
        progress={progress}
        color={s.curve}
        highlight={s.hi}
      />
    </div>
  );
};

// ── Pixel dissolve (portrait port of anticheat-edit PixelReveal) ─────────────
const PCELL = 60;
const PCOLS = Math.ceil(W / PCELL);
const PROWS = Math.ceil(H / PCELL);
const phash = (c: number, r: number) => {
  const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const JIT = 0.18;

// A curtain of solid cells sweeps in from up-left, fully covers at the seam,
// then peels off down-right — masking the hard swap of field + caption beneath.
// The loop wrap (1200→0) is filled at the tail and peeled at the head, so the
// constant loop never shows a hard cut.
const PixelCurtain: React.FC = () => {
  const frame = useCurrentFrame();
  let cover: number;
  let incoming: Screen;
  const near = SEAMS.find((s) => Math.abs(frame - s) <= XF);
  if (near !== undefined) {
    cover = frame <= near ? (frame - (near - XF)) / XF : 1 - (frame - near) / XF;
    incoming = SCREENS[screenAt(near + 1)];
  } else if (frame <= XF) {
    cover = 1 - frame / XF; // peel the wrap off the head
    incoming = SCREENS[0];
  } else if (frame >= DURATION - XF) {
    cover = (frame - (DURATION - XF)) / XF; // fill toward the wrap at the tail
    incoming = SCREENS[0];
  } else {
    return null;
  }
  cover = Math.max(0, Math.min(1, cover));

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < PROWS; r++) {
    const fy = PROWS > 1 ? r / (PROWS - 1) : 0;
    for (let c = 0; c < PCOLS; c++) {
      const fx = PCOLS > 1 ? c / (PCOLS - 1) : 0;
      const diag = 0.5 * fx + 0.5 * fy; // from up-left
      const thr = (diag + phash(c, r) * JIT) / (1 + JIT);
      if (thr > cover) continue;
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={c * PCELL}
          y={r * PCELL}
          width={PCELL + 1}
          height={PCELL + 1}
          fill={incoming.bg}
        />,
      );
    }
  }
  return (
    <svg
      width={W}
      height={H}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      shapeRendering="crispEdges"
    >
      {cells}
    </svg>
  );
};

// ── Text ──────────────────────────────────────────────────────────────────────
// Intro title — the thesis sits above the graph first, then lifts away and
// disappears before the pairs begin. Anchored to the top band so it never
// crosses the chart.
const IntroTitle: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [4, 24], [0, 1], CLAMP);
  const exit = interpolate(frame, [98, 120], [1, 0], CLAMP);
  const op = enter * exit;
  if (op <= 0.001) return null;
  const lift = interpolate(enter, [0, 1], [34, 0]) + interpolate(frame, [98, 120], [0, -46], CLAMP);
  return (
    <div
      style={{
        position: "absolute",
        top: 196,
        left: 0,
        width: W,
        padding: "0 92px",
        textAlign: "center",
        fontFamily: INTER,
        fontSize: 62,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        lineHeight: 1.06,
        color: text,
        opacity: op,
        transform: `translateY(${lift}px)`,
      }}
    >
      The instrument matters more than your strategy
    </div>
  );
};

const CAP_TOP = 1500;

// One pair per screen, below the graph. Springs in on the screen's downbeat,
// holds, then disappears just before the pixel dissolve.
const PairCaption: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const idx = screenAt(frame);
  const start = STARTS[idx];
  const local = frame - start;
  const s = SCREENS[idx];
  // Screen 1 yields its first beats to the intro title.
  const inAt = idx === 0 ? 130 : 8;
  const outAt = SCREEN - XF - 18; // gone before the dissolve
  const enter = spring({ frame: local - inAt, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 20 });
  const exit = interpolate(local, [outAt, outAt + 16], [1, 0], CLAMP);
  const op = enter * exit;
  if (op <= 0.001) return null;
  // A gentle beat pulse on every downbeat.
  const beatPhase = (local % BAR) / BAR;
  const pulse = 1 + 0.03 * Math.max(0, 1 - beatPhase * 6);
  return (
    <div
      style={{
        position: "absolute",
        top: CAP_TOP,
        left: 0,
        width: W,
        textAlign: "center",
        opacity: op,
        transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px) scale(${pulse})`,
      }}
    >
      <div style={{ fontFamily: INTER, fontSize: 30, fontWeight: 700, letterSpacing: "0.18em", color: s.accent, marginBottom: 26 }}>
        SAME GAME — MOVED LEFT
      </div>
      <div style={{ fontFamily: INTER, fontSize: 60, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        <span style={{ color: s.text, fontWeight: 800 }}>{s.fair}</span>
        <span style={{ color: s.accent, margin: "0 20px", fontSize: 50 }}>◂</span>
        <span style={{ color: s.dim }}>{s.riggedCap}</span>
      </div>
    </div>
  );
};

const Footer: React.FC<{ dim: string }> = ({ dim }) => (
  <div
    style={{
      position: "absolute",
      bottom: 60,
      left: 0,
      width: W,
      textAlign: "center",
      fontFamily: INTER,
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: "0.04em",
      color: dim,
    }}
  >
    generalmarket.io
  </div>
);

const Score: React.FC = () => (
  <>
    <Audio
      src={staticFile(MUSIC)}
      startFrom={MUSIC_OFFSET}
      volume={(f) =>
        interpolate(f, [0, 8, DURATION - 60, DURATION], [0, MUSIC_GAIN, MUSIC_GAIN, 0], CLAMP)
      }
    />
    {SEAMS.map((cut) => (
      <Sequence key={`wh-${cut}`} from={cut - 12} durationInFrames={36} layout="none" name={`whoosh-${cut}`}>
        <Audio src={staticFile(WHOOSH)} volume={(f) => interpolate(f, [0, 8, 26, 36], [0, 0.24, 0.24, 0], CLAMP)} />
      </Sequence>
    ))}
    <Sequence from={2 * SCREEN} durationInFrames={50} layout="none" name="impact">
      <Audio src={staticFile(IMPACT)} volume={(f) => interpolate(f, [0, 2, 38, 50], [0, 0.34, 0.34, 0], CLAMP)} />
    </Sequence>
  </>
);

export const RetailPnLMarketsReelShort: React.FC = () => {
  const frame = useCurrentFrame();
  const s = SCREENS[screenAt(frame)];

  return (
    <AbsoluteFill style={{ fontFamily: INTER }}>
      <AbsoluteFill style={{ backgroundColor: s.bg }} />
      <RetailPnLReelShortBg direction={s.dir} tone={s.tone} speed={2.8} lead={90} />

      <ChartStage />

      <IntroTitle text={s.text} />
      <PairCaption />
      <Footer dim={s.dim} />
      <PixelCurtain />
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
