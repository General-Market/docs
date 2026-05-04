import React from "react";
import {
  AbsoluteFill,
  Loop,
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
import { FPS, H, W, colors, toFrames } from "./theme";

const BROLL = {
  minecraft: staticFile("cheat-broll/minecraft-killaura.mp4"),
  cs2: staticFile("cheat-broll/cs2-spinbot.mp4"),
  valorant: staticFile("cheat-broll/valorant-wallhack.mp4"),
};

const PAIRS = [
  { game: "Spin-bots.", trade: "Insider traders.", broll: BROLL.cs2 },
  { game: "Wall-hackers.", trade: "Front-runners.", broll: BROLL.valorant },
  { game: "Kill aura.", trade: "Order-flow buyers.", broll: BROLL.minecraft },
] as const;

const HEADER_IN = toFrames(0.3);
const SPLIT_AT = toFrames(2.0);
const PAIRS_AT = toFrames(3.6);
const PAIR_STEP = toFrames(1.4);
const REVEAL_AT = toFrames(8.4);

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

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      {/* ── Left panel: PLAY — full width until the split, then half ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: `${splitOffset}px`,
          overflow: "hidden",
          borderRight: `1px solid ${colors.rule}`,
        }}
      >
        <CheaterBrollSequence />
        <StripDarken />
        <PanelLabel
          eyebrow="When you play"
          slot="01 / Game"
          showFrom={HEADER_IN}
          align="left"
          frame={frame}
          fps={fps}
        />
        <PairList
          pairs={PAIRS}
          field="game"
          align="left"
          startFrame={PAIRS_AT}
          stepFrame={PAIR_STEP}
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
          borderLeft: `1px solid ${colors.rule}`,
        }}
      >
        <TradingScreen frame={frame} showFrom={SPLIT_AT} />
        <StripDarken tint={colors.accent} />
        <PanelLabel
          eyebrow="When you trade"
          slot="02 / Market"
          showFrom={SPLIT_AT}
          align="right"
          frame={frame}
          fps={fps}
          tint={colors.accent}
        />
        <PairList
          pairs={PAIRS}
          field="trade"
          align="right"
          startFrame={PAIRS_AT}
          stepFrame={PAIR_STEP}
          frame={frame}
          fps={fps}
          tint={colors.accent}
        />
      </div>

      {/* ── Reveal lines ── */}
      <Sequence from={REVEAL_AT} layout="none">
        <RevealLines />
      </Sequence>

      {/* ── Vignette ── */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Left panel broll: a clean sequential timeline with crossfades ────────────
//
// 0.0–3.0s   minecraft-killaura
// 3.0–6.0s   cs2-spinbot
// 6.0–11.0s  valorant-wallhack
// 11.0–12.0s minecraft-killaura (looped, so it never freezes on the last frame)
//
// Total: 360 frames. The crossfade overlap is absorbed by the linearTiming
// duration, so no clip ever runs out of source material before its slot ends.

const FADE = toFrames(0.27); // 8 frames at 30fps

const CheaterBrollSequence: React.FC = () => {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={toFrames(3.0)}>
          <BrollClip src={BROLL.minecraft} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={toFrames(3.0)}>
          <BrollClip src={BROLL.cs2} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={toFrames(5.0)}>
          <BrollClip src={BROLL.valorant} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />

        {/* Tail: minecraft loops so the freeze-frame never appears.
            Sized so the total timeline (sum of seq durations minus the three
            8-frame transitions) lands exactly on the 360-frame composition. */}
        <TransitionSeries.Sequence durationInFrames={toFrames(1.8)}>
          <BrollClip src={BROLL.minecraft} loop />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

const BrollClip: React.FC<{ src: string; loop?: boolean }> = ({
  src,
  loop,
}) => {
  // OffthreadVideo has no native loop prop — wrap it in <Loop> when we
  // need the source to repeat past its own runtime. The minecraft tail
  // slot is shorter than the clip itself, so loop is a no-op safety net.
  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(1.05) contrast(1.05) brightness(0.95)",
  };

  const inner = (
    <OffthreadVideo
      src={src}
      muted
      playbackRate={1.0}
      style={videoStyle}
    />
  );

  if (loop) {
    // 90 frames = 3s, comfortably within every clip's source duration.
    return (
      <AbsoluteFill>
        <Loop durationInFrames={toFrames(3.0)}>{inner}</Loop>
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill>{inner}</AbsoluteFill>;
};

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
  const manipFrame = toFrames(5.4) - showFrom;

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
          color: colors.dim,
          fontSize: 22,
          letterSpacing: "0.06em",
          opacity: 0.85,
        }}
      >
        <span style={{ color: colors.fg, fontWeight: 600 }}>BTC-PERP</span>
        <span>{lastClose.toFixed(2)}</span>
        <span style={{ color: pct >= 0 ? "#3ddc84" : colors.accent }}>
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
          borderTop: `1px solid ${colors.rule}`,
          borderBottom: `1px solid ${colors.rule}`,
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
        const colorC = isUp ? "#3ddc84" : colors.accent;
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
        fontSize: 14,
        color: colors.dim,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 13,
          letterSpacing: "0.18em",
          color: colors.dim,
          opacity: 0.6,
          marginBottom: 8,
        }}
      >
        ORDER BOOK
      </div>
      {rows.map((r, i) => {
        const widthPct = (r.size / maxSize) * 100;
        const color = r.side === "ask" ? colors.accent : "#3ddc84";
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
            <span style={{ position: "relative", flex: 1, color: colors.fg }}>
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
        fontSize: 22,
        color: colors.dim,
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
        ? `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 64%, rgba(10,10,10,0.86) 100%), linear-gradient(180deg, rgba(255,59,59,0.04), rgba(255,59,59,0.0))`
        : `linear-gradient(180deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.0) 28%, rgba(10,10,10,0.0) 64%, rgba(10,10,10,0.86) 100%)`,
    }}
  />
);

// ─── Text components (unchanged behaviour, slot label is now a prop) ───────────

const PanelLabel: React.FC<{
  eyebrow: string;
  slot: string;
  showFrom: number;
  align: "left" | "right";
  frame: number;
  fps: number;
  tint?: string;
}> = ({ eyebrow, slot, showFrom, align, frame, fps, tint }) => {
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
          fontFamily: monoFont,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          marginBottom: 18,
        }}
      >
        {slot}
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint ?? colors.fg,
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
        }}
      >
        {eyebrow}
        <span style={{ color: tint ?? colors.fg, opacity: 0.45 }}>.</span>
      </div>
    </div>
  );
};

const PairList: React.FC<{
  pairs: typeof PAIRS;
  field: "game" | "trade";
  align: "left" | "right";
  startFrame: number;
  stepFrame: number;
  frame: number;
  fps: number;
  tint?: string;
}> = ({ pairs, field, align, startFrame, stepFrame, frame, fps, tint }) => {
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
        const at = startFrame + i * stepFrame;
        const t = spring({
          frame: frame - at,
          fps,
          config: { damping: 24, stiffness: 130, mass: 0.6 },
        });
        const x = interpolate(t, [0, 1], [align === "left" ? -40 : 40, 0]);
        const opacity = interpolate(t, [0, 1], [0, 1]);

        return (
          <div
            key={i}
            style={{
              transform: `translateX(${x}px)`,
              opacity,
              fontFamily: font,
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: tint ?? colors.fg,
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexDirection: align === "left" ? "row" : "row-reverse",
              textShadow: "0 2px 18px rgba(0,0,0,0.6)",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 500,
                color: colors.dim,
                opacity: 0.7,
                minWidth: 32,
              }}
            >
              0{i + 1}
            </span>
            <span>{pair[field]}</span>
          </div>
        );
      })}
    </div>
  );
};

const RevealLines: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t1 = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const t2 = spring({
    frame: frame - toFrames(0.7),
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(10,10,10,0.78)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontWeight: 700,
          fontSize: 84,
          letterSpacing: "-0.025em",
          textAlign: "center",
          color: colors.fg,
          lineHeight: 1.15,
        }}
      >
        <div
          style={{
            opacity: interpolate(t1, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(t1, [0, 1], [16, 0])}px)`,
          }}
        >
          The same cheaters ruining your games
        </div>
        <div
          style={{
            opacity: interpolate(t2, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(t2, [0, 1], [16, 0])}px)`,
            color: colors.accent,
            marginTop: 16,
          }}
        >
          are trading against you.
        </div>
      </div>
    </AbsoluteFill>
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
  durationInFrames: toFrames(12),
  fps: FPS,
  width: W,
  height: H,
};
