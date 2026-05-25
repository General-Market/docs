// Vertical short (Shorts / Reels / TikTok). Thesis: the instrument you choose
// matters more than your strategy. Each beat takes a rigged venue's Lorenz curve
// and "moves it left" toward the fair diagonal by switching to a fairer venue in
// the same category — the curve lifts, the top-1% take drops.

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
import { MARKETS_CONCENTRATION } from "./data";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

const W = 1080;
const H = 1920;
const FPS = 30;

const PALETTE = {
  bgTop: "#1A1E25",
  bgBottom: "#06080C",
  gridLine: "rgba(255, 255, 255, 0.05)",
  text: "#F5F6F8",
  textDim: "#9AA0AA",
  textVeryDim: "#5F6571",
  gold: "#F1B638",
  goldBright: "#F4B73B",
  rigged: "rgba(255, 255, 255, 0.34)",
  fair: "rgba(255, 255, 255, 0.16)",
  axis: "#E4E7EB",
};

const byLabel = (label: string) =>
  MARKETS_CONCENTRATION.snapshots.find((s) => s.label === label)!;

type Pair = {
  rigged: string;
  fairer: string;
  riggedTop1: number;
  fairerTop1: number;
};

// Same category, fairer instrument. Following the brief's order.
const PAIRS: Pair[] = [
  { rigged: "Sports betting", fairer: "Prediction markets", riggedTop1: 87, fairerTop1: 84 },
  { rigged: "Online lottery", fairer: "Memecoins", riggedTop1: 100, fairerTop1: 89 },
  { rigged: "Robinhood stocks", fairer: "Index funds", riggedTop1: 35, fairerTop1: 8 },
  { rigged: "FX / CFDs", fairer: "Crypto perps", riggedTop1: 70, fairerTop1: 61 },
];

// ── Music & beat-synced timeline ────────────────────────────────────────────
// rainbows-pitch.mp3 — 144 BPM, steady 4/4, 1 bar = 50 frames @ 30fps. The edit
// rides the track's own grid: every scene cut is a detected downbeat. The hook
// plays over the breakdown tail (50.29s); beat 1 lands ON the drop (53.80s); the
// four reveals ride the high-energy section; the outro eases out at 87s.
const MUSIC = "music/rainbows-pitch.mp3";
const MUSIC_OFFSET_FRAMES = 1509; // music 50.293s = video frame 0
const MUSIC_GAIN = 0.82; // leaves headroom so the drop's sub-impact never clips
const BAR = 50; // frames per musical bar at 144 BPM / 30fps

// Cut points — detected downbeats (frames from video start). See MUSIC.md.
const CUTS = [0, 105, 310, 509, 708, 906, 1105] as const;
const HOOK_START = CUTS[0];
const BEATS_START = CUTS[1];
const OUTRO_START = CUTS[5];
export const SHORT_DURATION = CUTS[CUTS.length - 1];

// Transition stingers — a light whoosh leads each cut, a sub-impact on the drop.
const WHOOSH = "sfx/mg-whoosh-light.mp3";
const DROP_IMPACT = "sfx/drop-sub-impact.mp3";
const CUT_FRAMES = [BEATS_START, CUTS[2], CUTS[3], CUTS[4], OUTRO_START];

// ── Plot geometry (a square plot, centered horizontally) ────────────────────
const plotL = 180;
const plotR = W - 90; // 990
const plotW = plotR - plotL; // 810
const plotT = 600;
const plotBottom = 1410;
const plotH = plotBottom - plotT; // 810

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const xAt = (i: number, n: number) => plotL + (i / (n - 1)) * plotW;
const yAt = (v: number) => plotT + (1 - v / 100) * plotH;
const polyPoints = (values: number[]) =>
  values.map((v, i) => `${xAt(i, values.length).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");

const GridBackdrop: React.FC = () => {
  const spacing = 120;
  const cols = Math.ceil(W / spacing);
  const rows = Math.ceil(H / spacing);
  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="short-grid-mask" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.6" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="short-grid-fade">
            <rect width={W} height={H} fill="url(#short-grid-mask)" />
          </mask>
        </defs>
        <g mask="url(#short-grid-fade)">
          {Array.from({ length: rows + 1 }).map((_, r) => (
            <line key={`h-${r}`} x1={0} y1={r * spacing} x2={W} y2={r * spacing} stroke={PALETTE.gridLine} strokeWidth={1.2} />
          ))}
          {Array.from({ length: cols + 1 }).map((_, c) => (
            <line key={`v-${c}`} x1={c * spacing} y1={0} x2={c * spacing} y2={H} stroke={PALETTE.gridLine} strokeWidth={1.2} />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const Background: React.FC = () => (
  <>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 120% 60% at 50% 30%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`,
      }}
    />
    <GridBackdrop />
  </>
);

const HookCard: React.FC<{ local: number; dur: number }> = ({ local, dur }) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: local, fps, config: { damping: 200, mass: 0.7 }, durationInFrames: 30 });
  // Clear quickly on the last few frames so the drop hits clean.
  const exit = interpolate(local, [dur - 12, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(enter, [0, 1], [0, 1]) * exit;
  const lift = interpolate(enter, [0, 1], [60, 0]);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 110px",
        textAlign: "center",
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div style={{ fontFamily: INTER, fontSize: 44, fontWeight: 600, letterSpacing: "-0.01em", color: PALETTE.gold, marginBottom: 36 }}>
        Before strategy
      </div>
      <div style={{ fontFamily: INTER, fontSize: 96, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02, color: PALETTE.text }}>
        The instrument matters more than the strategy
      </div>
    </AbsoluteFill>
  );
};

const ComparisonBeat: React.FC<{ pair: Pair; local: number }> = ({ pair, local }) => {
  const { fps } = useVideoConfig();
  const riggedSnap = byLabel(pair.rigged);
  const fairerSnap = byLabel(pair.fairer);

  const enter = interpolate(local, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lift = interpolate(local, [0, 16], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Scale punch on the downbeat — the cut lands with the beat.
  const punch = spring({ frame: local, fps, config: { damping: 14, stiffness: 200, mass: 0.6 }, from: 0, to: 1 });
  const scale = interpolate(punch, [0, 1], [1.04, 1]);

  // The curve travels from rigged to fairer across bars 1→3 ("moves left"), so the
  // morph and the count-down ride the music's bars rather than arbitrary frames.
  const t = interpolate(local, [BAR, BAR * 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });
  const moving = lerp(0, 1, t);

  const goldValues = riggedSnap.values.map((v, i) => lerp(v, fairerSnap.values[i] ?? v, t));
  const goldNum = Math.round(lerp(pair.riggedTop1, pair.fairerTop1, t));

  // Dots on the moving gold curve.
  const dots = goldValues.map((v, i) => ({ cx: xAt(i, goldValues.length), cy: yAt(v) }));

  const fairerShown = t > 0.5;

  return (
    <AbsoluteFill style={{ opacity: enter, transform: `translateY(${lift}px) scale(${scale})` }}>
      {/* Header — the recommendation */}
      <div style={{ position: "absolute", top: 150, left: 90, right: 90, textAlign: "center" }}>
        <div style={{ fontFamily: INTER, fontSize: 38, fontWeight: 500, letterSpacing: "-0.005em", color: PALETTE.textDim, marginBottom: 14 }}>
          instead of <span style={{ color: PALETTE.rigged, textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.4)" }}>{pair.rigged}</span>
        </div>
        <div style={{ fontFamily: INTER, fontSize: 92, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 0.98, color: PALETTE.gold }}>
          {pair.fairer}
        </div>
      </div>

      {/* Chart */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="short-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* plot frame */}
        <line x1={plotL} y1={plotT} x2={plotL} y2={plotBottom} stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
        <line x1={plotL} y1={plotBottom} x2={plotR} y2={plotBottom} stroke="rgba(255,255,255,0.18)" strokeWidth={2} />

        {/* y ticks */}
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={plotL} y1={yAt(tick)} x2={plotR} y2={yAt(tick)} stroke={PALETTE.gridLine} strokeWidth={1.5} />
            <text x={plotL - 26} y={yAt(tick) + 14} textAnchor="end" fontFamily={INTER} fontSize={40} fontWeight={600} fill={PALETTE.axis}>
              {tick}%
            </text>
          </g>
        ))}

        {/* perfectly-fair diagonal */}
        <line x1={plotL} y1={plotBottom} x2={plotR} y2={plotT} stroke="rgba(255,255,255,0.22)" strokeWidth={2.5} strokeDasharray="10 12" />
        <text x={plotR - 6} y={plotT - 18} textAnchor="end" fontFamily={INTER} fontSize={30} fontWeight={500} fill={PALETTE.textVeryDim}>
          perfectly fair
        </text>

        {/* rigged curve — where you were (stays as a ghost) */}
        <polyline points={polyPoints(riggedSnap.values)} fill="none" stroke={PALETTE.rigged} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />

        {/* gold curve — moving left toward fair */}
        <polyline points={polyPoints(goldValues)} fill="none" stroke={PALETTE.goldBright} strokeWidth={14} opacity={0.5} filter="url(#short-glow)" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={polyPoints(goldValues)} fill="none" stroke={PALETTE.gold} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={9} fill={PALETTE.gold} stroke="#0A0D11" strokeWidth={4} />
        ))}

        {/* "moves left" cue during the morph */}
        {moving > 0.04 && moving < 0.96 ? (
          <text x={(plotL + plotR) / 2} y={plotBottom + 70} textAnchor="middle" fontFamily={INTER} fontSize={40} fontWeight={600} fill={PALETTE.text} opacity={0.9}>
            ← the curve moves left
          </text>
        ) : null}
      </svg>

      {/* Number — top 1% take, counting down */}
      <div style={{ position: "absolute", top: 1530, left: 90, right: 90, textAlign: "center" }}>
        <div style={{ fontFamily: INTER, fontSize: 36, fontWeight: 600, letterSpacing: "0.12em", color: PALETTE.textDim, textTransform: "uppercase", marginBottom: 6 }}>
          Top 1% takes
        </div>
        <div style={{ fontFamily: INTER, fontSize: 150, fontWeight: 800, letterSpacing: "-0.04em", color: PALETTE.gold, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {goldNum}%
        </div>
        <div style={{ fontFamily: INTER, fontSize: 38, fontWeight: 500, color: PALETTE.textVeryDim, marginTop: 8, opacity: fairerShown ? 1 : 0 }}>
          down from {pair.riggedTop1}%
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroCard: React.FC<{ local: number }> = ({ local }) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: local, fps, config: { damping: 200, mass: 0.7 }, durationInFrames: 30 });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [50, 0]);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 110px", textAlign: "center", opacity, transform: `translateY(${lift}px)` }}>
      <div style={{ fontFamily: INTER, fontSize: 84, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, color: PALETTE.text }}>
        Same game.<br />Better odds.
      </div>
      <div style={{ fontFamily: INTER, fontSize: 44, fontWeight: 500, letterSpacing: "-0.01em", color: PALETTE.textDim, marginTop: 40 }}>
        Just by choosing where you play.
      </div>
    </AbsoluteFill>
  );
};

// ── Audio — the score sits on top of the silent visuals, full level (no VO) ──
const Score: React.FC = () => (
  <>
    <Audio
      src={staticFile(MUSIC)}
      startFrom={MUSIC_OFFSET_FRAMES}
      volume={(f) =>
        interpolate(
          f,
          [0, 8, SHORT_DURATION - 44, SHORT_DURATION],
          [0, MUSIC_GAIN, MUSIC_GAIN, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      }
    />
    {/* A light whoosh leads every cut; its peak lands on the downbeat. */}
    {CUT_FRAMES.map((cut) => (
      <Sequence key={`wh-${cut}`} from={cut - 9} durationInFrames={30} layout="none" name={`whoosh-${cut}`}>
        <Audio
          src={staticFile(WHOOSH)}
          volume={(f) => interpolate(f, [0, 6, 22, 30], [0, 0.2, 0.2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      </Sequence>
    ))}
    {/* Sub-impact on the drop only — beat 1 lands with weight. */}
    <Sequence from={BEATS_START} durationInFrames={50} layout="none" name="drop-impact">
      <Audio
        src={staticFile(DROP_IMPACT)}
        volume={(f) => interpolate(f, [0, 2, 38, 50], [0, 0.34, 0.34, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </Sequence>
  </>
);

export const RetailPnLShort: React.FC = () => {
  const frame = useCurrentFrame();

  let content: React.ReactNode = null;
  if (frame < BEATS_START) {
    content = <HookCard local={frame - HOOK_START} dur={BEATS_START - HOOK_START} />;
  } else if (frame < OUTRO_START) {
    // Each beat spans CUTS[1+i]..CUTS[2+i] — detected downbeats, not uniform.
    let beatIdx = 0;
    while (beatIdx < PAIRS.length - 1 && frame >= CUTS[2 + beatIdx]) beatIdx++;
    const start = CUTS[1 + beatIdx];
    content = <ComparisonBeat pair={PAIRS[beatIdx]} local={frame - start} />;
  } else {
    content = <OutroCard local={frame - OUTRO_START} />;
  }

  return (
    <AbsoluteFill style={{ fontFamily: INTER }}>
      <Background />
      {content}
      <Score />
    </AbsoluteFill>
  );
};

export const retailPnLShortMeta = {
  id: "RetailPnLShort",
  component: RetailPnLShort,
  durationInFrames: SHORT_DURATION,
  fps: FPS,
  width: W,
  height: H,
};
