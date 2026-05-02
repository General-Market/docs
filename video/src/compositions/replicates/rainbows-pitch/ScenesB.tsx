import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { BlueGradient, LightGradient, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";
import { VillainPanels, type PanelOpacities } from "./villainPanels";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#000000";
const STRIKE_RED = "#ff2a2a";

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.2,
  display: "inline-block",
};

/* ════════════════════════════════════════════════════════
   Scene 06 — Starburst counter  (72 frames = 3s @ 24fps)
   Counter 0 → 500,000  + "exclusive markets"
   sub-caption: "only tradable with rainbows"
   Flanked by two scrolling logo bands.
   ════════════════════════════════════════════════════════ */

const STARBURST_COUNT = 14;
const STARBURST_MAX_LENGTH = 700;

// ── Logo card definitions for the side bands ──
type BandCard = {
  id: string;
  display: string;
  logoFile: string | null; // null → fallback colored square
  brandBg: string;
  accent: string;
  value: string;
  changePct: number;
  // 16-24 hardcoded sparkline values, normalized 0..1 within the card
  spark: number[];
};

// Synthetic sparklines — chosen to look believable per brand.
const RIGHT_BAND: BandCard[] = [
  {
    id: "github",
    display: "GitHub",
    logoFile: "source-imgs/logo-github.webp",
    brandBg: "#1b1b1b",
    accent: "#7ee787",
    value: "284M",
    changePct: 2.8,
    spark: [0.32, 0.34, 0.33, 0.36, 0.40, 0.41, 0.44, 0.48, 0.50, 0.53, 0.58, 0.61, 0.65, 0.68, 0.72, 0.76, 0.80, 0.84, 0.86, 0.88],
  },
  {
    id: "defillama",
    display: "DeFiLlama",
    logoFile: "source-imgs/logo-defillama.webp",
    brandBg: "#1a1f2e",
    accent: "#ff007a",
    value: "$94.2B",
    changePct: 1.2,
    spark: [0.50, 0.52, 0.48, 0.55, 0.60, 0.58, 0.62, 0.55, 0.50, 0.48, 0.52, 0.58, 0.65, 0.70, 0.68, 0.72, 0.78, 0.74, 0.76, 0.80],
  },
  {
    id: "npm",
    display: "NPM",
    logoFile: "source-imgs/logo-npm.webp",
    brandBg: "#cb3837",
    accent: "#cb3837",
    value: "3.1B/wk",
    changePct: 0.6,
    spark: [0.60, 0.62, 0.61, 0.63, 0.62, 0.64, 0.63, 0.65, 0.64, 0.66, 0.65, 0.67, 0.66, 0.68, 0.67, 0.69, 0.68, 0.70, 0.69, 0.71],
  },
  {
    id: "espn",
    display: "ESPN",
    logoFile: "source-imgs/logo-espn.webp",
    brandBg: "#d00",
    accent: "#d00",
    value: "1.4M",
    changePct: -0.4,
    spark: [0.55, 0.58, 0.62, 0.60, 0.65, 0.70, 0.66, 0.62, 0.58, 0.55, 0.50, 0.48, 0.52, 0.55, 0.50, 0.45, 0.48, 0.50, 0.46, 0.44],
  },
];

const LEFT_BAND: BandCard[] = [
  {
    id: "bitcoin",
    display: "Bitcoin",
    logoFile: "source-imgs/logo-bitcoin.webp",
    brandBg: "#f7931a",
    accent: "#f7931a",
    value: "$108,500",
    changePct: 4.2,
    spark: [0.45, 0.55, 0.40, 0.65, 0.30, 0.60, 0.50, 0.75, 0.55, 0.80, 0.62, 0.85, 0.70, 0.90, 0.78, 0.92, 0.82, 0.88, 0.85, 0.95],
  },
  {
    id: "cloudflare",
    display: "Cloudflare",
    logoFile: "source-imgs/logo-cloudflare.webp",
    brandBg: "#f38020",
    accent: "#f38020",
    value: "99.99%",
    changePct: 0.0,
    spark: [0.62, 0.61, 0.63, 0.62, 0.61, 0.64, 0.62, 0.30, 0.62, 0.63, 0.61, 0.62, 0.63, 0.62, 0.61, 0.64, 0.62, 0.63, 0.61, 0.62],
  },
  {
    id: "nasdaq",
    display: "NASDAQ",
    logoFile: "source-imgs/grab-nasdaq.webp", // logo-nasdaq.webp does not exist
    brandBg: "#000",
    accent: "#0085c7",
    value: "21,402",
    changePct: 1.4,
    spark: [0.40, 0.42, 0.45, 0.43, 0.48, 0.50, 0.52, 0.55, 0.53, 0.58, 0.60, 0.62, 0.65, 0.63, 0.68, 0.70, 0.72, 0.75, 0.78, 0.80],
  },
  {
    id: "hackernews",
    display: "Hacker News",
    logoFile: "source-imgs/logo-hackernews.webp",
    brandBg: "#ff6600",
    accent: "#ff6600",
    value: "412K",
    changePct: 1.8,
    spark: [0.40, 0.45, 0.50, 0.48, 0.55, 0.52, 0.60, 0.65, 0.62, 0.70, 0.68, 0.74, 0.72, 0.78, 0.76, 0.82, 0.80, 0.85, 0.83, 0.88],
  },
];

function buildScene06Proxies() {
  return {
    intro: { opacity: 0, y: 15 },
    counter: { value: 0, opacity: 0, scale: 0 },
    starburst: { length: 80, opacity: 0 },
    caption: { opacity: 0, y: 12 },
    subCaption: { opacity: 0, y: 12 },
    bands: { opacity: 0 },
  };
}

const scene06Init = buildScene06Proxies();

const formatThousands = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ── Monotone cubic helper (copied from FeaturedSourceCards) ──
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const tg: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  tg.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) {
      tg[i] = 0;
      tg[i + 1] = 0;
      continue;
    }
    const a = tg[i] / m[i];
    const b = tg[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tg[i] = t * a * m[i];
      tg[i + 1] = t * b * m[i];
    }
  }
  const parts = [`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i] / 3;
    parts.push(
      `C${(pts[i].x + d).toFixed(2)},${(pts[i].y + tg[i] * d).toFixed(2)} ${(
        pts[i + 1].x - d
      ).toFixed(2)},${(pts[i + 1].y - tg[i + 1] * d).toFixed(2)} ${pts[i + 1].x.toFixed(
        2,
      )},${pts[i + 1].y.toFixed(2)}`,
    );
  }
  return parts.join(" ");
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const CARD_W = 280;
const CARD_H = 180;

const SourceMiniCard: React.FC<{ card: BandCard }> = ({ card }) => {
  // Sparkline geometry
  const W = CARD_W - 28;
  const H = 56;
  const pts = card.spark.map((v, i) => ({
    x: (i / (card.spark.length - 1)) * W,
    y: H * (1 - v) + 4,
  }));
  const linePath = monotonePath(pts);
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${(H + 4).toFixed(2)} L ${pts[0].x.toFixed(2)},${(H + 4).toFixed(2)} Z`;
  const trendUp = card.changePct >= 0;
  const trendColor = trendUp ? "#059669" : "#DC2626";
  const changeText = card.changePct === 0
    ? "0.00%"
    : `${trendUp ? "+" : ""}${card.changePct.toFixed(2)}%`;

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        background: `linear-gradient(180deg, ${card.accent}10 0%, #ffffff 35%, #ffffff 100%)`,
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        boxShadow: "0 18px 40px rgba(15,23,42,0.12), 0 3px 10px rgba(15,23,42,0.05)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${card.accent}, ${card.accent}55)`,
        }}
      />
      {/* Header — logo + brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 6px" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: card.brandBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.06)",
            flexShrink: 0,
            color: "#fff",
            fontWeight: 800,
            fontFamily,
            fontSize: 16,
          }}
        >
          {card.logoFile ? (
            <Img
              src={staticFile(card.logoFile)}
              style={{ maxWidth: "78%", maxHeight: "62%", objectFit: "contain" }}
            />
          ) : (
            card.display.charAt(0)
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily,
              fontSize: 15,
              fontWeight: 800,
              color: "#0a0a0a",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {card.display}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              color: trendColor,
              marginTop: 2,
            }}
          >
            {changeText}
          </div>
        </div>
      </div>
      {/* Sparkline */}
      <div style={{ flex: 1, padding: "0 14px 6px", position: "relative" }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H + 8}`}
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`spark-${card.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={card.accent} stopOpacity={0.32} />
              <stop offset="100%" stopColor={card.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#spark-${card.id})`} />
          <path
            d={linePath}
            fill="none"
            stroke={card.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {/* Footer value */}
      <div
        style={{
          padding: "0 12px 8px",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily,
            fontSize: 11,
            fontWeight: 600,
            color: "#71717a",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          live
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 14,
            fontWeight: 800,
            color: "#0a0a0a",
          }}
        >
          {card.value}
        </span>
      </div>
    </div>
  );
};

const ScrollingBand: React.FC<{
  cards: BandCard[];
  direction: "up" | "down";
  side: "left" | "right";
  opacity: number;
}> = ({ cards, direction, side, opacity }) => {
  const frame = useCurrentFrame();
  const speed = 1.2;
  const gap = 24;
  const cycleHeight = (CARD_H + gap) * cards.length;
  // wrap offset to [0, cycleHeight) so the triple-list never exits the clipping container.
  const raw = frame * speed;
  const wrapped = ((raw % cycleHeight) + cycleHeight) % cycleHeight;
  const offset = direction === "up" ? -wrapped : wrapped - cycleHeight;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 300,
        opacity,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        pointerEvents: "none",
      }}
    >
      {/* Soft top/bottom mask so cards fade at edges */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(245,245,245,1) 0%, rgba(245,245,245,0) 12%, rgba(245,245,245,0) 88%, rgba(245,245,245,1) 100%)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap,
          paddingTop: 24,
          transform: `translateY(${offset}px)`,
        }}
      >
        {[...cards, ...cards, ...cards].map((card, i) => (
          <SourceMiniCard key={`${card.id}-${i}`} card={card} />
        ))}
      </div>
    </div>
  );
};

export const Scene06_Starburst: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "And" enters at 0
      tl.to(p.intro, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.0);

      // Counter scales in
      tl.to(p.counter, { opacity: 1, duration: 0.15 }, 0.4);
      tl.to(p.counter, { scale: 1, duration: 0.55, ease: "back.out(1.7)" }, 0.4);
      tl.to(p.counter, { value: 500000, duration: 1.1, ease: "power2.out" }, 0.5);

      // Starburst lines — trimmed so they don't crash into the bands
      tl.to(p.starburst, { opacity: 1, duration: 0.15 }, 0.6);
      tl.to(p.starburst, { length: STARBURST_MAX_LENGTH, duration: 1.6, ease: "power2.out" }, 0.6);

      // Side bands fade in alongside the counter
      tl.to(p.bands, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.4);

      // "exclusive markets"
      tl.to(p.caption, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, 1.55);

      // "only tradable with rainbows" sub-caption — last
      tl.to(p.subCaption, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, 2.05);
    },
    scene06Init,
  );

  return (
    <AbsoluteFill>
      <LightGradient />
      <AbsoluteFill>
        {/* Top label */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: `translate(-50%, ${s.intro.y}px)`,
            opacity: s.intro.opacity,
          }}
        >
          <span style={{ ...baseText, fontSize: 110, color: BLUE }}>And</span>
        </div>

        {/* Starburst lines */}
        <div
          style={{
            position: "absolute",
            top: "44%",
            left: "50%",
            width: 0,
            height: 0,
            opacity: s.starburst.opacity,
          }}
        >
          {Array.from({ length: STARBURST_COUNT }, (_, i) => {
            const angle = (360 / STARBURST_COUNT) * i;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: Math.min(s.starburst.length, STARBURST_MAX_LENGTH),
                  height: 4,
                  backgroundColor: BLUE,
                  transformOrigin: "0% 50%",
                  transform: `rotate(${angle}deg) translateX(120px)`,
                  opacity: 0.45,
                }}
              />
            );
          })}
        </div>

        {/* Side scrolling logo bands */}
        <ScrollingBand cards={LEFT_BAND} direction="down" side="left" opacity={s.bands.opacity} />
        <ScrollingBand cards={RIGHT_BAND} direction="up" side="right" opacity={s.bands.opacity} />

        {/* Counter */}
        <div
          style={{
            position: "absolute",
            top: "44%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${Math.max(s.counter.scale, 0)})`,
            textAlign: "center",
            opacity: s.counter.opacity,
            whiteSpace: "nowrap",
            zIndex: 3,
          }}
        >
          <div style={{ ...baseText, fontSize: 260, color: BLUE }}>
            {formatThousands(s.counter.value)}
          </div>
        </div>

        {/* "exclusive markets" caption */}
        <div
          style={{
            position: "absolute",
            top: "70%",
            left: "50%",
            transform: `translate(-50%, ${s.caption.y}px)`,
            opacity: s.caption.opacity,
            whiteSpace: "nowrap",
            zIndex: 3,
          }}
        >
          <span style={{ ...baseText, fontSize: 130, color: BLUE }}>
            exclusive markets
          </span>
        </div>

        {/* sub-caption */}
        <div
          style={{
            position: "absolute",
            top: "82%",
            left: "50%",
            transform: `translate(-50%, ${s.subCaption.y}px)`,
            opacity: s.subCaption.opacity,
            whiteSpace: "nowrap",
            zIndex: 3,
          }}
        >
          <span
            style={{
              ...baseText,
              fontSize: 56,
              fontWeight: 400,
              fontStyle: "italic",
              color: BLUE,
            }}
          >
            only tradable with rainbows
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   Scene 07 — Big "Removing" + villains struck through
   (156 frames = 6.5s @ 24fps — absorbs the old Scene 05)
   "Removing" headline lands first, villains stagger underneath.
   ════════════════════════════════════════════════════════ */

const VILLAINS = [
  "frontrunners",
  "orderbook spoofers",
  "illegal insiders",
  "market manipulators",
] as const;

function buildScene07Proxies() {
  const init: Record<string, Record<string, number>> = {};
  VILLAINS.forEach((_, i) => {
    init[`row_${i}`] = { opacity: 0, x: -50, dim: 1 };
    init[`strike_${i}`] = { scaleX: 0, glow: 0 };
    init[`dot_${i}`] = { opacity: 0, scale: 0 };
    // One opacity per panel — exactly one is up at any moment.
    init[`panel_${i}`] = { opacity: 0 };
  });
  init.title = { opacity: 0, y: 22 };
  return init;
}

const scene07Init = buildScene07Proxies();

type Scene07PanelsComponent = React.FC<{
  opacities: PanelOpacities;
  frame: number;
  spoofIntensity: number;
}>;

export const Scene07_TransactionQueue: React.FC<{
  Panels?: Scene07PanelsComponent;
}> = ({ Panels = VillainPanels }) => {
  const frame = useCurrentFrame();
  const s = useGsapProxy(
    (tl, p) => {
      // Big "Removing" lands first
      tl.to(p.title, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.0);

      // First panel (frontrunners) crossfades in alongside the title so the
      // left column is never empty.
      tl.to(p.panel_0, { opacity: 1, duration: 0.45, ease: "power2.out" }, 0.15);

      // Villains stagger underneath. Panel `i` rises as row `i` appears,
      // panel `i-1` falls at the same moment.
      const ROW_INTERVAL = 1.18;
      const VILLAIN_START = 0.7;
      VILLAINS.forEach((_, i) => {
        const start = VILLAIN_START + i * ROW_INTERVAL;
        tl.to(p[`row_${i}`], { opacity: 1, x: 0, duration: 0.36, ease: "power3.out" }, start);
        tl.to(p[`strike_${i}`], { scaleX: 1, duration: 0.42, ease: "power2.inOut" }, start + 0.32);
        tl.to(p[`strike_${i}`], { glow: 1, duration: 0.18, ease: "power2.out" }, start + 0.32);
        tl.to(p[`strike_${i}`], { glow: 0.45, duration: 0.5, ease: "power2.in" }, start + 0.5);
        tl.to(p[`dot_${i}`], { opacity: 1, scale: 1, duration: 0.18, ease: "back.out(2)" }, start + 0.34);
        tl.to(p[`row_${i}`], { dim: 0.42, duration: 0.4, ease: "power2.in" }, start + 0.78);
        // Cross-fade panels: panel i rises, prior panel falls.
        if (i > 0) {
          tl.to(p[`panel_${i - 1}`], { opacity: 0, duration: 0.25, ease: "power2.in" }, start);
          tl.to(p[`panel_${i}`], { opacity: 1, duration: 0.25, ease: "power2.out" }, start);
        }
      });
    },
    scene07Init,
  );

  const panelOpacities: PanelOpacities = [
    s.panel_0.opacity,
    s.panel_1.opacity,
    s.panel_2.opacity,
    s.panel_3.opacity,
  ];
  // Spoof intensity tracks the spoofer panel's visibility so flicker peaks when on-screen.
  const spoofIntensity = s.panel_1.opacity;

  return (
    <AbsoluteFill>
      <BlueGradient />
      {/* Subtle vignette for depth */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,15,60,0.45) 100%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill>
        {/* "Removing" headline — top, tightened to make room for the columns */}
        <div
          style={{
            position: "absolute",
            top: "5%",
            left: "50%",
            transform: `translate(-50%, ${s.title.y}px)`,
            opacity: s.title.opacity,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              ...baseText,
              fontSize: 160,
              color: "#fff",
              textShadow: "0 6px 32px rgba(0,0,0,0.4)",
            }}
          >
            Removing
          </span>
        </div>

        {/* Left column — per-villain panel, cross-fades with each strike */}
        <div
          style={{
            position: "absolute",
            top: "27%",
            left: "5%",
          }}
        >
          <Panels opacities={panelOpacities} frame={frame} spoofIntensity={spoofIntensity} />
        </div>

        {/* Right column — villain stack */}
        <div
          style={{
            position: "absolute",
            top: "33%",
            left: "53%",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            alignItems: "flex-start",
          }}
        >
          {VILLAINS.map((villain, i) => {
            const row = s[`row_${i}`];
            const strike = s[`strike_${i}`];
            const dot = s[`dot_${i}`];
            return (
              <div
                key={villain}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  opacity: row.opacity * row.dim,
                  transform: `translateX(${row.x}px)`,
                  filter: `saturate(${0.4 + 0.6 * row.dim})`,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: STRIKE_RED,
                    boxShadow: `0 0 14px ${STRIKE_RED}, 0 0 28px rgba(255,42,42,0.4)`,
                    opacity: dot.opacity,
                    transform: `scale(${dot.scale})`,
                    flexShrink: 0,
                  }}
                />
                <div style={{ position: "relative", display: "inline-block", paddingRight: 14 }}>
                  <span
                    style={{
                      ...baseText,
                      fontSize: 76,
                      fontWeight: 800,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      textShadow: "0 4px 24px rgba(0,0,0,0.35)",
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {villain}
                  </span>
                  <div
                    style={{
                      position: "absolute",
                      top: "53%",
                      left: -6,
                      right: -6,
                      height: 6,
                      borderRadius: 3,
                      background: `linear-gradient(90deg, #ff0040 0%, ${STRIKE_RED} 50%, #ff5e2a 100%)`,
                      transform: `scaleX(${strike.scaleX}) rotate(-2.2deg)`,
                      transformOrigin: "0% 50%",
                      boxShadow: `0 0 ${20 + strike.glow * 24}px rgba(255,42,42,${0.4 + strike.glow * 0.5})`,
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   Scene 08 — Asset grid  (60 frames = 2.5s @ 24fps)
   2×2 of frosted-glass tiles, each containing one asset class.
   ════════════════════════════════════════════════════════ */

const ASSETS = [
  { label: "Stocks", accent: "#7ee0ff" },
  { label: "Crypto", accent: "#ffb84d" },
  { label: "Predictions", accent: "#ff6cf3" },
  { label: "Memecoins", accent: "#9bff7e" },
] as const;

function buildScene08Proxies() {
  const init: Record<string, Record<string, number>> = {};
  ASSETS.forEach((_, i) => {
    init[`tile_${i}`] = { opacity: 0, y: 25, scale: 0.92 };
  });
  return init;
}

const scene08Init = buildScene08Proxies();

export const Scene08_GridText: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      ASSETS.forEach((_, i) => {
        const start = 0.1 + i * 0.28;
        tl.to(
          p[`tile_${i}`],
          { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "back.out(1.5)" },
          start,
        );
      });
    },
    scene08Init,
  );

  return (
    <AbsoluteFill>
      <BlueGradient />
      <GridOverlay color="rgba(255,255,255,0.16)" />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,15,60,0.4) 100%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: 36,
            width: 1280,
            height: 540,
          }}
        >
          {ASSETS.map(({ label, accent }, i) => {
            const proxy = s[`tile_${i}`];
            return (
              <div
                key={label}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 22,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow:
                    "0 20px 50px rgba(0,10,40,0.28), inset 0 1px 0 rgba(255,255,255,0.16)",
                  opacity: proxy.opacity,
                  transform: `translateY(${proxy.y}px) scale(${proxy.scale})`,
                  overflow: "hidden",
                }}
              >
                {/* Top accent bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                    opacity: 0.85,
                  }}
                />
                <span
                  style={{
                    ...baseText,
                    fontSize: 110,
                    fontWeight: 800,
                    color: "#fff",
                    letterSpacing: "-0.02em",
                    textShadow: "0 3px 18px rgba(0,0,0,0.3)",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Meta ──

export const sceneBMetas = [
  { id: "RP-Scene06", component: Scene06_Starburst, durationInFrames: 72 },
  { id: "RP-Scene07", component: Scene07_TransactionQueue, durationInFrames: 156 },
  { id: "RP-Scene08", component: Scene08_GridText, durationInFrames: 60 },
];
