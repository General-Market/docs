import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
} from "remotion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  variant: "growing" | "static";
  counterTarget?: number;
  hideCounter?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const fontFamily = "'Courier New', 'Courier', monospace";

const COLOR_WHITE = "#FFFFFF";
const COLOR_YELLOW = "#FFE500";
const COLOR_GREEN = "#00FF88";

// Auto-size font to fit within 940px (1080 - padding)
const MAX_TEXT_WIDTH = 940;
const autoFontSize = (
  text: string,
  maxSize: number,
  charWidthRatio = 0.6,
  extraSpacingPerChar = 0,
): number => {
  const totalWidth =
    text.length * maxSize * charWidthRatio +
    (text.length - 1) * extraSpacingPerChar;
  if (totalWidth <= MAX_TEXT_WIDTH) return maxSize;
  return Math.floor(
    MAX_TEXT_WIDTH / (text.length * charWidthRatio + ((text.length - 1) * extraSpacingPerChar) / maxSize),
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

/** Format a number with commas: 800000000 -> "800,000,000" */
function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Human silhouette SVG path (filled solid shape)
// ---------------------------------------------------------------------------

/**
 * Returns an SVG path for a realistic human silhouette — a filled solid shape
 * with head, neck, shoulders, torso, and legs. Fits within approximately 20x40
 * units. Origin at top-center of head.
 */
function humanSilhouettePath(): string {
  // A filled, solid person silhouette (standing, arms at sides)
  return [
    // Head (oval)
    "M 10 0",
    "C 13.5 0, 16 2.5, 16 6",
    "C 16 9.5, 13.5 12, 10 12",
    "C 6.5 12, 4 9.5, 4 6",
    "C 4 2.5, 6.5 0, 10 0",
    "Z",
    // Neck + shoulders + torso + legs
    "M 8 12",
    "L 8 13",
    // Left shoulder
    "L 1 16",
    "L 0 17",
    "L 0 22",
    "L 2 21",
    "L 3 17.5",
    "L 6 15",
    // Left side of torso
    "L 5 24",
    "L 4 30",
    // Left leg
    "L 3 36",
    "L 2.5 40",
    "L 5.5 40",
    "L 7 34",
    "L 8 28",
    // Crotch
    "L 10 25",
    "L 12 28",
    // Right leg
    "L 13 34",
    "L 14.5 40",
    "L 17.5 40",
    "L 17 36",
    // Right side of torso
    "L 16 30",
    "L 15 24",
    "L 14 15",
    "L 17 17.5",
    "L 18 21",
    "L 20 22",
    "L 20 17",
    "L 19 16",
    // Right shoulder
    "L 12 13",
    "L 12 12",
    "Z",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Figure data generation — MASSIVE stadium/grid crowd
// ---------------------------------------------------------------------------

interface FigureData {
  x: number;
  y: number;
  scale: number;
  color: string;
  opacity: number;
  distFromCenter: number; // normalized 0-1
  delay: number; // frame delay for wave animation
  row: number; // depth row (0 = back/top, higher = front/bottom)
}

function buildCrowdFigures(count: number, W: number, H: number): FigureData[] {
  const rng = mulberry32(42069);
  const figures: FigureData[] = [];

  const cx = W / 2;
  const cy = H / 2;

  // Color palette: mostly white, some yellow, some green
  const colors = [
    COLOR_WHITE, COLOR_WHITE, COLOR_WHITE, COLOR_WHITE, COLOR_WHITE,
    COLOR_WHITE, COLOR_WHITE, COLOR_WHITE,
    COLOR_YELLOW, COLOR_YELLOW, COLOR_YELLOW,
    COLOR_GREEN, COLOR_GREEN,
  ];

  // Stadium/grid layout: rows of people, perspective from slightly above
  // Back rows are at the top, smaller and dimmer. Front rows are at the bottom,
  // bigger and brighter. This creates a "sea of people" / concert crowd look.

  // We'll fill the screen with rows. Each row has figures packed tightly.
  const totalRows = 45;
  // Y range: from top area (behind counter) to bottom of screen
  const yStart = H * 0.30; // start below the counter area
  const yEnd = H * 1.02; // bleed off bottom edge

  for (let row = 0; row < totalRows; row++) {
    if (figures.length >= count) break;

    // Row position (0 = top/back, totalRows-1 = bottom/front)
    const rowT = row / (totalRows - 1); // 0..1

    // Y position for this row with slight perspective curve
    const rowY = yStart + (yEnd - yStart) * (rowT * rowT * 0.4 + rowT * 0.6);

    // Scale: back rows are tiny, front rows are larger (perspective)
    const baseScale = 0.25 + rowT * 0.85;

    // How many figures fit in this row — more in front rows (they're wider in perspective)
    const figWidth = 20 * baseScale; // approximate width of one figure
    const spacing = figWidth * 0.75; // pack them tightly with overlap
    const rowWidth = W + 80; // extend past edges
    const figuresInRow = Math.floor(rowWidth / spacing);

    // Opacity: back rows are dimmer, front rows brighter
    const baseOpacity = 0.15 + rowT * 0.65;

    for (let col = 0; col < figuresInRow; col++) {
      if (figures.length >= count) break;

      // X position: evenly spaced with jitter
      const xBase = -40 + (col / (figuresInRow - 1)) * rowWidth;
      const jitterX = (rng() - 0.5) * spacing * 0.5;
      const jitterY = (rng() - 0.5) * baseScale * 8;

      const x = xBase + jitterX;
      const y = rowY + jitterY;

      // Distance from center for wave animation
      const dx = (x - cx) / W;
      const dy = (y - cy) / H;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normalizedDist = Math.min(1, dist / 0.7);

      // Scale variation per figure
      const scaleJitter = baseScale * (0.85 + rng() * 0.3);

      // Color
      const colorIdx = Math.floor(rng() * colors.length);

      // Opacity variation
      const opacityJitter = baseOpacity * (0.7 + rng() * 0.3);

      figures.push({
        x,
        y,
        scale: scaleJitter,
        color: colors[colorIdx],
        opacity: opacityJitter,
        distFromCenter: normalizedDist,
        delay: normalizedDist * 25 + rng() * 5, // fast wave from center outward
        row,
      });
    }
  }

  return figures;
}

// ---------------------------------------------------------------------------
// Background particle data
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  phase: number;
}

function buildParticles(count: number, W: number, H: number): Particle[] {
  const rng = mulberry32(7777);
  return Array.from({ length: count }, () => ({
    x: rng() * W,
    y: rng() * H,
    size: 1 + rng() * 3,
    speed: 0.3 + rng() * 1.2,
    opacity: 0.1 + rng() * 0.3,
    phase: rng() * Math.PI * 2,
  }));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const CrowdVisualization: React.FC<Props> = ({
  variant,
  counterTarget = 800_000_000,
  hideCounter = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();

  const isGrowing = variant === "growing";

  // Memoize generated data — 850 figures for a truly massive crowd
  const figures = useMemo(() => buildCrowdFigures(850, W, H), [W, H]);
  const particles = useMemo(() => buildParticles(60, W, H), [W, H]);
  const figurePath = useMemo(() => humanSilhouettePath(), []);

  // ---------------------------------------------------------------------------
  // Animation timing
  // ---------------------------------------------------------------------------

  // Crowd expansion: figures rush in fast from center outward
  const crowdProgress = isGrowing
    ? interpolate(frame, [0, 40], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Counter animation: ramps up with easing
  const counterEndFrame = isGrowing ? 70 : 0;
  const counterRaw = isGrowing
    ? interpolate(frame, [5, counterEndFrame], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  // Ease-in-out for dramatic ramp
  const counterEased = counterRaw < 0.5
    ? 4 * counterRaw * counterRaw * counterRaw
    : 1 - Math.pow(-2 * counterRaw + 2, 3) / 2;
  const counterValue = Math.floor(counterEased * counterTarget);

  // Counter slam spring when it reaches the target
  const counterLandFrame = counterEndFrame + 1;
  const counterScaleSpring = isGrowing
    ? spring({
        frame: Math.max(0, frame - counterLandFrame),
        fps,
        config: { damping: 8, stiffness: 300, mass: 0.4 },
        durationInFrames: 15,
      })
    : 1;
  const counterScale = isGrowing && frame >= counterLandFrame
    ? 1 + (1 - counterScaleSpring) * 0.3
    : 1;

  // Glow pulse on counter
  const glowSize = frame >= counterLandFrame
    ? 30 + Math.sin(frame * 0.15) * 10
    : interpolate(frame, [0, counterEndFrame], [4, 20], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // Overall subtle breathe for living crowd effect
  const crowdBreathScale = 1 + Math.sin(frame * 0.03) * 0.003;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Layer 0: Subtle background particles */}
      {particles.map((p, i) => {
        const driftY = p.y - p.speed * frame * 0.5;
        const wrappedY = ((driftY % H) + H) % H;
        const driftX = p.x + Math.sin(frame * 0.02 + p.phase) * 15;
        const pOpacity = p.opacity * interpolate(frame, [0, 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={`particle-${i}`}
            style={{
              position: "absolute",
              left: driftX,
              top: wrappedY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: hexRgba(COLOR_YELLOW, pOpacity),
              boxShadow: `0 0 ${p.size * 2}px ${hexRgba(COLOR_YELLOW, pOpacity * 0.5)}`,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        );
      })}

      {/* Layer 1: MASSIVE crowd of human silhouettes */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 2,
          transform: `scale(${crowdBreathScale})`,
          transformOrigin: "center center",
        }}
      >
        <defs>
          {/* Define the silhouette path once, reuse with <use> for performance */}
          <path id="human-silhouette" d={figurePath} />
        </defs>
        {figures.map((fig, i) => {
          // Wave appearance: figures rush in from center outward
          const waveThreshold = fig.delay / 30;
          const figAppearProgress = isGrowing
            ? interpolate(
                crowdProgress,
                [
                  Math.max(0, waveThreshold - 0.05),
                  Math.min(1, waveThreshold + 0.1),
                ],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )
            : 1;

          if (figAppearProgress <= 0) return null;

          // Scale spring for pop-in effect — fast snap
          const figScale = isGrowing
            ? fig.scale * (0.5 + 0.5 * figAppearProgress)
            : fig.scale;

          // Subtle idle sway — small variation per figure for living feel
          const sway = Math.sin(frame * 0.035 + i * 2.3) * 0.8;

          // Opacity combines row-based depth + wave appearance
          const figOpacity = figAppearProgress * fig.opacity;

          return (
            <use
              key={`fig-${i}`}
              href="#human-silhouette"
              x={0}
              y={0}
              transform={`translate(${fig.x + sway}, ${fig.y}) scale(${figScale})`}
              fill={fig.color}
              opacity={figOpacity}
            />
          );
        })}
      </svg>

      {/* Layer 2: Gradient fade at top — crowd fades into darkness behind counter */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H * 0.35,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* Layer 3: Radial glow behind counter area */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 400,
          top: H * 0.06,
          width: 800,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexRgba(COLOR_YELLOW, 0.15)} 0%, ${hexRgba(COLOR_YELLOW, 0.05)} 40%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
          zIndex: 4,
        }}
      />

      {/* Layer 4: Counter overlay — on TOP of the crowd (hidden when DataCallout handles text) */}
      {!hideCounter && (
      <div
        style={{
          position: "absolute",
          top: H * 0.10,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {/* Main number */}
        <span
          style={{
            fontFamily,
            color: COLOR_WHITE,
            fontSize: autoFontSize(formatNumber(counterValue), 120, 0.6, 3),
            fontWeight: 900,
            letterSpacing: 3,
            transform: `scale(${counterScale})`,
            textShadow: [
              `0 0 ${glowSize}px ${hexRgba(COLOR_YELLOW, 0.8)}`,
              `0 0 ${glowSize * 2}px ${hexRgba(COLOR_YELLOW, 0.4)}`,
              `0 0 ${glowSize * 3}px ${hexRgba(COLOR_YELLOW, 0.2)}`,
              `0 2px 20px rgba(0,0,0,0.9)`,
            ].join(", "),
            textAlign: "center",
            display: "inline-block",
          }}
        >
          {formatNumber(counterValue)}
        </span>

        {/* "ANALYSTS" label */}
        <span
          style={{
            fontFamily,
            color: hexRgba(COLOR_WHITE, 0.85),
            fontSize: autoFontSize("ANALYSTS", 60, 0.62, 16),
            fontWeight: 700,
            letterSpacing: 16,
            marginTop: 10,
            textShadow: [
              `0 0 ${glowSize * 0.6}px ${hexRgba(COLOR_YELLOW, 0.4)}`,
              `0 2px 15px rgba(0,0,0,0.9)`,
            ].join(", "),
            textAlign: "center",
            opacity: isGrowing
              ? interpolate(frame, [20, 35], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1,
          }}
        >
          ANALYSTS
        </span>
      </div>
      )}

      {/* Layer 5: Vignette for depth */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, transparent 30%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
    </AbsoluteFill>
  );
};
