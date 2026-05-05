import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, pitchSans, pitchSansLight, toFrames, W, H } from "./theme";

// ─── Reveal helpers ─────────────────────────────────────────────────────────

export const useReveal = (atFrame: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - atFrame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  return {
    opacity: interpolate(t, [0, 1], [0, 1]),
    y: interpolate(t, [0, 1], [22, 0]),
    x: interpolate(t, [0, 1], [40, 0]),
    scale: interpolate(t, [0, 1], [0.96, 1]),
  };
};

// ─── Slide title (top-left, like slide 3 "Highlights") ──────────────────────

export const SlideTitle: React.FC<{
  children: React.ReactNode;
  accent?: string;
  showFrom?: number;
  size?: number;
}> = ({ children, accent, showFrom = toFrames(0.15), size = 92 }) => {
  const r = useReveal(showFrom);
  return (
    <div
      style={{
        position: "absolute",
        top: 132,
        left: 96,
        right: 96,
        opacity: r.opacity,
        transform: `translateY(${r.y}px)`,
        fontFamily: pitchSans,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1.02,
        color: colors.fg,
      }}
    >
      {children}
      {accent ? (
        <span style={{ color: colors.accent }}>{accent}</span>
      ) : null}
    </div>
  );
};

// ─── Big orange hero block (slide 1 — "WORLDWIDE ASSET MANAGEMENT…") ─────────
// A massive orange rectangle holding the title inside it. The deck's defining
// shape: ~56% × 60%, top-anchored, slightly inset from the left.

export const OrangeHeroBlock: React.FC<{
  children: React.ReactNode;
  showFrom?: number;
  width?: string;
  height?: string;
  top?: string;
  left?: string;
  fontSize?: number;
  withGradient?: boolean;
}> = ({
  children,
  showFrom = toFrames(0.2),
  width = "62%",
  height = "60%",
  top = "20%",
  left = "5%",
  fontSize = 96,
  withGradient = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - showFrom,
    fps,
    config: { damping: 24, stiffness: 90, mass: 1 },
  });
  const opacity = interpolate(t, [0, 1], [0, 1]);
  const scaleX = interpolate(t, [0, 1], [0.92, 1]);

  const bg = withGradient
    ? `linear-gradient(135deg, #FFB733 0%, ${colors.accent} 55%, #E58F00 100%)`
    : colors.accent;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        background: bg,
        opacity,
        transformOrigin: "left center",
        transform: `scaleX(${scaleX})`,
        boxShadow: "0 24px 80px rgba(255,163,0,0.18)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "9% 7% 9% 7%",
          fontFamily: pitchSans,
          fontWeight: 800,
          fontSize,
          letterSpacing: "-0.025em",
          lineHeight: 0.98,
          color: colors.bg,
          opacity: interpolate(t, [0.3, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          textTransform: "uppercase",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Date pill (slide 1 bottom-left black rectangle) ────────────────────────

export const DatePill: React.FC<{
  label: string;
  showFrom?: number;
  bottom?: string;
  left?: string;
}> = ({ label, showFrom = toFrames(0.5), bottom = "8%", left = "5%" }) => {
  const r = useReveal(showFrom);
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left,
        opacity: r.opacity,
        transform: `translateY(${r.y}px)`,
        background: colors.fg,
        padding: "20px 36px",
        fontFamily: pitchSans,
        fontWeight: 700,
        letterSpacing: "0.34em",
        fontSize: 26,
        color: colors.bg,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
};

// ─── Giant ellipse bleed (slide 2 / slide 7 pattern) ────────────────────────
// A massive orange ellipse anchored off-canvas. ~92% wide × 164% tall.
// Bleeds beyond the slide edge to feel structural rather than illustrative.

export const EllipseBleed: React.FC<{
  showFrom?: number;
  cx?: string;
  cy?: string;
  rx?: string;
  ry?: string;
  color?: string;
  withGradient?: boolean;
}> = ({
  showFrom = toFrames(0.1),
  cx = "55%",
  cy = "150%",
  rx = "55%",
  ry = "95%",
  color = colors.accent,
  withGradient = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - showFrom,
    fps,
    config: { damping: 24, stiffness: 70, mass: 1.2 },
  });
  const opacity = interpolate(t, [0, 1], [0, 1]);
  const scale = interpolate(t, [0, 1], [0.85, 1]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, opacity }}
    >
      <defs>
        <radialGradient id="ellGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFC04D" />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor="#D88600" />
        </radialGradient>
      </defs>
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={withGradient ? "url(#ellGrad)" : color}
        style={{
          transformOrigin: "50% 50%",
          transform: `scale(${scale})`,
        }}
      />
    </svg>
  );
};

// ─── Stacked orange bars (slide 3 pattern — "Highlights") ───────────────────

export type StackedBarItem = {
  width: string; // CSS width, varies per row like the deck
  text: string;
  accent?: string;
};

export const StackedBars: React.FC<{
  items: StackedBarItem[];
  startFrame?: number;
  step?: number;
  top?: string;
}> = ({ items, startFrame = toFrames(0.4), step = toFrames(0.45), top = "32%" }) => {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: "4%",
        right: "4%",
      }}
    >
      {items.map((item, i) => {
        const at = startFrame + i * step;
        return <BarRow key={i} item={item} at={at} index={i} />;
      })}
    </div>
  );
};

const BarRow: React.FC<{
  item: StackedBarItem;
  at: number;
  index: number;
}> = ({ item, at, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - at,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const w = interpolate(t, [0, 1], [0, 1]);
  const textOpacity = interpolate(t, [0.4, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        marginBottom: 18,
        height: 116,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: item.width,
          background: `linear-gradient(90deg, ${colors.accent} 0%, #E58F00 100%)`,
          transform: `scaleX(${w})`,
          transformOrigin: "left center",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingLeft: 36,
          display: "flex",
          alignItems: "center",
          opacity: textOpacity,
          fontFamily: pitchSans,
          fontWeight: 700,
          fontSize: 50,
          letterSpacing: "-0.015em",
          color: colors.bg,
        }}
      >
        {item.text}
      </div>
    </div>
  );
};

// ─── 3-stat card grid (slide 6 pattern — "12% / 50% / 510M") ────────────────

export type StatCard = {
  big: string;
  caption: string;
};

export const StatCardGrid: React.FC<{
  stats: StatCard[];
  startFrame?: number;
  step?: number;
}> = ({ stats, startFrame = toFrames(0.4), step = toFrames(0.4) }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "30%",
        left: 96,
        right: 96,
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        gap: 28,
      }}
    >
      {stats.map((s, i) => (
        <StatCardCell key={i} stat={s} at={startFrame + i * step} />
      ))}
    </div>
  );
};

const StatCardCell: React.FC<{ stat: StatCard; at: number }> = ({ stat, at }) => {
  const r = useReveal(at);
  return (
    <div
      style={{
        position: "relative",
        opacity: r.opacity,
        transform: `translateY(${r.y}px)`,
        background: `linear-gradient(180deg, #1A1B1D 0%, ${colors.panel} 100%)`,
        border: `1px solid ${colors.rule}`,
        padding: "56px 40px",
        minHeight: 380,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          width: 40,
          height: 6,
          background: colors.accent,
          marginBottom: 32,
        }}
      />
      <div
        style={{
          fontFamily: pitchSans,
          fontWeight: 800,
          fontSize: 168,
          letterSpacing: "-0.05em",
          lineHeight: 0.95,
          color: colors.fg,
        }}
      >
        {stat.big}
      </div>
      <div
        style={{
          fontFamily: pitchSansLight,
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: "0.01em",
          color: colors.dim,
          lineHeight: 1.3,
          marginTop: 28,
          maxWidth: "92%",
        }}
      >
        {stat.caption}
      </div>
    </div>
  );
};

// ─── White card grid (slide 12 pattern — Traction) ──────────────────────────

export type WhiteCardItem = {
  header: string;
  body: React.ReactNode;
};

export const WhiteCardGrid: React.FC<{
  items: WhiteCardItem[];
  startFrame?: number;
  step?: number;
}> = ({ items, startFrame = toFrames(0.4), step = toFrames(0.35) }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "28%",
        left: 96,
        right: 96,
        display: "grid",
        gridTemplateColumns: `repeat(2, 1fr)`,
        gridAutoRows: "1fr",
        gap: 28,
      }}
    >
      {items.map((it, i) => (
        <WhiteCardCell key={i} item={it} at={startFrame + i * step} />
      ))}
    </div>
  );
};

const WhiteCardCell: React.FC<{ item: WhiteCardItem; at: number }> = ({
  item,
  at,
}) => {
  const r = useReveal(at);
  return (
    <div
      style={{
        position: "relative",
        opacity: r.opacity,
        transform: `translateY(${r.y}px) scale(${r.scale})`,
        background: `linear-gradient(180deg, #FFFFFF 0%, #ECEDF1 100%)`,
        minHeight: 240,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: colors.bg,
          color: colors.fg,
          padding: "28px 36px",
          fontFamily: pitchSans,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: "-0.01em",
        }}
      >
        {item.header}
      </div>
      <div
        style={{
          padding: "32px 36px",
          fontFamily: pitchSansLight,
          fontWeight: 400,
          fontSize: 28,
          color: colors.bg,
          lineHeight: 1.35,
          flex: 1,
        }}
      >
        {item.body}
      </div>
    </div>
  );
};

// ─── Year-pill timeline (slide 4/5 bottom strip) ────────────────────────────

export const YearPillTimeline: React.FC<{
  years: string[];
  highlightIndex?: number;
  showFrom?: number;
}> = ({ years, highlightIndex, showFrom = toFrames(0.6) }) => {
  const r = useReveal(showFrom);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 116,
        left: 96,
        right: 96,
        display: "flex",
        gap: 14,
        opacity: r.opacity,
        transform: `translateY(${r.y}px)`,
      }}
    >
      {years.map((y, i) => {
        const hot = highlightIndex === i;
        return (
          <div
            key={y}
            style={{
              flex: 1,
              padding: "14px 0",
              textAlign: "center",
              fontFamily: pitchSans,
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: "0.04em",
              color: hot ? colors.bg : colors.dim,
              background: hot ? colors.accent : "transparent",
              border: `1px solid ${hot ? colors.accent : colors.rule}`,
              borderRadius: 999,
            }}
          >
            {y}
          </div>
        );
      })}
    </div>
  );
};

// ─── Section eyebrow (small uppercase tag, used inside slides) ──────────────

export const SectionEyebrow: React.FC<{
  children: React.ReactNode;
  showFrom?: number;
  top?: string;
  left?: string;
  color?: string;
}> = ({ children, showFrom = toFrames(0.05), top = "16%", left = "5%", color = colors.accent }) => {
  const r = useReveal(showFrom);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        opacity: r.opacity,
        transform: `translateY(${r.y}px)`,
        fontFamily: pitchSans,
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 28,
          height: 2,
          background: color,
        }}
      />
      {children}
    </div>
  );
};

// ─── Background — keeps the slide canvas crisp ───────────────────────────────

export const SlideBg: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>{children}</AbsoluteFill>
);

// ─── Subtle radial glow used behind hero text (slide-1 vibe) ────────────────

export const HeroGlow: React.FC<{ tint?: string }> = ({ tint = colors.accent }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at 30% 50%, ${tint}26 0%, transparent 55%)`,
    }}
  />
);
