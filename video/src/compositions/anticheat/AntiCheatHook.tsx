import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, toFrames } from "./theme";

const BROLL = {
  minecraft: staticFile("cheat-broll/minecraft-killaura.mp4"),
  cs2: staticFile("cheat-broll/cs2-spinbot.mp4"),
  valorant: staticFile("cheat-broll/valorant-wallhack.mp4"),
};

const PAIRS = [
  { game: "Spin-bots", trade: "Insider traders", broll: BROLL.cs2 },
  { game: "Wall-hackers", trade: "Front-runners", broll: BROLL.valorant },
  { game: "Kill aura", trade: "Order-flow buyers", broll: BROLL.minecraft },
] as const;

// All major moments locked to absolute video beats (see beats.ts).
// Hook covers beats 0–8 (frames 17–223). Scene-local frames below.
//   beat 0  → frame 17  — header in
//   beat 1  → frame 43  — split begins
//   beat 3  → frame 94  — pair 1
//   beat 4  → frame 120 — pair 2
//   beat 5  → frame 146 — pair 3
//   beat 6  → frame 172 — verdict reveal
//   beat 8  → frame 223 — Bars overlays
const HEADER_IN = 17;
const SPLIT_AT = 43;
// Three pairs — each lands on its own beat. Beats 3/4/5 don't sit on a
// uniform step (25, 26), so spell them out instead of stepping.
const PAIR_FRAMES = [94, 120, 146];
const REVEAL_AT = 172;

const HOOK_DURATION = 254;

export const AntiCheatHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring drives the split. At frame=SPLIT_AT it begins; before that it
  // sits at 0, which means the left panel occupies the full canvas.
  const splitProgress = spring({
    frame: frame - SPLIT_AT,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });
  const splitOffset = interpolate(splitProgress, [0, 1], [0, W / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Continuous Z-push across the full hook — imperceptible per frame,
  // undeniable in retrospect. The whole composition slowly closes in.
  const zoomScale = interpolate(frame, [0, HOOK_DURATION], [1, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", fontFamily: font }}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: "50% 50%",
        }}
      >
        {/* ── Left panel: PLAY — full width until the split, then half ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: `${splitOffset}px`,
            overflow: "hidden",
            borderRight: `1px solid ${"#1f1f1f"}`,
          }}
        >
          <CheaterBrollSequence />
          <StripDarken />
          <PanelLabel
            eyebrow="When you play"
            showFrom={HEADER_IN}
            align="left"
            frame={frame}
            fps={fps}
          />
          <PairList
            pairs={PAIRS}
            field="game"
            align="left"
            frames={PAIR_FRAMES}
            frame={frame}
            fps={fps}
          />
        </div>

        {/* ── Right panel: TRADE — slides in from the right edge ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${W - splitOffset}px`,
            right: 0,
            overflow: "hidden",
            borderLeft: `1px solid ${"#1f1f1f"}`,
          }}
        >
          <TradingScreen frame={frame} showFrom={SPLIT_AT} />
          <StripDarken tint={"#ff3b3b"} />
          <PanelLabel
            eyebrow="When you trade"
            showFrom={SPLIT_AT}
            align="right"
            frame={frame}
            fps={fps}
            tint={"#ff3b3b"}
          />
          <PairList
            pairs={PAIRS}
            field="trade"
            align="right"
            frames={PAIR_FRAMES}
            frame={frame}
            fps={fps}
            tint={"#ff3b3b"}
          />
        </div>

        {/* ── Reveal lines ── */}
        <Sequence from={REVEAL_AT} layout="none">
          <RevealLines />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Left panel broll: a clean sequential timeline with crossfades ────────────
//
// 0.0–1.8s   minecraft-killaura  (startFrom 1.5s — opening of source is black)
// 1.8–4.8s   cs2-spinbot
// 4.8–9.0s   valorant-wallhack   (covered by reveal overlay from 5.7s)
//
// The crossfade overlap is absorbed by the linearTiming duration, so no clip
// ever runs out of source material before its slot ends.

const FADE = toFrames(0.27); // 8 frames at 30fps

// Clip cuts ride on beats 2 and 5 (frames 69 and 146). The first cut
// minecraft→cs2 lands at 69; the second cs2→valorant at 146. Durations
// include the fade overlap so the visible cut sits on the beat.
const CLIP_1 = 69;
const CLIP_2 = 146 - 69; // 77

const CheaterBrollSequence: React.FC = () => {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={CLIP_1}>
          <BrollClip
            src={BROLL.minecraft}
            maskDisclaimer
            startFrom={toFrames(1.5)}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={CLIP_2}>
          <BrollClip src={BROLL.cs2} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={toFrames(4.2)}>
          <BrollClip src={BROLL.valorant} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

const BrollClip: React.FC<{
  src: string;
  maskDisclaimer?: boolean;
  startFrom?: number;
}> = ({ src, maskDisclaimer, startFrom }) => {
  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(1.05) contrast(1.05) brightness(0.95)",
  };

  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={src}
        muted
        playbackRate={1.0}
        startFrom={startFrom}
        style={videoStyle}
      />
      {maskDisclaimer ? <DisclaimerMask /> : null}
    </AbsoluteFill>
  );
};

// Covers the baked-in yellow "Disclaimer: I am NOT sponsored…" plus the HUD
// strip beneath it (inventory bar, "Toggled Free Look on", etc). Spans the
// full panel width so it survives the half-panel `objectFit: cover` zoom
// after the split — vertical-only feathering blends it into the broll.
const DisclaimerMask: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: "68%",
      height: "32%",
      backgroundColor: "#050608",
      backgroundImage:
        "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1.4px), radial-gradient(rgba(60,180,120,0.016) 1px, transparent 1.4px)",
      backgroundSize: "4px 4px, 7px 7px",
      backgroundPosition: "0 0, 1px 2px",
      maskImage:
        "linear-gradient(180deg, transparent 0%, black 18%, black 100%)",
      WebkitMaskImage:
        "linear-gradient(180deg, transparent 0%, black 18%, black 100%)",
      pointerEvents: "none",
    }}
  />
);

// ─── Right panel: procedural trading screen ────────────────────────────────────

const CANDLE_COUNT = 48;

const TradingScreen: React.FC<{ frame: number; showFrom: number }> = ({
  frame,
  showFrom,
}) => {
  const fadeIn = interpolate(
    frame,
    [showFrom, showFrom + toFrames(0.5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Time progresses with frame — candles drift left.
  const t = Math.max(0, frame - showFrom);

  // The "manipulation candle" — a violent red drop at this moment.
  const manipFrame = toFrames(4.4) - showFrom;

  const candles = generateCandles(t, CANDLE_COUNT, manipFrame);
  const lastClose = candles[candles.length - 1].close;
  const prevClose = candles[Math.max(0, candles.length - 2)].close;
  const pct = ((lastClose - prevClose) / prevClose) * 100;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: fadeIn,
        background:
          "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
      }}
    >
      {/* Header strip */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 32,
          right: 32,
          display: "flex",
          gap: 28,
          alignItems: "baseline",
          fontFamily: monoFont,
          color: "#7a7a7a",
          fontSize: 30,
          letterSpacing: "0.06em",
          opacity: 0.85,
        }}
      >
        <span style={{ color: "#f5f5f5", fontWeight: 600 }}>BTC-PERP</span>
        <span>{lastClose.toFixed(2)}</span>
        <span style={{ color: pct >= 0 ? "#3ddc84" : "#ff3b3b" }}>
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%
        </span>
        <span style={{ marginLeft: "auto", opacity: 0.5 }}>1m · LIVE</span>
      </div>

      {/* Chart area */}
      <div
        style={{
          position: "absolute",
          left: 32,
          right: 360,
          top: 90,
          bottom: 200,
          overflow: "hidden",
        }}
      >
        <CandleChart candles={candles} />
      </div>

      {/* Order book on the right */}
      <div
        style={{
          position: "absolute",
          right: 32,
          top: 90,
          width: 300,
          bottom: 200,
        }}
      >
        <OrderBook frame={t} centerPrice={lastClose} />
      </div>

      {/* Bottom ticker scroll — fast money */}
      <div
        style={{
          position: "absolute",
          left: 32,
          right: 32,
          bottom: 90,
          height: 70,
          borderTop: `1px solid ${"#1f1f1f"}`,
          borderBottom: `1px solid ${"#1f1f1f"}`,
          overflow: "hidden",
        }}
      >
        <Ticker frame={t} />
      </div>
    </div>
  );
};

const CandleChart: React.FC<{ candles: Candle[] }> = ({ candles }) => {
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  const yOf = (p: number) => ((max - p) / range) * 100;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ overflow: "visible" }}
    >
      {/* Grid lines */}
      {[20, 40, 60, 80].map((y) => (
        <line
          key={y}
          x1={0}
          x2={100}
          y1={y}
          y2={y}
          stroke="#1a1a1f"
          strokeWidth={0.1}
        />
      ))}
      {candles.map((c, i) => {
        const x = (i / candles.length) * 100;
        const w = (1 / candles.length) * 0.65 * 100;
        const cx = x + w / 2;
        const isUp = c.close >= c.open;
        const colorC = isUp ? "#3ddc84" : "#ff3b3b";
        const bodyTop = yOf(Math.max(c.open, c.close));
        const bodyH = Math.max(0.3, Math.abs(yOf(c.open) - yOf(c.close)));
        return (
          <g key={i}>
            <line
              x1={cx}
              x2={cx}
              y1={yOf(c.high)}
              y2={yOf(c.low)}
              stroke={colorC}
              strokeWidth={0.15}
            />
            <rect
              x={x}
              y={bodyTop}
              width={w}
              height={bodyH}
              fill={colorC}
              opacity={c.boom ? 1 : 0.85}
            />
          </g>
        );
      })}
    </svg>
  );
};

const OB_LEVELS = 7;

const OrderBook: React.FC<{ frame: number; centerPrice: number }> = ({
  frame,
  centerPrice,
}) => {
  // Generate bid/ask levels with sizes that animate.
  // The "spoof" — a giant fake bid that flashes in then vanishes.
  const spoofIn = toFrames(6.2) - toFrames(2.0); // local to right-panel time
  const spoofVisible = frame > spoofIn && frame < spoofIn + toFrames(0.7);
  const spoofLevel = 3; // index of bid that gets the giant flash

  const rows: { side: "ask" | "bid"; price: number; size: number; flash: boolean }[] = [];
  for (let i = OB_LEVELS - 1; i >= 0; i--) {
    const noise = pseudo(frame * 0.05 + i) * 0.6 + 0.4;
    rows.push({
      side: "ask",
      price: centerPrice + (i + 1) * 0.5,
      size: noise * 12 + 2,
      flash: false,
    });
  }
  for (let i = 0; i < OB_LEVELS; i++) {
    const noise = pseudo(frame * 0.05 + i + 100) * 0.6 + 0.4;
    let size = noise * 12 + 2;
    let flash = false;
    if (spoofVisible && i === spoofLevel) {
      size = 28;
      flash = true;
    }
    rows.push({
      side: "bid",
      price: centerPrice - (i + 1) * 0.5,
      size,
      flash,
    });
  }

  const maxSize = Math.max(...rows.map((r) => r.size));

  return (
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 22,
        color: "#7a7a7a",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 20,
          letterSpacing: "0.18em",
          color: "#7a7a7a",
          opacity: 0.6,
          marginBottom: 10,
        }}
      >
        ORDER BOOK
      </div>
      {rows.map((r, i) => {
        const widthPct = (r.size / maxSize) * 100;
        const color = r.side === "ask" ? "#ff3b3b" : "#3ddc84";
        return (
          <div
            key={i}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              padding: "3px 8px",
              fontVariantNumeric: "tabular-nums",
              backgroundColor: r.flash ? "rgba(255,59,59,0.16)" : "transparent",
              border: r.flash
                ? "1px solid rgba(255,59,59,0.6)"
                : "1px solid transparent",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: r.side === "ask" ? 0 : "auto",
                left: r.side === "bid" ? 0 : "auto",
                width: `${widthPct}%`,
                backgroundColor: color,
                opacity: r.flash ? 0.42 : 0.18,
              }}
            />
            <span style={{ position: "relative", flex: 1, color: "#f5f5f5" }}>
              {r.price.toFixed(2)}
            </span>
            <span style={{ position: "relative", color }}>
              {r.size.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const TICKER_ITEMS = [
  "ETH-PERP   3,847.12  +1.84%",
  "SOL-PERP   201.55   -2.10%",
  "BTC-PERP   61,247   +0.42%",
  "BLOCK 24,871,902   ◆ MEV $42,118",
  "AAPL  237.89  +0.71%",
  "NVDA  941.52  -1.04%",
  "FILL  61,250.00 × 0.84  BTC-PERP",
  "FILL  3,847.32 × 12.4   ETH-PERP",
];

const Ticker: React.FC<{ frame: number }> = ({ frame }) => {
  const text = TICKER_ITEMS.join("     ·     ");
  const offset = (frame * 6) % 4000;

  return (
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 30,
        color: "#7a7a7a",
        whiteSpace: "nowrap",
        position: "absolute",
        top: "50%",
        transform: `translate(${-offset}px, -50%)`,
        letterSpacing: "0.06em",
      }}
    >
      {text}
      <span style={{ paddingLeft: 80 }}>{text}</span>
    </div>
  );
};

// ─── Strip darkening — only the top + bottom edges, so the broll stays clean ──

const StripDarken: React.FC<{ tint?: string }> = ({ tint }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: tint
        ? `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 52%, rgba(10,10,10,0.78) 78%, rgba(10,10,10,0.94) 100%), linear-gradient(180deg, rgba(255,59,59,0.04), rgba(255,59,59,0.0))`
        : `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 52%, rgba(10,10,10,0.78) 78%, rgba(10,10,10,0.94) 100%)`,
    }}
  />
);

// ─── Text components (unchanged behaviour, slot label is now a prop) ───────────

const PanelLabel: React.FC<{
  eyebrow: string;
  showFrom: number;
  align: "left" | "right";
  frame: number;
  fps: number;
  tint?: string;
}> = ({ eyebrow, showFrom, align, frame, fps, tint }) => {
  const t = spring({
    frame: frame - showFrom,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const y = interpolate(t, [0, 1], [24, 0]);
  const opacity = interpolate(t, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: "12%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint ?? "#f5f5f5",
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
        }}
      >
        {eyebrow}
      </div>
    </div>
  );
};

const PairList: React.FC<{
  pairs: typeof PAIRS;
  field: "game" | "trade";
  align: "left" | "right";
  frames: readonly number[];
  frame: number;
  fps: number;
  tint?: string;
}> = ({ pairs, field, align, frames, frame, fps, tint }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "10%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        alignItems: align === "left" ? "flex-start" : "flex-end",
      }}
    >
      {pairs.map((pair, i) => {
        const at = frames[i] ?? frames[frames.length - 1];

        // Every pair enters from the centre, already in motion. The
        // horizontal split runs in parallel with the opacity ramp — by
        // the time the word is legible it is already moving outward,
        // never sitting static at the seam.
        const xT = spring({
          frame: frame - at,
          fps,
          config: { damping: 22, stiffness: 90, mass: 0.8 },
        });
        // Opacity is pulled forward against `xT` so the word becomes
        // visible after a few frames of inward motion — appears moving,
        // not appears then moves.
        const opacity = interpolate(xT, [0.05, 0.45], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        // Inboard start: the LEFT panel's word sits against its right
        // edge, the RIGHT panel's word sits against its left edge —
        // butted together at canvas centre. They split outward into
        // their final panel-aligned positions.
        const initialX = align === "left" ? 480 : -480;
        const x = interpolate(xT, [0, 1], [initialX, 0]);

        return (
          <div
            key={i}
            style={{
              transform: `translateX(${x}px)`,
              opacity,
              fontFamily: font,
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: tint ?? "#f5f5f5",
              textShadow:
                "0 2px 6px rgba(0,0,0,0.95), 0 6px 22px rgba(0,0,0,0.8), 0 12px 40px rgba(0,0,0,0.55)",
            }}
          >
            {pair[field]}
          </div>
        );
      })}
    </div>
  );
};

// Each line flies forward from depth — starts huge and motion-blurred,
// snaps to scale 1.0 with focus pull. The container shakes on landing,
// once for each line, so the second clause hits like a second punch.
const LINE1_LAND = 7;
const LINE2_START = 6;
const LINE2_LAND = LINE2_START + 7;
const SHAKE_FRAMES = 5;
const SHAKE_AMP = 9;

const RevealLines: React.FC = () => {
  const frame = useCurrentFrame();

  const shakeAt = (landFrame: number) => {
    const since = frame - landFrame;
    if (since < 0 || since >= SHAKE_FRAMES) return 0;
    return (1 - since / SHAKE_FRAMES) * SHAKE_AMP;
  };
  const amp = Math.max(shakeAt(LINE1_LAND), shakeAt(LINE2_LAND));
  const shakeX = amp ? (pseudo(frame * 7.31) - 0.5) * 2 * amp : 0;
  const shakeY = amp ? (pseudo(frame * 11.7 + 1) - 0.5) * 2 * amp : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(10,10,10,0.78)",
        backdropFilter: "blur(2px)",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontWeight: 700,
          fontSize: 84,
          letterSpacing: "-0.025em",
          textAlign: "center",
          color: "#f5f5f5",
          lineHeight: 1.15,
        }}
      >
        <DepthLine
          text="The same cheaters ruining your games"
          startAt={0}
          frame={frame}
        />
        <DepthLine
          text="are trading against you"
          startAt={LINE2_START}
          frame={frame}
          color="#ff3b3b"
          marginTop={16}
        />
      </div>
    </AbsoluteFill>
  );
};

const DepthLine: React.FC<{
  text: string;
  startAt: number;
  frame: number;
  color?: string;
  marginTop?: number;
}> = ({ text, startAt, frame, color, marginTop }) => {
  const t = frame - startAt;
  const scale = interpolate(t, [0, 7], [2.4, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blurPx = interpolate(t, [0, 7], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(t, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
        filter: blurPx > 0.05 ? `blur(${blurPx}px)` : "none",
        opacity,
        color: color ?? "#f5f5f5",
        marginTop: marginTop ?? 0,
      }}
    >
      {text}
    </div>
  );
};

// ─── Procedural candle generator ───────────────────────────────────────────────

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  boom?: boolean;
};

function pseudo(seed: number): number {
  // deterministic, 0..1, smooth-ish
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1 < 0
    ? ((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1
    : (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function generateCandles(
  timeFrame: number,
  count: number,
  manipAt: number,
): Candle[] {
  const candles: Candle[] = [];
  let price = 61_200;
  // Each frame, the chart drifts left; every ~3 frames we add a new candle's worth of motion.
  const tick = timeFrame * 0.06;
  for (let i = 0; i < count; i++) {
    const phase = i + tick;
    const drift = Math.sin(phase * 0.27) * 18 + Math.cos(phase * 0.61) * 12;
    const noise = (pseudo(phase * 1.7) - 0.5) * 22;
    const open = price;
    let close = price + drift + noise;
    let high = Math.max(open, close) + Math.abs(drift) * 0.4 + pseudo(phase * 3.1) * 6;
    let low = Math.min(open, close) - Math.abs(drift) * 0.4 - pseudo(phase * 5.7 + 1) * 6;
    let boom = false;
    // Manipulation candle — a single violent red bar near the right edge,
    // visible during the active "trading" reveal.
    const manipIdx = count - 6;
    if (i === manipIdx && timeFrame >= manipAt && timeFrame < manipAt + 36) {
      close = open - 220;
      high = open + 14;
      low = close - 24;
      boom = true;
    }
    candles.push({ open, high, low, close, boom });
    price = close;
  }
  return candles;
}

export const antiCheatHookMeta = {
  id: "AntiCheatHook",
  component: AntiCheatHook,
  durationInFrames: HOOK_DURATION,
  fps: FPS,
  width: W,
  height: H,
};
