import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { COLORS } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  variant: "naruto-views" | "top-20" | "jojo-cliffhanger";
}

// ---------------------------------------------------------------------------
// Helpers — deterministic pseudo-random from a seed (mulberry32)
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

const fontFamily = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

// Auto-size font to fit within a given max width
const autoFontSize = (
  text: string,
  maxSize: number,
  maxTextWidth: number,
  charWidthRatio = 0.6,
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
// Variant: Naruto Views — odometer / slot-machine counter
// ---------------------------------------------------------------------------

const TARGET_VIEWS = 2847391;

/** Format number with commas: 2847391 -> "2,847,391" */
function formatWithCommas(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

const NarutoViews: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const MAX_TEXT_WIDTH = W - 140;

  // Counter counts up with easing — fast start, decelerating end
  // Total animation over ~50 frames (1.67s at 30fps)
  const countProgress = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 40, mass: 1.2 },
    durationInFrames: 50,
  });

  const currentValue = Math.floor(TARGET_VIEWS * countProgress);
  const displayValue = formatWithCommas(currentValue);

  // Scale slam on arrival
  const slamScale = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.6 },
    durationInFrames: 15,
  });
  const scale = 1 + (1.15 - 1) * (1 - slamScale);

  // Glow intensity pulses after counter lands
  const landed = countProgress > 0.98;
  const glowPulse = landed
    ? 20 + Math.sin(frame * 0.12) * 8
    : 5 + countProgress * 15;

  // Label fade in
  const labelOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ambient particles around the counter
  const particles = React.useMemo(() => {
    const r = seededRandom(291);
    return Array.from({ length: 12 }, (_, i) => ({
      baseX: W * 0.2 + r() * W * 0.6,
      baseY: H * 0.35 + r() * 200,
      size: 3 + r() * 6,
      speed: 0.5 + r() * 1.5,
      seed: i * 47,
      alpha: 0.3 + r() * 0.4,
    }));
  }, [W, H]);

  return (
    <AbsoluteFill>
      {/* Warm ambient glow behind counter */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 350,
          top: H * 0.38 - 200,
          width: 700,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexToRgba(COLORS.NARUTO_ORANGE, 0.12)}, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => {
        const nx = noise2D("nv" + i, frame * 0.015, p.seed * 0.01) * 40;
        const ny = noise2D("nvY" + i, frame * 0.012, p.seed * 0.02) * 30;
        const drift = Math.sin(frame * 0.04 + i * 1.3) * 15;
        const particleOpacity = countProgress * p.alpha;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.baseX + nx - p.size,
              top: p.baseY + ny + drift - p.size,
              width: p.size * 2,
              height: p.size * 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${hexToRgba(COLORS.NARUTO_ORANGE, particleOpacity)}, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Main counter */}
      <div
        style={{
          position: "absolute",
          top: H * 0.38,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5,
        }}
      >
        {/* Counter value */}
        <div
          style={{
            fontFamily: "'Courier New', 'Consolas', monospace",
            fontSize: autoFontSize(displayValue, 110, MAX_TEXT_WIDTH, 0.6, 4),
            fontWeight: 900,
            color: "#FFFFFF",
            transform: `scale(${scale})`,
            textShadow: `
              0 0 ${glowPulse}px ${hexToRgba(COLORS.NARUTO_ORANGE, 0.8)},
              0 0 ${glowPulse * 2}px ${hexToRgba(COLORS.NARUTO_ORANGE, 0.4)},
              0 0 ${glowPulse * 3}px ${hexToRgba(COLORS.NARUTO_ORANGE, 0.2)}
            `,
            letterSpacing: 4,
            lineHeight: 1,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          {displayValue}
        </div>

        {/* DAILY VIEWS label */}
        <div
          style={{
            fontFamily,
            fontSize: 36,
            fontWeight: 700,
            color: COLORS.NARUTO_ORANGE,
            opacity: labelOpacity,
            letterSpacing: 12,
            marginTop: 30,
            textShadow: `0 0 10px ${hexToRgba(COLORS.NARUTO_ORANGE, 0.5)}`,
          }}
        >
          DAILY VIEWS
        </div>
      </div>

      {/* Decorative line under counter */}
      <div
        style={{
          position: "absolute",
          top: H * 0.38 + 200,
          left: W * 0.15,
          right: W * 0.15,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${hexToRgba(COLORS.NARUTO_ORANGE, 0.4 * countProgress)}, transparent)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: Top 20 — animated leaderboard with rank cards
// ---------------------------------------------------------------------------

interface MangaEntry {
  rank: number;
  title: string;
  views: number; // for bar width proportion
  badgeColor: string;
}

const MANGA_DATA: MangaEntry[] = [
  { rank: 1, title: "Jujutsu Kaisen", views: 4200000, badgeColor: "#FFD700" },
  { rank: 2, title: "One Piece", views: 3800000, badgeColor: "#C0C0C0" },
  { rank: 3, title: "Demon Slayer", views: 3100000, badgeColor: "#CD7F32" },
  { rank: 4, title: "Chainsaw Man", views: 2600000, badgeColor: "#7B2D8E" },
  { rank: 5, title: "My Hero Academia", views: 2100000, badgeColor: "#7B2D8E" },
];

const CARD_HEIGHT = 72;
const CARD_GAP = 14;

const RankCard: React.FC<{
  entry: MangaEntry;
  index: number;
  slideProgress: number;
  frame: number;
}> = ({ entry, index, slideProgress, frame }) => {
  const { width: W, height: H } = useVideoConfig();
  const CARD_LEFT = 80;
  const CARD_WIDTH = W - CARD_LEFT - 80;
  const MAX_BAR_WIDTH = CARD_WIDTH - 260; // space for rank badge + title

  const isTop1 = entry.rank === 1;

  // Bar width proportional to views
  const maxViews = MANGA_DATA[0].views;
  const barRatio = entry.views / maxViews;
  const barWidth = MAX_BAR_WIDTH * barRatio * slideProgress;

  // Glow for #1
  const glowIntensity = isTop1
    ? 8 + Math.sin(frame * 0.1) * 4
    : 0;

  const cardY = H * 0.32 + index * (CARD_HEIGHT + CARD_GAP);

  // Slide in from right
  const translateX = interpolate(slideProgress, [0, 1], [W + 100, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: CARD_LEFT,
        top: cardY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: `translateX(${translateX}px)`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        zIndex: 5,
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          backgroundColor: entry.badgeColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontSize: 26,
          fontWeight: 900,
          color: entry.rank <= 3 ? "#1A1A1A" : "#FFFFFF",
          flexShrink: 0,
          boxShadow: isTop1
            ? `0 0 ${glowIntensity}px ${entry.badgeColor}, 0 0 ${glowIntensity * 2}px ${hexToRgba(entry.badgeColor, 0.4)}`
            : `0 2px 8px rgba(0,0,0,0.3)`,
        }}
      >
        #{entry.rank}
      </div>

      {/* Title + bar container */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Title */}
        <div
          style={{
            fontFamily,
            fontSize: 24,
            fontWeight: 700,
            color: isTop1 ? "#FFD700" : "#FFFFFF",
            letterSpacing: 1,
            textShadow: isTop1
              ? `0 0 8px ${hexToRgba("#FFD700", 0.5)}`
              : "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.title}
        </div>

        {/* View bar */}
        <div
          style={{
            width: "100%",
            height: 14,
            borderRadius: 7,
            backgroundColor: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: barWidth,
              height: "100%",
              borderRadius: 7,
              background: isTop1
                ? `linear-gradient(90deg, ${entry.badgeColor}, ${hexToRgba(entry.badgeColor, 0.7)})`
                : `linear-gradient(90deg, ${hexToRgba(entry.badgeColor, 0.8)}, ${hexToRgba(entry.badgeColor, 0.4)})`,
              boxShadow: isTop1
                ? `0 0 12px ${hexToRgba(entry.badgeColor, 0.4)}`
                : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
};

const Top20: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const CARD_LEFT = 80;
  const CARD_WIDTH = W - CARD_LEFT - 80;

  // Gold particles for #1 rank
  const goldParticles = React.useMemo(() => {
    const rng = seededRandom(777);
    return Array.from({ length: 16 }, (_, i) => ({
      x: CARD_LEFT + rng() * CARD_WIDTH,
      y: H * 0.32 - 20 + rng() * (CARD_HEIGHT + 40),
      size: 2 + rng() * 4,
      speed: 0.3 + rng() * 0.8,
      seed: i * 31,
      alpha: 0.3 + rng() * 0.5,
    }));
  }, [CARD_LEFT, CARD_WIDTH, H]);

  // Staggered slide-in for each card
  const cardSprings = MANGA_DATA.map((_, i) => {
    const delay = i * 5; // 5 frames between each card
    return spring({
      frame: Math.max(0, frame - delay),
      fps,
      config: { damping: 14, stiffness: 120, mass: 0.8 },
      durationInFrames: 20,
    });
  });

  // Header fade in
  const headerOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: H * 0.26,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily,
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.MONEY_YELLOW,
          letterSpacing: 6,
          opacity: headerOpacity,
          textShadow: `0 0 12px ${hexToRgba(COLORS.MONEY_YELLOW, 0.3)}`,
        }}
      >
        TOP 20 THIS SEASON
      </div>

      {/* Rank cards */}
      {MANGA_DATA.map((entry, i) => (
        <RankCard
          key={entry.rank}
          entry={entry}
          index={i}
          slideProgress={cardSprings[i]}
          frame={frame}
        />
      ))}

      {/* Gold particles around #1 card */}
      {goldParticles.map((p, i) => {
        const show = cardSprings[0] > 0.5;
        if (!show) return null;

        const nx = noise2D("gx" + i, frame * 0.02, p.seed * 0.01) * 30;
        const ny = noise2D("gy" + i, frame * 0.018, p.seed * 0.02) * 20;
        const drift = -frame * p.speed * 0.5;
        const sparkle = 0.5 + 0.5 * Math.sin(frame * 0.2 + i * 2.1);
        const opacity = p.alpha * sparkle * (cardSprings[0] > 0.8 ? 1 : 0);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x + nx,
              top: p.y + ny + drift,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: hexToRgba("#FFD700", opacity),
              boxShadow: `0 0 ${p.size * 2}px ${hexToRgba("#FFD700", opacity * 0.6)}`,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Variant: JoJo Cliffhanger — spinning rank badge with trending arrow
// ---------------------------------------------------------------------------

const JojoCliffhanger: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();

  // Badge spin — full 360 rotation over ~25 frames, then settle
  const spinProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 1 },
    durationInFrames: 30,
  });
  const rotation = interpolate(spinProgress, [0, 1], [360, 0]);

  // Badge scale — pop in
  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.7 },
    durationInFrames: 20,
  });
  const badgeScale = 0.3 + scaleSpring * 0.7;

  // "?" opacity blink after badge lands
  const questionOpacity = spinProgress > 0.8
    ? 0.6 + 0.4 * Math.sin(frame * 0.15)
    : 0;

  // Trending arrow bounce
  const arrowBounce = Math.sin(frame * 0.12) * 18;
  const arrowOpacity = interpolate(frame, [15, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow pulse on badge
  const glowPulse = 10 + Math.sin(frame * 0.1) * 6;

  // Halftone dot pattern overlay
  const halftoneOpacity = interpolate(frame, [0, 15], [0, 0.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ambient purple glow
  const ambientPulse = 0.8 + 0.2 * Math.sin(frame * 0.06);

  return (
    <AbsoluteFill>
      {/* Halftone dot pattern overlay */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: halftoneOpacity,
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <defs>
          <pattern
            id="halftone"
            x="0"
            y="0"
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="6" cy="6" r="2.5" fill="white" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#halftone)" />
      </svg>

      {/* Ambient purple glow behind badge */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 250,
          top: H * 0.38 - 150,
          width: 500,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexToRgba(COLORS.JOJO_PURPLE, 0.15 * ambientPulse)}, transparent 70%)`,
          filter: "blur(30px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Spinning rank badge */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 70,
          top: H * 0.40 - 70,
          width: 140,
          height: 140,
          zIndex: 5,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 24,
            backgroundColor: COLORS.JOJO_PURPLE,
            transform: `rotate(${rotation}deg) scale(${badgeScale})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `
              0 0 ${glowPulse}px ${COLORS.JOJO_PURPLE},
              0 0 ${glowPulse * 2}px ${hexToRgba(COLORS.JOJO_PURPLE, 0.4)},
              0 0 ${glowPulse * 3}px ${hexToRgba(COLORS.JOJO_PURPLE, 0.2)}
            `,
            border: `3px solid ${hexToRgba("#FFFFFF", 0.2)}`,
          }}
        >
          {/* Rank number */}
          <span
            style={{
              fontFamily,
              fontSize: 56,
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1,
              // Counter-rotate so text is always upright as badge spins
              transform: `rotate(${-rotation}deg)`,
            }}
          >
            #7
          </span>
        </div>

        {/* Question mark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: questionOpacity,
            zIndex: 6,
          }}
        >
          <span
            style={{
              fontFamily,
              fontSize: 90,
              fontWeight: 900,
              color: "#FFFFFF",
              textShadow: `
                0 0 20px ${COLORS.JOJO_PURPLE},
                0 0 40px ${hexToRgba(COLORS.JOJO_PURPLE, 0.6)}
              `,
              lineHeight: 1,
            }}
          >
            ?
          </span>
        </div>
      </div>

      {/* Trending arrow */}
      <div
        style={{
          position: "absolute",
          left: W / 2 + 90,
          top: H * 0.40 - 30 + arrowBounce,
          opacity: arrowOpacity,
          zIndex: 5,
        }}
      >
        <svg width="60" height="70" viewBox="0 0 60 70">
          {/* Arrow body */}
          <line
            x1="30"
            y1="65"
            x2="30"
            y2="15"
            stroke={COLORS.GROWTH_GREEN}
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Arrow head */}
          <polyline
            points="12,30 30,8 48,30"
            fill="none"
            stroke={COLORS.GROWTH_GREEN}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Arrow glow */}
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${hexToRgba(COLORS.GROWTH_GREEN, 0.15)}, transparent 70%)`,
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* "TRENDING" label */}
      <div
        style={{
          position: "absolute",
          top: H * 0.40 + 110,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.JOJO_PURPLE,
          letterSpacing: 8,
          opacity: arrowOpacity * 0.8,
          textShadow: `0 0 8px ${hexToRgba(COLORS.JOJO_PURPLE, 0.4)}`,
          zIndex: 5,
        }}
      >
        TRENDING
      </div>

      {/* Dramatic speed lines radiating from badge */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          opacity: scaleSpring * 0.15,
          zIndex: 3,
        }}
      >
        {Array.from({ length: 16 }, (_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const innerR = 120;
          const outerR = 300 + Math.sin(frame * 0.05 + i) * 50;
          const cx = W / 2;
          const cy = H * 0.40;
          const x1 = cx + Math.cos(angle) * innerR;
          const y1 = cy + Math.sin(angle) * innerR;
          const x2 = cx + Math.cos(angle) * outerR;
          const y2 = cy + Math.sin(angle) * outerR;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={hexToRgba(COLORS.JOJO_PURPLE, 0.6)}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export const AnimatedRankings: React.FC<Props> = ({ variant }) => {
  let content: React.ReactNode;

  switch (variant) {
    case "naruto-views":
      content = <NarutoViews />;
      break;
    case "top-20":
      content = <Top20 />;
      break;
    case "jojo-cliffhanger":
      content = <JojoCliffhanger />;
      break;
    default:
      content = null;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {content}
    </AbsoluteFill>
  );
};
