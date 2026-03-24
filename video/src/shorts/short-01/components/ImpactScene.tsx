import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
} from "remotion";
import { noise2D } from "@remotion/noise";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImpactVariant = "forty-million" | "visits" | "billion-rain" | "zero-crack";

interface Props {
  variant: ImpactVariant;
  hideCounter?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const fontFamily = "'Switzer', 'Inter', sans-serif";

const MONEY_YELLOW = "#FFE500";
const GROWTH_GREEN = "#00FF88";
const PAIN_RED = "#FF3333";
const GOLD = "#FFD700";

// Auto-size font to fit within maxTextWidth (typically W - padding)
const autoFontSize = (
  text: string,
  maxSize: number,
  maxTextWidth: number,
  charWidthRatio = 0.62,
  extraSpacingPerChar = 0,
): number => {
  const totalWidth =
    text.length * maxSize * charWidthRatio +
    (text.length - 1) * extraSpacingPerChar;
  if (totalWidth <= maxTextWidth) return maxSize;
  return Math.floor(
    maxTextWidth / (text.length * charWidthRatio + ((text.length - 1) * extraSpacingPerChar) / maxSize),
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded PRNG (mulberry32). Returns values in [0,1). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hex color to rgba string. */
function hexRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Format a number with commas: 40000000 -> "40,000,000" */
function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Variant 1: "forty-million" — Counter 0->40M + page cascade/waterfall
// ---------------------------------------------------------------------------

interface CascadePage {
  /** Horizontal position across the screen (0..W) */
  x: number;
  /** Starting Y above the viewport (negative) — each page "falls" from here */
  startY: number;
  /** Fall speed in px/frame */
  speed: number;
  /** Base width of the page rectangle */
  w: number;
  /** Base height of the page rectangle */
  h: number;
  /** Rotation in degrees */
  rotDeg: number;
  /** Opacity (0.6 – 1.0) */
  opacity: number;
  /** Depth layer 0-1 (0 = far back, 1 = front). Controls size & opacity scaling */
  depth: number;
  /** Horizontal sway amplitude */
  swayAmp: number;
  /** Phase offset for sway animation */
  swayPhase: number;
  /** Frame at which this page first becomes visible (exponential reveal) */
  revealFrame: number;
}

/**
 * Build cascade pages. The distribution is hyper-exponential — almost nothing
 * at first, then a sudden overwhelming FLOOD of pages that fills the screen.
 * Pages start tiny (far away) and get exponentially bigger as the cascade
 * progresses, creating a "camera pulling back" effect.
 */
function buildCascadePages(count: number, W: number, H: number): CascadePage[] {
  const rng = mulberry32(314159);
  const pages: CascadePage[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / count; // 0..1 normalised index

    // Hyper-exponential reveal: almost NO pages in frames 0-20,
    // then a WALL of pages floods in frames 25-40.
    // Using t^0.25 makes the curve extremely steep at the end.
    const revealFrame = Math.floor(24 * Math.pow(t, 0.35));

    // Depth: random, but bias later pages strongly toward the front
    const depth = Math.min(1, Math.max(0, rng() * 0.4 + t * 0.6));

    // Exponential size scaling: early pages are tiny (far away),
    // later pages are HUGE (rushing toward camera).
    // Size multiplier goes from 0.2x to 2.5x based on index
    const sizeExponent = 0.2 + Math.pow(t, 1.8) * 2.3;

    // Scale by depth: back pages smaller, front pages oversized
    const depthScale = (0.3 + depth * 0.7) * sizeExponent;

    pages.push({
      x: rng() * W,
      startY: -(rng() * H * 0.8 + 150), // above viewport, spread more
      speed: 5 + rng() * 8 + depth * 10 + t * 8, // later pages fall much faster
      w: 40 * depthScale,
      h: 55 * depthScale,
      rotDeg: (rng() - 0.5) * 40, // wider rotation range
      opacity: 0.5 + depth * 0.5, // back=0.5, front=1.0
      depth,
      swayAmp: 8 + rng() * 25,
      swayPhase: rng() * Math.PI * 2,
      revealFrame,
    });
  }

  return pages;
}

const FortyMillionScene: React.FC<{ hideCounter?: boolean }> = ({ hideCounter = false }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();

  const MAX_TEXT_WIDTH = W - 140;
  const counterEndFrame = 26;
  const impactFrame = 27;

  // Counter: 0 -> 40,000,000 with ease-in-quartic acceleration (steeper than cubic)
  const counterProgress = interpolate(frame, [0, counterEndFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased =
    counterProgress * counterProgress * counterProgress * counterProgress;
  const counterValue = Math.floor(eased * 40_000_000);

  // Build 600 cascade pages (deterministic, memoised) — 3x the original
  const pages = useMemo(() => buildCascadePages(600, W, H), [W, H]);

  // Speed lines data (deterministic, memoised)
  const speedLines = useMemo(() => {
    const rng = mulberry32(271828);
    return Array.from({ length: 40 }, () => ({
      x: rng() * W,
      width: 1 + rng() * 3,
      opacity: 0.15 + rng() * 0.35,
      speed: 20 + rng() * 40,
      startY: -(rng() * H * 0.5),
      length: H * 0.3 + rng() * H * 0.7,
    }));
  }, [W, H]);

  // Impact flash when hitting 40M — BIGGER and BRIGHTER
  const flashOpacity =
    frame >= impactFrame
      ? interpolate(
          frame,
          [impactFrame, impactFrame + 1, impactFrame + 3, impactFrame + 10],
          [1.0, 0.95, 0.6, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;

  // Secondary warm flash that lingers
  const warmFlashOpacity =
    frame >= impactFrame
      ? interpolate(
          frame,
          [impactFrame, impactFrame + 2, impactFrame + 14],
          [0.5, 0.3, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;

  // Screen shake after impact — MUCH more intense, longer duration
  const shakeDecay =
    frame >= impactFrame && frame < impactFrame + 10
      ? interpolate(frame, [impactFrame, impactFrame + 10], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const shakeX =
    shakeDecay > 0 ? noise2D("sx", frame * 3.5, 42) * 28 * shakeDecay : 0;
  const shakeY =
    shakeDecay > 0 ? noise2D("sy", frame * 3.5, 77) * 24 * shakeDecay : 0;

  // Counter scale slam on impact — bigger overshoot
  const counterScale =
    frame >= impactFrame
      ? 1 +
        (1 -
          spring({
            frame: frame - impactFrame,
            fps,
            config: { damping: 6, stiffness: 350, mass: 0.4 },
            durationInFrames: 14,
          })) *
          0.7
      : 1;

  // Glow intensity: subtle before impact, INTENSE after
  const glowPulse =
    frame >= impactFrame
      ? 50 + Math.sin((frame - impactFrame) * 0.3) * 20
      : 8;

  // "Zoom out" effect: the whole cascade layer scales DOWN over time,
  // making it feel like the camera is pulling back to reveal MORE pages.
  const cascadeZoom = interpolate(frame, [0, 8, 26], [1.4, 1.15, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Speed lines / motion blur intensity during peak cascade
  const speedLineIntensity = interpolate(frame, [12, 20, 26, 42], [0, 0.6, 1, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${shakeX}px, ${shakeY}px)`,
        overflow: "hidden",
      }}
    >
      {/* ---- Page cascade / waterfall with zoom-out effect ---- */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transform: `scale(${cascadeZoom})`,
          transformOrigin: "50% 50%",
          overflow: "visible",
        }}
      >
        {pages.map((page, i) => {
          // Don't render until this page's reveal frame
          if (frame < page.revealFrame) return null;

          const elapsed = frame - page.revealFrame;

          // Y position: falls from startY downward
          const rawY = page.startY + page.speed * elapsed;
          // Wrap around so pages recycle once they fall off-screen
          const wrappedY =
            ((rawY % (H * 1.6)) + H * 1.6) % (H * 1.6) - H * 0.3;

          // Horizontal sway (reduced for larger pages to feel heavier)
          const swayScale = Math.max(0.3, 1 - page.w / 120);
          const swayX =
            page.x +
            Math.sin(frame * 0.03 + page.swayPhase) * page.swayAmp * swayScale;

          // Fade-in over the first 3 frames of this page's life (faster)
          const fadeIn = interpolate(elapsed, [0, 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const finalOpacity = page.opacity * fadeIn;

          // Motion blur on larger, faster pages during peak
          const isLargeFast = page.w > 60 && page.speed > 15;
          const motionBlur =
            isLargeFast && speedLineIntensity > 0.3
              ? `blur(${(speedLineIntensity - 0.3) * 2}px)`
              : undefined;

          return (
            <div
              key={`cascade-${i}`}
              style={{
                position: "absolute",
                left: swayX - page.w / 2,
                top: wrappedY - page.h / 2,
                width: page.w,
                height: page.h,
                backgroundColor: `rgba(255,255,255,${finalOpacity})`,
                borderRadius: Math.min(3, page.w * 0.04),
                transform: `rotate(${page.rotDeg}deg)`,
                boxShadow:
                  page.w > 50
                    ? `0 4px 12px rgba(0,0,0,${0.2 + page.depth * 0.25})`
                    : `0 2px 6px rgba(0,0,0,${0.15 + page.depth * 0.2})`,
                pointerEvents: "none",
                zIndex: Math.floor(page.depth * 8),
                overflow: "hidden",
                filter: motionBlur,
              }}
            >
              {/* Faint "text lines" inside the page for realism (skip for tiny pages) */}
              {page.w > 20 && (
                <div
                  style={{
                    position: "absolute",
                    top: "18%",
                    left: "12%",
                    right: "12%",
                    bottom: "18%",
                    display: "flex",
                    flexDirection: "column",
                    gap: page.h * 0.06,
                  }}
                >
                  {[0.8, 0.6, 0.9, 0.5, 0.7].map((widthFrac, li) => (
                    <div
                      key={li}
                      style={{
                        height: Math.max(1, 1.5 * (0.5 + page.depth * 0.5)),
                        width: `${widthFrac * 100}%`,
                        backgroundColor: `rgba(180,180,180,${0.25 + page.depth * 0.35})`,
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Speed lines during peak cascade ---- */}
      {speedLineIntensity > 0.05 &&
        speedLines.map((line, i) => {
          const lineY = line.startY + line.speed * frame;
          const wrappedLineY =
            ((lineY % (H * 1.5)) + H * 1.5) % (H * 1.5) - H * 0.25;
          return (
            <div
              key={`speed-${i}`}
              style={{
                position: "absolute",
                left: line.x,
                top: wrappedLineY,
                width: line.width,
                height: line.length * speedLineIntensity,
                background: `linear-gradient(to bottom, transparent, rgba(255,255,255,${line.opacity * speedLineIntensity}), transparent)`,
                pointerEvents: "none",
                zIndex: 9,
              }}
            />
          );
        })}

      {/* ---- Counter number (ON TOP of cascade) — hidden when DataCallout handles text ---- */}
      {!hideCounter && (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontFamily,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            color: MONEY_YELLOW,
            fontSize: autoFontSize(formatNumber(counterValue), 240, MAX_TEXT_WIDTH, 0.62, -4),
            fontWeight: 900,
            letterSpacing: -4,
            lineHeight: 1,
            transform: `scale(${counterScale})`,
            textShadow: [
              `0 0 ${glowPulse}px ${hexRgba(MONEY_YELLOW, 0.9)}`,
              `0 0 ${glowPulse * 2}px ${hexRgba(MONEY_YELLOW, 0.6)}`,
              `0 0 ${glowPulse * 4}px ${hexRgba(MONEY_YELLOW, 0.3)}`,
              `0 0 ${glowPulse * 6}px ${hexRgba(MONEY_YELLOW, 0.15)}`,
              `0 6px 30px rgba(0,0,0,0.7)`,
            ].join(", "),
            textAlign: "center",
          }}
        >
          {formatNumber(counterValue)}
        </span>

        {/* Label beneath the counter */}
        <span
          style={{
            marginTop: 16,
            color: hexRgba(MONEY_YELLOW, 0.8),
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: 10,
            textTransform: "uppercase",
            textShadow: `0 2px 12px rgba(0,0,0,0.6)`,
          }}
        >
          pages
        </span>
      </div>
      )}

      {/* ---- Impact flash overlay — BIGGER, BRIGHTER, full-screen ---- */}
      {flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%, ${hexRgba("#FFFFFF", flashOpacity * 0.8)} 0%, ${hexRgba(MONEY_YELLOW, flashOpacity)} 20%, ${hexRgba(MONEY_YELLOW, flashOpacity * 0.5)} 50%, transparent 80%)`,
            pointerEvents: "none",
            zIndex: 30,
          }}
        />
      )}

      {/* ---- Secondary warm afterglow ---- */}
      {warmFlashOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%, ${hexRgba(MONEY_YELLOW, warmFlashOpacity * 0.4)} 0%, transparent 60%)`,
            pointerEvents: "none",
            zIndex: 29,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant 2: "visits" — Globe web + counter 0->781M + ripple
// ---------------------------------------------------------------------------

interface ConnectionNode {
  x: number;
  y: number;
  r: number;
  phase: number;
}

interface ConnectionEdge {
  from: number;
  to: number;
  delay: number;
}

function buildWebNetwork(nodeCount: number, W: number, H: number): {
  nodes: ConnectionNode[];
  edges: ConnectionEdge[];
} {
  const rng = mulberry32(617);
  const cx = W / 2;
  const cy = H * 0.48;
  const nodes: ConnectionNode[] = [];

  // Central node
  nodes.push({ x: cx, y: cy, r: 8, phase: 0 });

  // Concentric rings of nodes
  const rings = [
    { count: 6, radius: 100 },
    { count: 10, radius: 220 },
    { count: 14, radius: 360 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count && nodes.length < nodeCount; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + rng() * 0.4;
      const dist = ring.radius + (rng() - 0.5) * 40;
      nodes.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        r: 3 + rng() * 5,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  // Edges: connect to nearby nodes
  const edges: ConnectionEdge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    // Connect to center or a close inner node
    const targetIdx = i <= 6 ? 0 : Math.floor(rng() * Math.min(i, 7));
    edges.push({ from: targetIdx, to: i, delay: i * 1.2 });
    // Extra cross-connections
    if (rng() > 0.5 && i > 3) {
      const otherIdx = Math.max(1, Math.floor(rng() * i));
      if (otherIdx !== i) {
        edges.push({ from: otherIdx, to: i, delay: i * 1.2 + 3 });
      }
    }
  }

  return { nodes, edges };
}

const VisitsScene: React.FC<{ hideCounter?: boolean }> = ({ hideCounter = false }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();

  const MAX_TEXT_WIDTH = W - 140;
  const counterEndFrame = 38;

  // Counter: 0 -> 781,000,000
  const counterProgress = interpolate(frame, [0, counterEndFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = counterProgress * counterProgress * counterProgress;
  const counterValue = Math.floor(eased * 781_000_000);

  // Network expansion
  const { nodes, edges } = useMemo(() => buildWebNetwork(31, W, H), [W, H]);

  const expansionProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ripple pulse when number lands
  const landingFrame = counterEndFrame + 1;
  const rippleActive = frame >= landingFrame;
  const rippleFrame = rippleActive ? frame - landingFrame : 0;

  // Multiple ripple rings expanding outward
  const rippleCount = 3;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Network web */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      >
        <defs>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const edgeProgress = interpolate(
            expansionProgress,
            [edge.delay / 40, Math.min(1, edge.delay / 40 + 0.3)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          if (edgeProgress <= 0) return null;
          const from = nodes[edge.from];
          const to = nodes[edge.to];
          const midX = from.x + (to.x - from.x) * edgeProgress;
          const midY = from.y + (to.y - from.y) * edgeProgress;
          return (
            <line
              key={`edge-${i}`}
              x1={from.x}
              y1={from.y}
              x2={midX}
              y2={midY}
              stroke={hexRgba(GROWTH_GREEN, 0.25 * edgeProgress)}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const nodeDelay = i * 0.03;
          const nodeProgress = interpolate(
            expansionProgress,
            [nodeDelay, Math.min(1, nodeDelay + 0.2)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          if (nodeProgress <= 0) return null;
          const pulse = 1 + 0.2 * Math.sin(frame * 0.08 + node.phase);
          return (
            <g key={`node-${i}`}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r * pulse * nodeProgress}
                fill={hexRgba(GROWTH_GREEN, 0.15)}
                filter="url(#node-glow)"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r * 0.6 * pulse * nodeProgress}
                fill={hexRgba(GROWTH_GREEN, 0.7 * nodeProgress)}
              />
            </g>
          );
        })}

        {/* Ripple rings */}
        {rippleActive &&
          Array.from({ length: rippleCount }, (_, ri) => {
            const ringDelay = ri * 4;
            const rf = rippleFrame - ringDelay;
            if (rf < 0) return null;
            const radius = interpolate(rf, [0, 20], [0, 450 + ri * 80], {
              extrapolateRight: "clamp",
            });
            const ringOpacity = interpolate(rf, [0, 3, 20], [0, 0.5, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <circle
                key={`ripple-${ri}`}
                cx={W / 2}
                cy={H * 0.48}
                r={radius}
                fill="none"
                stroke={hexRgba(GROWTH_GREEN, ringOpacity)}
                strokeWidth={2.5 - ri * 0.5}
              />
            );
          })}
      </svg>

      {/* Counter — hidden when DataCallout handles text */}
      {!hideCounter && (
      <>
      <div
        style={{
          position: "absolute",
          top: H * 0.36,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily,
          zIndex: 10,
        }}
      >
        <span
          style={{
            color: GROWTH_GREEN,
            fontSize: autoFontSize(formatNumber(counterValue), 82, MAX_TEXT_WIDTH, 0.62, 2),
            fontWeight: 900,
            letterSpacing: 2,
            textShadow: `0 0 16px ${hexRgba(GROWTH_GREEN, 0.6)}, 0 0 32px ${hexRgba(GROWTH_GREEN, 0.3)}`,
            textAlign: "center",
          }}
        >
          {formatNumber(counterValue)}
        </span>
      </div>

      {/* Label */}
      <div
        style={{
          position: "absolute",
          top: H * 0.42,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          fontFamily,
          zIndex: 10,
        }}
      >
        <span
          style={{
            color: hexRgba(GROWTH_GREEN, 0.7),
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          visits / month
        </span>
      </div>
      </>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant 3: "billion-rain" — Ascending stock chart with increasing trembling
// ---------------------------------------------------------------------------

/** Build chart points: exponential curve from bottom-left to top-right. */
function buildChartPoints(count: number, W: number, H: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const chartLeft = 80;
  const chartRight = W - 80;
  const chartTop = H * 0.15;
  const chartBottom = H * 0.78;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = chartLeft + t * chartW;
    // Exponential curve: t^2.8 gives aggressive upward acceleration
    const normalizedY = Math.pow(t, 2.8);
    // Invert Y because screen coords go downward
    const y = chartBottom - normalizedY * chartH;
    points.push({ x, y });
  }
  return points;
}

/** Build candle bar positions along the chart path. */
interface CandleBar {
  x: number;
  openY: number;
  closeY: number;
  highY: number;
  lowY: number;
  revealT: number; // 0..1 when this candle should appear
}

function buildCandleBars(
  chartPoints: { x: number; y: number }[],
  count: number,
): CandleBar[] {
  const rng = mulberry32(777);
  const bars: CandleBar[] = [];
  const step = Math.floor(chartPoints.length / (count + 1));

  for (let i = 1; i <= count; i++) {
    const idx = Math.min(i * step, chartPoints.length - 1);
    const pt = chartPoints[idx];
    const t = idx / chartPoints.length;
    const bodyHeight = 12 + rng() * 25;
    const wickExtra = 5 + rng() * 15;

    bars.push({
      x: pt.x,
      openY: pt.y + bodyHeight / 2,
      closeY: pt.y - bodyHeight / 2,
      highY: pt.y - bodyHeight / 2 - wickExtra,
      lowY: pt.y + bodyHeight / 2 + wickExtra * 0.6,
      revealT: t,
    });
  }
  return bars;
}

const BillionRainScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();

  const totalFrames = 60;

  // Chart points (memoised)
  const chartPoints = useMemo(() => buildChartPoints(200, W, H), [W, H]);
  const candles = useMemo(
    () => buildCandleBars(chartPoints, 14),
    [chartPoints],
  );

  // Draw progress: how far along the line is drawn (0..1)
  const drawProgress = interpolate(frame, [0, totalFrames - 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // How many points to draw
  const visibleCount = Math.max(
    2,
    Math.ceil(drawProgress * chartPoints.length),
  );
  const visiblePoints = chartPoints.slice(0, visibleCount);

  // Build SVG path for the visible line
  const linePath = useMemo(() => {
    if (visiblePoints.length < 2) return "";
    let d = `M ${visiblePoints[0].x} ${visiblePoints[0].y}`;
    for (let i = 1; i < visiblePoints.length; i++) {
      d += ` L ${visiblePoints[i].x} ${visiblePoints[i].y}`;
    }
    return d;
  }, [visiblePoints]);

  // Build SVG path for the fill area (line + close along bottom)
  const chartBottom = H * 0.78;
  const fillPath = useMemo(() => {
    if (visiblePoints.length < 2) return "";
    const last = visiblePoints[visiblePoints.length - 1];
    const first = visiblePoints[0];
    return `${linePath} L ${last.x} ${chartBottom} L ${first.x} ${chartBottom} Z`;
  }, [linePath, visiblePoints, chartBottom]);

  // --- Trembling / shaking ---
  // Increases from 0 at start to ~15px at the end as the line climbs higher
  const shakeAmplitude = interpolate(
    drawProgress,
    [0, 0.2, 0.5, 0.8, 1],
    [0, 0.5, 3, 8, 15],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const shakeX =
    shakeAmplitude > 0
      ? noise2D("bsx", frame * 1.8, 42) * shakeAmplitude
      : 0;
  const shakeY =
    shakeAmplitude > 0
      ? noise2D("bsy", frame * 1.8, 77) * shakeAmplitude
      : 0;

  // Golden ambient glow intensifying as chart rises
  const glowIntensity = interpolate(frame, [0, 10, 50], [0, 0.15, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow follows the tip of the line
  const tipPoint = visiblePoints[visiblePoints.length - 1];

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${shakeX}px, ${shakeY}px)`,
        overflow: "hidden",
      }}
    >
      {/* Golden ambient glow — follows the line tip */}
      <div
        style={{
          position: "absolute",
          left: (tipPoint?.x ?? W / 2) - 500,
          top: (tipPoint?.y ?? H * 0.5) - 400,
          width: 1000,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexRgba(GOLD, glowIntensity)} 0%, ${hexRgba(MONEY_YELLOW, glowIntensity * 0.4)} 40%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Chart SVG */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 2 }}
      >
        <defs>
          {/* Glow filter for the line */}
          <filter id="chart-line-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Gradient for the fill area */}
          <linearGradient id="chart-fill-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MONEY_YELLOW} stopOpacity={0.35} />
            <stop offset="60%" stopColor={MONEY_YELLOW} stopOpacity={0.08} />
            <stop offset="100%" stopColor={MONEY_YELLOW} stopOpacity={0} />
          </linearGradient>
          {/* Candle glow */}
          <filter id="candle-glow">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Semi-transparent fill area below the line */}
        {fillPath && (
          <path d={fillPath} fill="url(#chart-fill-grad)" strokeWidth={0} />
        )}

        {/* Outer glow line (wider, softer) */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={hexRgba(MONEY_YELLOW, 0.4)}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#chart-line-glow)"
          />
        )}

        {/* Main chart line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={MONEY_YELLOW}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Bright core line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#FFFBE6"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        )}

        {/* Green candle bars along the path */}
        {candles.map((candle, i) => {
          if (drawProgress < candle.revealT) return null;
          const candleAlpha = interpolate(
            drawProgress,
            [candle.revealT, Math.min(1, candle.revealT + 0.06)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const barWidth = 10;
          return (
            <g key={`candle-${i}`} opacity={candleAlpha}>
              {/* Wick (high to low) */}
              <line
                x1={candle.x}
                y1={candle.highY}
                x2={candle.x}
                y2={candle.lowY}
                stroke={GROWTH_GREEN}
                strokeWidth={1.5}
                opacity={0.7}
              />
              {/* Body (open to close) */}
              <rect
                x={candle.x - barWidth / 2}
                y={candle.closeY}
                width={barWidth}
                height={candle.openY - candle.closeY}
                fill={GROWTH_GREEN}
                rx={1.5}
                opacity={0.85}
              />
              {/* Soft glow behind body */}
              <rect
                x={candle.x - barWidth / 2 - 2}
                y={candle.closeY - 2}
                width={barWidth + 4}
                height={candle.openY - candle.closeY + 4}
                fill={GROWTH_GREEN}
                rx={2}
                filter="url(#candle-glow)"
                opacity={0.2}
              />
            </g>
          );
        })}

        {/* Glowing dot at the tip of the line */}
        {tipPoint && (
          <g>
            <circle
              cx={tipPoint.x}
              cy={tipPoint.y}
              r={12}
              fill={hexRgba(MONEY_YELLOW, 0.25)}
              filter="url(#chart-line-glow)"
            />
            <circle
              cx={tipPoint.x}
              cy={tipPoint.y}
              r={5}
              fill={MONEY_YELLOW}
            />
            <circle
              cx={tipPoint.x}
              cy={tipPoint.y}
              r={2.5}
              fill="#FFFBE6"
            />
          </g>
        )}
      </svg>

      {/* Extra shimmer sparkles near the line tip */}
      {Array.from({ length: 8 }, (_, i) => {
        const sparkleFrame = (frame + i * 7) % 18;
        const sparkleOpacity = interpolate(
          sparkleFrame,
          [0, 3, 8, 12],
          [0, 0.7, 0.5, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        if (sparkleOpacity <= 0 || !tipPoint) return null;
        const offsetX = noise2D("spkx" + i, frame * 0.3, i * 11) * 80;
        const offsetY = noise2D("spky" + i, frame * 0.3, i * 17) * 80;
        return (
          <div
            key={`sparkle-${i}`}
            style={{
              position: "absolute",
              left: tipPoint.x + offsetX - 3,
              top: tipPoint.y + offsetY - 3,
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#fff",
              opacity: sparkleOpacity,
              boxShadow: `0 0 8px ${hexRgba(MONEY_YELLOW, 0.8)}, 0 0 16px ${hexRgba(GOLD, 0.4)}`,
              pointerEvents: "none",
              zIndex: 3,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant 4: "zero-crack" — Screen goes dark, red cracks spread, gut-punch $0
// ---------------------------------------------------------------------------

interface CrackSegment {
  points: { x: number; y: number }[];
  branches: { x: number; y: number }[][];
}

function buildRedCracks(count: number, seed: number, W: number, H: number): CrackSegment[] {
  const cracks: CrackSegment[] = [];
  const cx = W / 2;
  const cy = H * 0.42;

  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2 + noise2D("cAngle", i * 5, seed) * 0.3;
    const maxLen = 400 + Math.abs(noise2D("cLen", i * 3.7, seed)) * 500;
    const steps = 14 + Math.floor(Math.abs(noise2D("cSteps", i * 2.1, seed)) * 8);

    const points: { x: number; y: number }[] = [{ x: cx, y: cy }];
    let angle = baseAngle;

    for (let s = 1; s <= steps; s++) {
      const deviation = noise2D("cr" + i, s * 0.4, seed * 3.1) * 0.5;
      angle = baseAngle + deviation;
      const stepLen =
        (maxLen / steps) * (1 + noise2D("crLen", i + s * 0.3, seed) * 0.35);
      const prev = points[points.length - 1];
      points.push({
        x: prev.x + Math.cos(angle) * stepLen,
        y: prev.y + Math.sin(angle) * stepLen,
      });
    }

    // Sub-branches
    const branches: { x: number; y: number }[][] = [];
    const branchCount = Math.floor(Math.abs(noise2D("brc", i * 7, seed)) * 3);
    for (let b = 0; b < branchCount; b++) {
      const startIdx = 2 + Math.floor(Math.abs(noise2D("brIdx", i + b * 11, seed)) * (points.length - 3));
      const clampedIdx = Math.min(startIdx, points.length - 1);
      const origin = points[clampedIdx];
      const brAngle =
        baseAngle +
        (noise2D("brA", i + b * 5, seed) > 0 ? 1 : -1) *
          (0.5 + Math.abs(noise2D("brA2", b + i, seed)) * 0.7);
      const brLen = 60 + Math.abs(noise2D("brL", i + b, seed)) * 180;
      const brSteps = 5;
      const brPts: { x: number; y: number }[] = [{ x: origin.x, y: origin.y }];

      for (let s = 1; s <= brSteps; s++) {
        const dev = noise2D("brr" + i + b, s * 0.5, seed) * 0.4;
        const a = brAngle + dev;
        const sl = brLen / brSteps;
        const p = brPts[brPts.length - 1];
        brPts.push({
          x: p.x + Math.cos(a) * sl,
          y: p.y + Math.sin(a) * sl,
        });
      }
      branches.push(brPts);
    }

    cracks.push({ points, branches });
  }
  return cracks;
}

function crackPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

const ZeroCrackScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();

  const totalFrames = 21; // ~0.7s at 30fps
  const crackStartFrame = 2;

  const cracks = useMemo(() => buildRedCracks(12, 59, W, H), [W, H]);

  // Darkness: screen goes dark immediately
  const darknessOpacity = interpolate(frame, [0, 2], [0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Crack spread progress
  const crackFrame = Math.max(0, frame - crackStartFrame);
  const crackProgress = interpolate(crackFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red glow emanating from cracks
  const redGlow = interpolate(frame, [crackStartFrame, crackStartFrame + 6, totalFrames], [0, 0.25, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Screen shake
  const shakeIntensity =
    frame >= crackStartFrame && frame < crackStartFrame + 8
      ? interpolate(frame, [crackStartFrame, crackStartFrame + 8], [14, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const shakeX = shakeIntensity > 0 ? noise2D("zsx", frame * 3, 42) * shakeIntensity : 0;
  const shakeY = shakeIntensity > 0 ? noise2D("zsy", frame * 3, 77) * shakeIntensity : 0;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${shakeX}px, ${shakeY}px)`,
        overflow: "hidden",
      }}
    >
      {/* Darkness overlay */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0,0,0,${darknessOpacity})`,
          zIndex: 1,
        }}
      />

      {/* Red glow from center */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 500,
          top: H * 0.3,
          width: 1000,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexRgba(PAIN_RED, redGlow)} 0%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Crack SVG layer */}
      {crackProgress > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <defs>
            <filter id="red-crack-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="red-crack-soft">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>

          {cracks.map((crack, i) => {
            const crackDelay = i * 0.05;
            const localProgress = interpolate(
              crackProgress,
              [crackDelay, Math.min(1, crackDelay + 0.4)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            if (localProgress <= 0) return null;

            const visibleCount = Math.ceil(crack.points.length * localProgress);
            const visiblePts = crack.points.slice(0, visibleCount);
            const path = crackPath(visiblePts);

            const branchProgress = interpolate(
              crackProgress,
              [crackDelay + 0.2, Math.min(1, crackDelay + 0.6)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <g key={`crack-${i}`}>
                {/* Soft outer glow */}
                <path
                  d={path}
                  fill="none"
                  stroke={PAIN_RED}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#red-crack-soft)"
                  opacity={0.35}
                />
                {/* Main crack */}
                <path
                  d={path}
                  fill="none"
                  stroke={PAIN_RED}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#red-crack-glow)"
                />
                {/* Bright core */}
                <path
                  d={path}
                  fill="none"
                  stroke="#FF8888"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                />

                {/* Branches */}
                {branchProgress > 0 &&
                  crack.branches.map((branch, bi) => {
                    const bCount = Math.ceil(branch.length * branchProgress);
                    const bPts = branch.slice(0, bCount);
                    const bPath = crackPath(bPts);
                    return (
                      <g key={`br-${i}-${bi}`}>
                        <path
                          d={bPath}
                          fill="none"
                          stroke={PAIN_RED}
                          strokeWidth={5}
                          strokeLinecap="round"
                          filter="url(#red-crack-soft)"
                          opacity={0.25}
                        />
                        <path
                          d={bPath}
                          fill="none"
                          stroke={PAIN_RED}
                          strokeWidth={2}
                          strokeLinecap="round"
                          filter="url(#red-crack-glow)"
                          opacity={0.85}
                        />
                      </g>
                    );
                  })}
              </g>
            );
          })}

          {/* Impact crater at center */}
          <circle
            cx={W / 2}
            cy={H * 0.42}
            r={interpolate(crackProgress, [0, 0.3], [0, 24], {
              extrapolateRight: "clamp",
            })}
            fill="none"
            stroke={PAIN_RED}
            strokeWidth={3}
            filter="url(#red-crack-glow)"
            opacity={0.6}
          />
          <circle
            cx={W / 2}
            cy={H * 0.42}
            r={interpolate(crackProgress, [0, 0.3], [0, 10], {
              extrapolateRight: "clamp",
            })}
            fill={PAIN_RED}
            opacity={0.4}
          />
        </svg>
      )}

      {/* Vignette: dark edges for dramatic feel */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, transparent 30%, rgba(0,0,0,0.6) 100%)",
          zIndex: 4,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export const ImpactScene: React.FC<Props> = ({ variant, hideCounter = false }) => {
  switch (variant) {
    case "forty-million":
      return <FortyMillionScene hideCounter={hideCounter} />;
    case "visits":
      return <VisitsScene hideCounter={hideCounter} />;
    case "billion-rain":
      return <BillionRainScene />;
    case "zero-crack":
      return <ZeroCrackScene />;
    default:
      return null;
  }
};
