import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ArticlePage, type ArticleContent } from "./ArticlePage";
import { ACCENT, FPS, H, SANS, SANS_TEXT, W } from "./theme";

/* ── The facts ──────────────────────────────────────────────────────────────
 * Polymarket earmarked ~$5M in liquidity incentives for April 2026, spread
 * across its ~17,000 markets — ≈ $290 to keep one market liquid for the month.
 * Run a billion markets the same way and the bill is $290B. The diagram nests
 * Polymarket's tiny, costly box inside the billion-market field General Market
 * addresses, with the linear cost drawn as a single climbing arrow.           */
const SPEND = 5_000_000;
const MARKETS = 17_218;
const PER_MARKET = Math.round(SPEND / MARKETS / 10) * 10; // ≈ $290 / market
const BILLION = 1_000_000_000;
const TOTAL_COST = PER_MARKET * BILLION; // 290,000,000,000

const TOTAL = 360;

const RED = "#FF453A"; // iOS systemRed — the cost
const SKY = "#5AC8FA";
const INK_LIGHT = "#F4F6FA";

// diagram geometry, in frame coordinates
const BIG = { x: 96, y: 84, w: 1728, h: 912, r: 30 };
const SMALL = { x: 150, y: 648, w: 472, h: 300, r: 18 };
const ARROW_FROM = { x: SMALL.x + SMALL.w - 8, y: SMALL.y + 36 };
const ARROW_TO = { x: BIG.x + BIG.w - 78, y: BIG.y + 118 };

const POLY_ARTICLE: ArticleContent = {
  headline: "Polymarket Earmarks $5M in Liquidity Incentives for April",
  byline: "Olivia Raeburn",
  dateline: "April 28, 2026 at 11:02 AM EST",
  paragraphs: [
    [
      "Polymarket will pay out ",
      { mark: "$5 million in liquidity incentives", at: 296 },
      " this month — the largest single-month rewards budget in the venue’s history.",
    ],
    [
      "The program spans the platform’s ",
      { mark: "roughly 17,000 markets", at: 312 },
      ", paying market makers to keep order books deep across sports, politics and crypto.",
    ],
    [
      "Spread across the book, that budget works out to ",
      { mark: "about $290 per market", at: 328 },
      " for the month — a cost that recurs with every market listed.",
    ],
    [
      "Hand-curated markets do not come for free. The bill grows with the catalogue, and the catalogue is the product.",
    ],
  ],
};

const money = (v: number): string => {
  if (v >= 1e9) {
    const b = v / 1e9;
    return `$${b >= 100 ? Math.round(b) : b.toFixed(1)}B`;
  }
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
};

const clamp = (frame: number, range: [number, number], out: [number, number] = [0, 1]) =>
  interpolate(frame, range, out, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** A rounded rectangle whose stroke draws itself in as `draw` goes 0→1. */
const DrawnRect: React.FC<{
  rect: { x: number; y: number; w: number; h: number; r: number };
  color: string;
  strokeW: number;
  draw: number;
  glow?: number;
}> = ({ rect, color, strokeW, draw, glow }) => (
  <rect
    x={rect.x}
    y={rect.y}
    width={rect.w}
    height={rect.h}
    rx={rect.r}
    ry={rect.r}
    fill="none"
    stroke={color}
    strokeWidth={strokeW}
    strokeLinecap="round"
    pathLength={1}
    strokeDasharray={`${draw} 1`}
    opacity={draw <= 0.002 ? 0 : 1}
    style={glow ? { filter: `drop-shadow(0 0 ${glow}px ${color})` } : undefined}
  />
);

/** A straight arrow that draws shaft-then-head as `draw` goes 0→1. */
const Arrow: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  width: number;
  draw: number;
  head?: number;
}> = ({ from, to, color, width, draw, head = 30 }) => {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const a1 = ang + Math.PI - 0.42;
  const a2 = ang + Math.PI + 0.42;
  const headOp = clamp(draw, [0.82, 1]);
  return (
    <g style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} opacity={draw <= 0.002 ? 0 : 1}>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${draw} 1`}
      />
      <path
        d={`M ${to.x + Math.cos(a1) * head} ${to.y + Math.sin(a1) * head} L ${to.x} ${to.y} L ${to.x + Math.cos(a2) * head} ${to.y + Math.sin(a2) * head}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={headOp}
      />
    </g>
  );
};

export const MarketCostScale: React.FC = () => {
  const frame = useCurrentFrame();

  // reveal envelopes
  const smallDraw = clamp(frame, [14, 48]);
  const smallBrand = clamp(frame, [36, 62]);
  const fiveM = clamp(frame, [52, 78]);
  const bigDraw = clamp(frame, [78, 134]);
  const bigBrand = clamp(frame, [120, 150]);
  const arrowDraw = interpolate(frame, [150, 246], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const costRoll = interpolate(frame, [152, 246], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const costValue = SPEND + costRoll * (TOTAL_COST - SPEND);
  const costLabel = clamp(frame, [158, 182]);

  // focus pull → the article as the source
  const overlayOp = interpolate(frame, [0, 272, 300], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const overlayScale = interpolate(frame, [272, 300], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const articleBlur = interpolate(frame, [0, 272, 300], [26, 26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const artScroll = clamp(frame, [288, 360], [0, 40]);
  const artOp = clamp(frame, [352, 360], [1, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill>
        <ArticlePage
          article={POLY_ARTICLE}
          scroll={artScroll}
          opacity={artOp}
          fullBlurPx={articleBlur}
          bottomBlur
          showChrome
        />
      </AbsoluteFill>

      {overlayOp > 0.001 && (
        <AbsoluteFill
          style={{
            opacity: overlayOp,
            transform: `scale(${overlayScale})`,
            background: "rgba(9,11,16,0.86)",
          }}
        >
          {/* strokes + arrows */}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
            <DrawnRect rect={BIG} color="rgba(255,255,255,0.9)" strokeW={3} draw={bigDraw} glow={10} />
            <DrawnRect rect={SMALL} color={ACCENT} strokeW={3} draw={smallDraw} glow={12} />
            {/* the runaway cost, climbing from Polymarket's box to the far corner */}
            <Arrow from={ARROW_FROM} to={ARROW_TO} color={RED} width={6} draw={arrowDraw} head={34} />
          </svg>

          {/* big box brand — General Market */}
          <div
            style={{
              position: "absolute",
              left: BIG.x + 40,
              top: BIG.y + 34,
              opacity: bigBrand,
              transform: `translateY(${(1 - bigBrand) * 12}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Img src={staticFile("article-2/gm-logo-white.svg")} style={{ width: 52, height: 52 }} />
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: 30,
                  color: "rgba(255,255,255,0.92)",
                  letterSpacing: "-0.4px",
                }}
              >
                General Market
              </span>
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 72,
                lineHeight: 1.04,
                letterSpacing: "-2px",
                color: INK_LIGHT,
                marginTop: 12,
              }}
            >
              1,000,000,000 markets
            </div>
            <div
              style={{
                fontFamily: SANS_TEXT,
                fontSize: 26,
                color: "rgba(255,255,255,0.5)",
                marginTop: 2,
                letterSpacing: "0.2px",
              }}
            >
              the world’s markets
            </div>
          </div>

          {/* small box brand — Polymarket */}
          <div
            style={{
              position: "absolute",
              left: SMALL.x + 26,
              top: SMALL.y + 22,
              opacity: smallBrand,
              transform: `translateY(${(1 - smallBrand) * 8}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Img
                src={staticFile("article-2/logo-polymarket.png")}
                style={{ width: 34, height: 34, borderRadius: 8 }}
              />
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: 24,
                  color: "rgba(255,255,255,0.92)",
                  letterSpacing: "-0.3px",
                }}
              >
                Polymarket
              </span>
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 32,
                color: SKY,
                marginTop: 8,
                letterSpacing: "-0.4px",
              }}
            >
              17,000 markets
            </div>
          </div>

          {/* the $5M inside the small box */}
          <div
            style={{
              position: "absolute",
              left: SMALL.x,
              top: SMALL.y + SMALL.h - 132,
              width: SMALL.w,
              textAlign: "center",
              opacity: fiveM,
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 104,
                lineHeight: 1,
                letterSpacing: "-4px",
                color: INK_LIGHT,
                textShadow: "0 4px 22px rgba(0,0,0,0.55)",
              }}
            >
              $5M
            </div>
            <div
              style={{
                fontFamily: SANS_TEXT,
                fontSize: 22,
                color: "rgba(255,255,255,0.6)",
                marginTop: -2,
                letterSpacing: "0.2px",
              }}
            >
              spent in April
            </div>
          </div>

          {/* the climax cost, riding the big arrow */}
          <div
            style={{
              position: "absolute",
              left: 1010,
              top: 360,
              opacity: costLabel,
              transform: `translateY(${(1 - costLabel) * 14}px)`,
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 158,
                lineHeight: 1,
                letterSpacing: "-5px",
                color: RED,
                textShadow: `0 8px 44px ${RED}55`,
              }}
            >
              {money(costValue)}
            </div>
            <div
              style={{
                fontFamily: SANS_TEXT,
                fontSize: 30,
                color: "rgba(255,255,255,0.72)",
                marginTop: 6,
                letterSpacing: "-0.2px",
              }}
            >
              <span style={{ color: SKY, fontWeight: 700 }}>$290</span> per market, a billion times over
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const marketCostScaleMeta = {
  id: "MarketCostScale",
  component: MarketCostScale,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};
