import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ArticlePage, type ArticleContent } from "./ArticlePage";
import { ACCENT, FPS, H, SANS, SANS_TEXT, W } from "./theme";

/* ── The facts ──────────────────────────────────────────────────────────────
 * Polymarket earmarked ~$5M in liquidity incentives for April 2026, spread
 * across its ~17,000 markets. That is ≈ $290 to keep one market liquid for the
 * month. Run a billion markets the same way and the bill is $290B.            */
const SPEND = 5_000_000;
const MARKETS = 17_218;
const PER_MARKET = Math.round(SPEND / MARKETS / 10) * 10; // ≈ $290 / market
const BILLION = 1_000_000_000;
const TOTAL_COST = PER_MARKET * BILLION; // 290,000,000,000

const TOTAL = 330;

const INK_LIGHT = "#F4F6FA";
const SKY = "#5AC8FA";

/** The Bloomberg story that focus-pulls into view as the source at the end. */
const POLY_ARTICLE: ArticleContent = {
  headline: "Polymarket Earmarks $5M in Liquidity Incentives for April",
  byline: "Olivia Raeburn",
  dateline: "April 28, 2026 at 11:02 AM EST",
  paragraphs: [
    [
      "Polymarket will pay out ",
      { mark: "$5 million in liquidity incentives", at: 262 },
      " this month — the largest single-month rewards budget in the venue’s history.",
    ],
    [
      "The program spans the platform’s ",
      { mark: "roughly 17,000 markets", at: 278 },
      ", paying market makers to keep order books deep across sports, politics and crypto.",
    ],
    [
      "Spread across the book, that budget works out to ",
      { mark: "about $290 per market", at: 294 },
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

/* ── The market field ─────────────────────────────────────────────────────────
 * One scaling lattice of dot-grid tiles. We open zoomed in on the centre tile —
 * Polymarket's ~17k markets, $5M — then pull back until that block is a single
 * lit speck in a field that runs off every edge: a billion markets.           */
const TILE = 88; // a market block, in field units
const DOT = 4; // dense inner markets inside the lit block (22 per side)

const Field: React.FC<{ zoom: number; surround: number }> = ({ zoom, surround }) => {
  const frame = useCurrentFrame();
  const glow = 0.42 + 0.26 * (0.5 + 0.5 * Math.sin(frame / 9));

  // The lit block and every field cell share one on-screen size, so the block
  // always sits exactly over the field's centre cell as the camera pulls back.
  const cellPx = TILE * zoom;
  const blockBorder = Math.max(2, 2 * zoom);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* the billion-market field — a vast grid of cells, hidden while we open
          on the single block, then materialising as the camera pulls back. The
          grid is drawn at the on-screen cell size directly (no nested scale),
          so its lines never collapse to sub-pixel. */}
      <AbsoluteFill
        style={{
          opacity: surround,
          WebkitMaskImage: "radial-gradient(circle at center, #000 22%, transparent 60%)",
          maskImage: "radial-gradient(circle at center, #000 22%, transparent 60%)",
          backgroundImage: [
            `radial-gradient(circle, rgba(120,170,255,0.32) 0 ${0.05 * cellPx}px, transparent ${0.07 * cellPx}px)`,
            `repeating-linear-gradient(90deg, rgba(255,255,255,0.11) 0 ${Math.max(1, 0.045 * cellPx)}px, transparent ${Math.max(1, 0.045 * cellPx)}px ${cellPx}px)`,
            `repeating-linear-gradient(0deg, rgba(255,255,255,0.11) 0 ${Math.max(1, 0.045 * cellPx)}px, transparent ${Math.max(1, 0.045 * cellPx)}px ${cellPx}px)`,
          ].join(","),
          backgroundSize: `${cellPx}px ${cellPx}px, ${cellPx}px ${cellPx}px, ${cellPx}px ${cellPx}px`,
          // centre a cell on the frame centre: lines fall at ±½cell, dots at cell
          // centres — so the lit block lands exactly inside the middle cell
          backgroundPosition: `calc(50% + ${cellPx / 2}px) calc(50% + ${cellPx / 2}px), calc(50% + ${cellPx / 2}px) calc(50% + ${cellPx / 2}px), calc(50% + ${cellPx / 2}px) calc(50% + ${cellPx / 2}px)`,
        }}
      />

      {/* the lit block — Polymarket's real reach, always the hero square */}
      <div
        style={{
          width: cellPx,
          height: cellPx,
          backgroundColor: "rgba(10,132,255,0.16)",
          border: `${blockBorder}px solid ${SKY}`,
          boxShadow: `0 0 ${24 * Math.sqrt(zoom)}px rgba(10,132,255,${glow}), 0 0 ${56 * Math.sqrt(zoom)}px rgba(10,132,255,${glow * 0.5}), inset 0 0 ${20 * Math.sqrt(zoom)}px rgba(10,132,255,0.35)`,
          backgroundImage: `radial-gradient(circle, rgba(150,205,255,0.95) 0 ${0.28 * DOT * zoom}px, transparent ${0.4 * DOT * zoom}px)`,
          backgroundSize: `${DOT * zoom}px ${DOT * zoom}px`,
          backgroundPosition: `${(DOT * zoom) / 2}px ${(DOT * zoom) / 2}px`,
        }}
      />
    </AbsoluteFill>
  );
};

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = SKY,
}) => (
  <div
    style={{
      fontFamily: SANS_TEXT,
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: "3px",
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </div>
);

export const MarketCostScale: React.FC = () => {
  const frame = useCurrentFrame();

  // focus pull: the dark overlay dissolves and the article snaps into focus
  const articleBlur = interpolate(frame, [0, 244, 272], [26, 26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const overlayOp = interpolate(frame, [0, 248, 272], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const overlayScale = interpolate(frame, [248, 272], [1, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const artScroll = interpolate(frame, [260, 330], [0, 38], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const artOp = interpolate(frame, [320, 330], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // the pull-back: centre block fills the frame, then becomes one speck
  const zoom = interpolate(frame, [100, 208], [7, 0.42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // the billion-market field stays hidden until the camera starts pulling back
  const surround = interpolate(frame, [104, 196], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // beat 1 — the $5M block
  const block = Math.min(
    interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [98, 116], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const blockRise = interpolate(frame, [98, 116], [0, -28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  // beat 2 — the billion-market field + linear cost roll
  const tag = Math.min(
    interpolate(frame, [178, 198], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [250, 266], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const cost = Math.min(
    interpolate(frame, [150, 168], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [250, 266], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const roll = interpolate(frame, [150, 238], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const costValue = SPEND + roll * (TOTAL_COST - SPEND);
  const eqOp = interpolate(frame, [164, 182], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
            background: "rgba(9,11,16,0.82)",
          }}
        >
          <Field zoom={zoom} surround={surround} />

          {/* beat 1 — the block: eyebrow above, caption below, $5M dead centre */}
          {block > 0.001 && (
            <AbsoluteFill style={{ opacity: block, transform: `translateY(${blockRise}px)` }}>
              <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center" }}>
                <Eyebrow>Polymarket · April 2026</Eyebrow>
              </div>
              <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: "-70px -120px",
                      background:
                        "radial-gradient(closest-side, rgba(6,8,12,0.72), rgba(6,8,12,0) 78%)",
                      filter: "blur(10px)",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      fontFamily: SANS,
                      fontWeight: 800,
                      fontSize: 230,
                      lineHeight: 1,
                      letterSpacing: "-6px",
                      color: INK_LIGHT,
                      textShadow: "0 6px 34px rgba(0,0,0,0.65)",
                    }}
                  >
                    $5M
                  </div>
                </div>
              </AbsoluteFill>
              <div
                style={{
                  position: "absolute",
                  bottom: 168,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontFamily: SANS_TEXT,
                  fontSize: 34,
                  color: "rgba(255,255,255,0.82)",
                  letterSpacing: "-0.2px",
                  textShadow: "0 2px 16px rgba(0,0,0,0.6)",
                }}
              >
                ≈ 17,000 markets · liquidity incentives
              </div>
            </AbsoluteFill>
          )}

          {/* beat 2 — the linear price */}
          {cost > 0.001 && (
            <AbsoluteFill
              style={{ justifyContent: "center", alignItems: "center", opacity: cost }}
            >
              <Eyebrow color={SKY}>The cost scales with the count</Eyebrow>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 168,
                  lineHeight: 1,
                  letterSpacing: "-5px",
                  color: INK_LIGHT,
                  marginTop: 12,
                  textShadow: "0 8px 44px rgba(10,132,255,0.4)",
                }}
              >
                {money(costValue)}
              </div>
              <div
                style={{
                  fontFamily: SANS_TEXT,
                  fontSize: 32,
                  color: "rgba(255,255,255,0.66)",
                  marginTop: 10,
                  opacity: eqOp,
                  letterSpacing: "-0.2px",
                }}
              >
                <span style={{ color: ACCENT, fontWeight: 700 }}>$290</span> per market
                {"  ×  "}
                <span style={{ color: ACCENT, fontWeight: 700 }}>1,000,000,000</span> markets
              </div>
              <CostBar progress={roll} opacity={eqOp} />
            </AbsoluteFill>
          )}

          {/* the field's true size, pinned low */}
          {tag > 0.001 && (
            <div
              style={{
                position: "absolute",
                bottom: 96,
                left: 0,
                right: 0,
                textAlign: "center",
                opacity: tag,
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 40,
                letterSpacing: "-0.5px",
                color: INK_LIGHT,
              }}
            >
              1,000,000,000 markets
              <div
                style={{
                  fontFamily: SANS_TEXT,
                  fontSize: 24,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.5)",
                  marginTop: 4,
                  letterSpacing: "0.5px",
                }}
              >
                the open field — one lit block was Polymarket
              </div>
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** A track that fills left→right as the cost rolls — the linear blow-up, made literal. */
const CostBar: React.FC<{ progress: number; opacity: number }> = ({ progress, opacity }) => {
  const TRACK = 940;
  return (
    <div style={{ width: TRACK, marginTop: 30, opacity }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: SANS_TEXT,
          fontSize: 22,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 10,
          letterSpacing: "-0.1px",
        }}
      >
        <span>$5M · 17K markets</span>
        <span>$290B · 1B markets</span>
      </div>
      <div
        style={{
          position: "relative",
          height: 6,
          borderRadius: 6,
          background: "rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${ACCENT}, ${SKY})`,
            borderRadius: 6,
          }}
        />
      </div>
    </div>
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
