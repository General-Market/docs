import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";
import { noise2D } from "@remotion/noise";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Variant =
  | "particles"
  | "matrix"
  | "grid"
  | "waves"
  | "radial"
  | "trading"
  | "bokeh";

interface AnimatedBgProps {
  variant: Variant;
  accentColor?: string;
  opacity?: number;
}

// ---------------------------------------------------------------------------
// Helpers — deterministic pseudo-random from a seed
// ---------------------------------------------------------------------------

/** Simple seeded PRNG (mulberry32). Returns values in [0,1). */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pre-generate an array of N random floats in [0,1). */
function randArray(seed: number, n: number): number[] {
  const rng = seededRandom(seed);
  return Array.from({ length: n }, () => rng());
}

/** Hex color to rgba string. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 1080;
const H = 1920;

// ---------------------------------------------------------------------------
// Variant: Particles
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 25;

interface Particle {
  x: number; // base x [0..W]
  y: number; // start y [H..H+600] (begin off-screen bottom)
  r: number; // radius
  speed: number; // upward speed (px/frame)
  hueShift: number;
  alpha: number;
  noiseSeed: number;
}

function buildParticles(accent: string): Particle[] {
  const rng = seededRandom(42);
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    x: rng() * W,
    y: H + rng() * 600,
    r: 4 + rng() * 18,
    speed: 1.5 + rng() * 3,
    hueShift: (rng() - 0.5) * 40,
    alpha: 0.3 + rng() * 0.5,
    noiseSeed: i * 137,
  }));
}

const ParticlesBg: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const particles = React.useMemo(() => buildParticles(accent), [accent]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a12" }}>
      {particles.map((p, i) => {
        // noise-based horizontal sway
        const nx = noise2D("px" + i, frame * 0.012, p.noiseSeed * 0.01) * 60;
        // vertical drift — loop when particle exits top
        const rawY = p.y - p.speed * frame + nx * 0.3;
        const y = ((rawY % (H + 800)) + H + 800) % (H + 800) - 400;
        const x = p.x + nx;

        // subtle size pulse
        const pulse = 1 + 0.15 * Math.sin(frame * 0.06 + i);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - p.r * pulse,
              top: y - p.r * pulse,
              width: p.r * 2 * pulse,
              height: p.r * 2 * pulse,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${hexToRgba(accent, p.alpha)}, transparent 70%)`,
              filter: `hue-rotate(${p.hueShift}deg)`,
              pointerEvents: "none",
            }}
          />
        );
      })}
      {/* Large ambient glow */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 400,
          top: H / 2 - 400,
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexToRgba(accent, 0.08)}, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: Matrix
// ---------------------------------------------------------------------------

const MATRIX_COLS = 22;
const MATRIX_ROWS = 40;
const MATRIX_SYMBOLS = [
  "漫",
  "画",
  "予",
  "測",
  "¥",
  "$",
  "▲",
  "▼",
  "分",
  "析",
  "0",
  "1",
  "株",
  "金",
  "市",
  "場",
];

interface MatrixColumn {
  x: number;
  speed: number; // rows per frame
  chars: string[];
  offset: number; // starting row offset
  brightness: number;
}

function buildMatrixColumns(): MatrixColumn[] {
  const rng = seededRandom(77);
  const colWidth = W / MATRIX_COLS;
  return Array.from({ length: MATRIX_COLS }, (_, ci) => {
    const chars = Array.from(
      { length: MATRIX_ROWS },
      () => MATRIX_SYMBOLS[Math.floor(rng() * MATRIX_SYMBOLS.length)],
    );
    return {
      x: ci * colWidth + colWidth * 0.3,
      speed: 0.3 + rng() * 0.6,
      chars,
      offset: rng() * MATRIX_ROWS,
      brightness: 0.5 + rng() * 0.5,
    };
  });
}

const MatrixBg: React.FC = () => {
  const frame = useCurrentFrame();
  const columns = React.useMemo(() => buildMatrixColumns(), []);
  const rowH = H / MATRIX_ROWS;

  return (
    <AbsoluteFill style={{ backgroundColor: "#020c0a" }}>
      {columns.map((col, ci) => {
        const drift = (col.offset + frame * col.speed) % MATRIX_ROWS;
        return (
          <React.Fragment key={ci}>
            {col.chars.map((ch, ri) => {
              // distance from "head" determines brightness
              const dist = ((ri - drift + MATRIX_ROWS) % MATRIX_ROWS) / MATRIX_ROWS;
              const alpha = dist < 0.05 ? 1 : Math.max(0, 1 - dist * 1.8) * col.brightness;
              if (alpha < 0.02) return null;
              const isHead = dist < 0.05;
              return (
                <span
                  key={ri}
                  style={{
                    position: "absolute",
                    left: col.x,
                    top: ri * rowH,
                    fontSize: 28,
                    fontFamily: "monospace",
                    color: isHead ? "#aaffee" : "#00ff88",
                    opacity: alpha,
                    textShadow: isHead
                      ? "0 0 12px #00ffaa, 0 0 24px #00ff88"
                      : "0 0 6px #00aa66",
                    pointerEvents: "none",
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </React.Fragment>
        );
      })}
      {/* Scanline overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: Grid
// ---------------------------------------------------------------------------

const GRID_SPACING = 60;
const GRID_COLS_COUNT = Math.ceil(W / GRID_SPACING) + 1;
const GRID_ROWS_COUNT = Math.ceil(H / GRID_SPACING) + 1;

const GridBg: React.FC = () => {
  const frame = useCurrentFrame();
  useVideoConfig();

  // Pulse wave origin (center)
  const cx = W / 2;
  const cy = H / 2;
  // Pulse expands outward
  const pulseRadius = (frame * 4) % 1200;

  // Build grid dots
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < GRID_ROWS_COUNT; r++) {
    for (let c = 0; c < GRID_COLS_COUNT; c++) {
      const x = c * GRID_SPACING;
      const y = r * GRID_SPACING;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      // Proximity to pulse ring
      const ringDist = Math.abs(dist - pulseRadius);
      const glow = Math.max(0, 1 - ringDist / 120);
      const alpha = 0.08 + glow * 0.7;
      const size = 2 + glow * 4;
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={x}
          cy={y}
          r={size}
          fill={`rgba(0,200,255,${alpha})`}
        />,
      );
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#06080f" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Grid lines */}
        {Array.from({ length: GRID_COLS_COUNT }, (_, c) => (
          <line
            key={`vc-${c}`}
            x1={c * GRID_SPACING}
            y1={0}
            x2={c * GRID_SPACING}
            y2={H}
            stroke="rgba(0,180,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: GRID_ROWS_COUNT }, (_, r) => (
          <line
            key={`hr-${r}`}
            x1={0}
            y1={r * GRID_SPACING}
            x2={W}
            y2={r * GRID_SPACING}
            stroke="rgba(0,180,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {/* Pulse ring */}
        <circle
          cx={cx}
          cy={cy}
          r={pulseRadius}
          fill="none"
          stroke="rgba(0,200,255,0.12)"
          strokeWidth={2}
        />
        {/* Dots */}
        {dots}
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: Waves
// ---------------------------------------------------------------------------

const WAVE_COUNT = 5;
const WAVE_POINTS = 120;

const WavesBg: React.FC = () => {
  const frame = useCurrentFrame();
  const rs = randArray(55, WAVE_COUNT * 4);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0a06" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {Array.from({ length: WAVE_COUNT }, (_, wi) => {
          const baseY = H * 0.3 + wi * 120;
          const amplitude = 30 + rs[wi] * 50;
          const freq = 0.005 + rs[wi + WAVE_COUNT] * 0.008;
          const speed = 0.03 + rs[wi + WAVE_COUNT * 2] * 0.04;
          const phase = rs[wi + WAVE_COUNT * 3] * Math.PI * 2;
          const alpha = 0.15 + (1 - wi / WAVE_COUNT) * 0.35;

          const points: string[] = [];
          for (let p = 0; p <= WAVE_POINTS; p++) {
            const x = (p / WAVE_POINTS) * W;
            const y =
              baseY +
              Math.sin(x * freq + frame * speed + phase) * amplitude +
              Math.sin(x * freq * 2.3 + frame * speed * 0.7 + phase + 1.2) *
                amplitude *
                0.4;
            points.push(`${x},${y}`);
          }
          // Close path at bottom
          const d = `M${points[0]} ${points.map((pt) => `L${pt}`).join(" ")} L${W},${H} L0,${H} Z`;

          return (
            <path
              key={wi}
              d={d}
              fill={`rgba(255,200,50,${alpha * 0.25})`}
              stroke={`rgba(255,200,50,${alpha})`}
              strokeWidth={1.5}
            />
          );
        })}
        {/* Horizontal guide lines for "data" feel */}
        {Array.from({ length: 8 }, (_, i) => {
          const y = H * 0.15 + i * (H * 0.1);
          return (
            <line
              key={`guide-${i}`}
              x1={0}
              y1={y}
              x2={W}
              y2={y}
              stroke="rgba(255,200,50,0.04)"
              strokeWidth={1}
              strokeDasharray="8 12"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: Radial
// ---------------------------------------------------------------------------

const RadialBg: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulsing core
  const pulse = spring({ frame, fps, config: { damping: 8, mass: 0.6 }, durationInFrames: 60 });
  const breathe = 0.85 + 0.15 * Math.sin(frame * 0.04);
  const coreScale = 0.8 + pulse * 0.2 * breathe;

  // Halo rotation
  const rotation = frame * 0.8;

  return (
    <AbsoluteFill style={{ backgroundColor: "#08060e" }}>
      {/* Radial gradient pulse */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 600,
          top: H / 2 - 600,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexToRgba(accent, 0.3 * breathe)} 0%, ${hexToRgba(accent, 0.08)} 40%, transparent 70%)`,
          transform: `scale(${coreScale})`,
        }}
      />
      {/* Rotating halo ring */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="haloGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accent} stopOpacity={0.6} />
            <stop offset="50%" stopColor={accent} stopOpacity={0} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <g transform={`rotate(${rotation}, ${W / 2}, ${H / 2})`}>
          <ellipse
            cx={W / 2}
            cy={H / 2}
            rx={380}
            ry={380}
            fill="none"
            stroke="url(#haloGrad)"
            strokeWidth={2.5}
          />
          <ellipse
            cx={W / 2}
            cy={H / 2}
            rx={420}
            ry={420}
            fill="none"
            stroke={hexToRgba(accent, 0.08)}
            strokeWidth={1}
          />
        </g>
      </svg>
      {/* Ambient rays */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * 360 + rotation * 0.3;
        const len = 500 + 100 * Math.sin(frame * 0.03 + i);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: W / 2,
              top: H / 2,
              width: 2,
              height: len,
              background: `linear-gradient(to bottom, ${hexToRgba(accent, 0.15)}, transparent)`,
              transformOrigin: "0 0",
              transform: `rotate(${angle}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: Trading
// ---------------------------------------------------------------------------

const CANDLE_COUNT = 40;
const CHART_LEFT = 40;
const CHART_RIGHT = W - 40;
const CHART_TOP = H * 0.15;
const CHART_BOTTOM = H * 0.85;

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
}

/** Generate a parabolic UP-ONLY price path with increasing volatility. */
function buildCandles(): Candle[] {
  const rng = seededRandom(999);
  const candles: Candle[] = [];

  for (let i = 0; i < CANDLE_COUNT; i++) {
    const t = i / CANDLE_COUNT; // 0..1 progress
    // Parabolic base price: starts ~50, ends ~200
    const basePrice = 50 + t * t * 150;
    // Small noise that increases with progress for realism
    const noiseAmp = 1 + t * 4;
    const openNoise = (rng() - 0.4) * noiseAmp; // slight upward bias
    const closeNoise = (rng() - 0.3) * noiseAmp; // stronger upward bias

    const open = basePrice + openNoise;
    const close = basePrice + closeNoise + noiseAmp * 0.5; // close always biased above open
    // Ensure close >= open so all candles are green (bullish)
    const finalOpen = Math.min(open, close);
    const finalClose = Math.max(open, close);
    // Wicks — small below, larger above as momentum increases
    const wickUp = rng() * (2 + t * 6);
    const wickDown = rng() * (1 + t * 2);

    candles.push({
      open: finalOpen,
      close: finalClose,
      high: finalClose + wickUp,
      low: finalOpen - wickDown,
    });
  }
  return candles;
}

function priceToY(price: number, minP: number, maxP: number): number {
  return interpolate(price, [minP, maxP], [CHART_BOTTOM, CHART_TOP]);
}

const TradingBg: React.FC = () => {
  const frame = useCurrentFrame();
  const candles = React.useMemo(() => buildCandles(), []);

  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...allPrices) - 5;
  const maxP = Math.max(...allPrices) + 5;

  const candleW = (CHART_RIGHT - CHART_LEFT) / CANDLE_COUNT;

  // Animate how many candles are visible (draw-in effect)
  const visibleCount = interpolate(frame, [0, 60], [0, CANDLE_COUNT], {
    extrapolateRight: "clamp",
  });

  // Trembling / shake that increases over time (driven by visible candles)
  const progress = Math.min(visibleCount / CANDLE_COUNT, 1);
  const trembleIntensity = progress * progress * 8; // 0 to 8px max shake
  const shakeX =
    noise2D("shakeX", frame * 0.15, 0) * trembleIntensity;
  const shakeY =
    noise2D("shakeY", 0, frame * 0.15) * trembleIntensity;

  // Line chart path (close prices)
  const linePts = candles
    .slice(0, Math.ceil(visibleCount))
    .map((c, i) => {
      const x = CHART_LEFT + i * candleW + candleW / 2;
      const y = priceToY(c.close, minP, maxP);
      return `${x},${y}`;
    });
  const linePath = linePts.length > 1 ? `M${linePts.join(" L")}` : "";

  // "LIVE" indicator pulse
  const livePulse = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.1));

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0c10" }}>
      {/* LIVE indicator */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 10,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: `rgba(255,50,50,${livePulse})`,
            boxShadow: `0 0 ${8 + livePulse * 12}px rgba(255,50,50,${livePulse * 0.8})`,
          }}
        />
        <span
          style={{
            color: `rgba(255,255,255,${0.6 + livePulse * 0.4})`,
            fontSize: 26,
            fontFamily: "monospace",
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          LIVE
        </span>
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          transform: `translate(${shakeX}px, ${shakeY}px)`,
        }}
      >
        {/* Glow filter for latest candle */}
        <defs>
          <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="lineGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Horizontal price levels */}
        {Array.from({ length: 8 }, (_, i) => {
          const p = minP + ((maxP - minP) * i) / 7;
          const y = priceToY(p, minP, maxP);
          return (
            <line
              key={`pl-${i}`}
              x1={CHART_LEFT}
              y1={y}
              x2={CHART_RIGHT}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
              strokeDasharray="6 8"
            />
          );
        })}
        {/* Candlesticks — all green */}
        {candles.slice(0, Math.floor(visibleCount)).map((c, i) => {
          const x = CHART_LEFT + i * candleW + candleW / 2;
          const isLast = i === Math.floor(visibleCount) - 1;
          const color = "#00e676";
          const bodyTop = priceToY(c.close, minP, maxP); // close is higher
          const bodyBot = priceToY(c.open, minP, maxP); // open is lower
          const wickTop = priceToY(c.high, minP, maxP);
          const wickBot = priceToY(c.low, minP, maxP);
          const bodyH = Math.max(2, bodyBot - bodyTop);
          // Candles get brighter toward the end
          const brightness = 0.5 + (i / CANDLE_COUNT) * 0.5;
          return (
            <g
              key={i}
              opacity={brightness}
              filter={isLast ? "url(#greenGlow)" : undefined}
            >
              {/* Wick */}
              <line
                x1={x}
                y1={wickTop}
                x2={x}
                y2={wickBot}
                stroke={color}
                strokeWidth={isLast ? 2.5 : 1.5}
              />
              {/* Body */}
              <rect
                x={x - candleW * 0.3}
                y={bodyTop}
                width={candleW * 0.6}
                height={bodyH}
                fill={color}
                rx={1}
              />
            </g>
          );
        })}
        {/* Line overlay — brighter & thicker with glow */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="rgba(100,255,180,0.7)"
            strokeWidth={3.5}
            strokeLinejoin="round"
            filter="url(#lineGlow)"
          />
        )}
        {/* Gradient fill under the line */}
        {linePts.length > 1 && (
          <>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e676" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#00e676" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <path
              d={`${linePath} L${linePts[linePts.length - 1].split(",")[0]},${CHART_BOTTOM} L${linePts[0].split(",")[0]},${CHART_BOTTOM} Z`}
              fill="url(#areaFill)"
            />
          </>
        )}
        {/* Current price marker with green glow */}
        {Math.floor(visibleCount) > 0 && (() => {
          const lastCandle = candles[Math.floor(visibleCount) - 1];
          const y = priceToY(lastCandle.close, minP, maxP);
          const x = CHART_LEFT + (Math.floor(visibleCount) - 1) * candleW + candleW / 2;
          const blink = 0.5 + 0.5 * Math.sin(frame * 0.15);
          return (
            <>
              {/* Glow behind marker */}
              <circle
                cx={x}
                cy={y}
                r={18}
                fill={`rgba(0,230,118,${blink * 0.25})`}
              />
              <circle
                cx={x}
                cy={y}
                r={6}
                fill={`rgba(0,230,118,${blink})`}
                filter="url(#greenGlow)"
              />
              <line
                x1={x}
                y1={y}
                x2={CHART_RIGHT}
                y2={y}
                stroke={`rgba(0,230,118,${blink * 0.5})`}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            </>
          );
        })()}
      </svg>
      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: Bokeh
// ---------------------------------------------------------------------------

const BOKEH_COUNT = 18;

interface BokehCircle {
  x: number;
  y: number;
  r: number;
  hue: number; // degrees — warm range
  speed: number;
  alpha: number;
  noiseSeed: number;
}

function buildBokeh(): BokehCircle[] {
  const rng = seededRandom(123);
  return Array.from({ length: BOKEH_COUNT }, (_, i) => ({
    x: rng() * W,
    y: rng() * H,
    r: 30 + rng() * 100,
    hue: 15 + rng() * 40, // warm orange-gold range
    speed: 0.2 + rng() * 0.5,
    alpha: 0.06 + rng() * 0.14,
    noiseSeed: i * 73,
  }));
}

const BokehBg: React.FC = () => {
  const frame = useCurrentFrame();
  const circles = React.useMemo(() => buildBokeh(), []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0e0a08" }}>
      {circles.map((b, i) => {
        const dx = noise2D("bx" + i, frame * 0.006, b.noiseSeed * 0.01) * 80;
        const dy = noise2D("by" + i, frame * 0.006, b.noiseSeed * 0.02) * 80;
        const x = b.x + dx;
        const y = b.y + dy + Math.sin(frame * 0.02 + i) * 20;
        const pulse = 1 + 0.1 * Math.sin(frame * 0.04 + i * 1.5);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - b.r * pulse,
              top: y - b.r * pulse,
              width: b.r * 2 * pulse,
              height: b.r * 2 * pulse,
              borderRadius: "50%",
              background: `radial-gradient(circle, hsla(${b.hue},80%,60%,${b.alpha}) 0%, hsla(${b.hue},80%,50%,${b.alpha * 0.3}) 50%, transparent 70%)`,
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
        );
      })}
      {/* Warm ambient glow center-bottom */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 500,
          top: H * 0.55,
          width: 1000,
          height: 1000,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,160,60,0.06), transparent 60%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export const AnimatedBg: React.FC<AnimatedBgProps> = ({
  variant,
  accentColor = "#8b5cf6",
  opacity = 1,
}) => {
  let content: React.ReactNode;

  switch (variant) {
    case "particles":
      content = <ParticlesBg accent={accentColor} />;
      break;
    case "matrix":
      content = <MatrixBg />;
      break;
    case "grid":
      content = <GridBg />;
      break;
    case "waves":
      content = <WavesBg />;
      break;
    case "radial":
      content = <RadialBg accent={accentColor} />;
      break;
    case "trading":
      content = <TradingBg />;
      break;
    case "bokeh":
      content = <BokehBg />;
      break;
    default:
      content = <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }} />;
  }

  return <AbsoluteFill style={{ opacity }}>{content}</AbsoluteFill>;
};
