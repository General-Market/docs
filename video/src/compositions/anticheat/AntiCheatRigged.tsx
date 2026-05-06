import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";

// 5.5s scene. Title block holds on the LEFT for the entire scene:
//   line 1 — exchange name (Base blue, with underline; updates per article)
//   line 2 — "is rigged." (Base blue, hero size; constant)
// Articles flash hard-cut on the RIGHT, with the matching blue underline on
// the article phrase and on the exchange name in the article title.
const SCENE_SECONDS = 5.5;

const TITLE_IN = 0;
const ARTICLES_AT = toFrames(0.4);
const ARTICLE_HOLD = toFrames(0.7);

type Highlight = { x: number; y: number; w: number; h: number };

type ArticleProof = {
  exchange: string;
  category: string;
  image: string;
  highlights: Highlight[];
  exchangeBox?: Highlight;
};

const ARTICLES: ArticleProof[] = [
  {
    exchange: "binance",
    category: "perps",
    image: "insider-trading/articles/1.png",
    highlights: [{ x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 }],
    exchangeBox: { x: 0.045, y: 0.138, w: 0.158, h: 0.045 },
  },
  {
    exchange: "robinhood",
    category: "options",
    image: "insider-trading/articles/9.png",
    highlights: [{ x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 }],
    exchangeBox: { x: 0.110, y: 0.146, w: 0.195, h: 0.048 },
  },
  {
    exchange: "polymarket",
    category: "predictions",
    image: "insider-trading/articles/3.png",
    highlights: [
      { x: 0.6467, y: 0.2828, w: 0.2445, h: 0.0273 },
      { x: 0.5126, y: 0.3313, w: 0.1197, h: 0.0281 },
    ],
    exchangeBox: { x: 0.045, y: 0.283, w: 0.205, h: 0.040 },
  },
  {
    exchange: "pump.fun",
    category: "launchpads",
    image: "insider-trading/articles/4.png",
    highlights: [{ x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 }],
    exchangeBox: { x: 0.040, y: 0.466, w: 0.300, h: 0.060 },
  },
  {
    exchange: "kalshi",
    category: "predictions",
    image: "insider-trading/articles/6.png",
    highlights: [{ x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 }],
    exchangeBox: { x: 0.068, y: 0.176, w: 0.090, h: 0.034 },
  },
  {
    exchange: "coinbase",
    category: "spot",
    image: "insider-trading/articles/7.png",
    highlights: [{ x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 }],
    exchangeBox: { x: 0.610, y: 0.295, w: 0.220, h: 0.043 },
  },
];

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slamT = spring({
    frame: frame - TITLE_IN,
    fps,
    config: { damping: 11, stiffness: 220, mass: 0.7 },
  });
  const verdictOpacity = interpolate(slamT, [0, 1], [0, 1]);
  const verdictScale = interpolate(slamT, [0, 1], [0.78, 1]);
  const verdictPulse = 1 + Math.sin((frame / 45) * Math.PI * 2) * 0.012;

  const articleIdx = Math.max(
    0,
    Math.floor((frame - ARTICLES_AT) / ARTICLE_HOLD),
  );
  const articlesActive =
    frame >= ARTICLES_AT && articleIdx < ARTICLES.length;
  const currentArticle = articlesActive ? ARTICLES[articleIdx] : null;
  const articleStartFrame = ARTICLES_AT + articleIdx * ARTICLE_HOLD;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <DotGrid />

      {/* Left — exchange name + "is rigged." */}
      <div
        style={{
          position: "absolute",
          left: 96,
          width: 720,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {currentArticle && (
          <ExchangeLabel
            key={articleIdx}
            name={currentArticle.exchange}
            startFrame={articleStartFrame}
          />
        )}

        <div
          style={{
            fontFamily: font,
            fontSize: 168,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: colors.accent,
            lineHeight: 0.92,
            opacity: verdictOpacity,
            transform: `scale(${verdictScale * verdictPulse})`,
            transformOrigin: "left center",
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 110,
              height: 110,
              background: colors.accent,
              flexShrink: 0,
            }}
          />
          <span>is rigged.</span>
        </div>
      </div>

      {currentArticle && (
        <ArticleFlash
          article={currentArticle}
          startFrame={articleStartFrame}
        />
      )}

      <DotGridVignette intensity={0.18} />
    </AbsoluteFill>
  );
};

// ─── Exchange label: name + Base-blue underline drawing left → right ──────────

const ExchangeLabel: React.FC<{ name: string; startFrame: number }> = ({
  name,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const punchT = Math.max(0, Math.min(1, local / 4));
  const punchScale = interpolate(punchT, [0, 1], [1.06, 1]);
  const punchOpacity = interpolate(punchT, [0, 1], [0.35, 1]);

  const lineT = Math.max(0, Math.min(1, (local - 1) / 12));
  const lineEased = 1 - Math.pow(1 - lineT, 3);

  return (
    <div style={{ display: "inline-block" }}>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 78,
          fontWeight: 600,
          letterSpacing: "0.01em",
          color: colors.fg,
          lineHeight: 1,
          opacity: punchOpacity,
          transform: `scale(${punchScale})`,
          transformOrigin: "left center",
          position: "relative",
          paddingBottom: 14,
          whiteSpace: "nowrap",
        }}
      >
        {name}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: `${lineEased * 100}%`,
            height: 6,
            background: colors.accent,
            borderRadius: 0,
          }}
        />
      </div>
    </div>
  );
};

// ─── Article flash: hard-cut entry, big size, blue highlighter ────────────────

const ARTICLE_HEIGHT = 880;

const ArticleFlash: React.FC<{
  article: ArticleProof;
  startFrame: number;
}> = ({ article, startFrame }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const punchT = Math.max(0, Math.min(1, local / 4));
  const punchScale = interpolate(punchT, [0, 1], [1.04, 1]);
  const punchOpacity = interpolate(punchT, [0, 1], [0.35, 1]);

  const highlightReveal = Math.max(0, Math.min(1, (local - 1) / 6));

  const tilt = ((startFrame * 7919) % 100) / 100 - 0.5;

  return (
    <div
      style={{
        position: "absolute",
        right: 60,
        top: "50%",
        transform: "translateY(-50%)",
        width: 1080,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          background: colors.surface,
          padding: 22,
          borderRadius: 10,
          boxShadow:
            "0 0 0 1px rgba(10,12,18,0.10), 0 24px 48px rgba(10,12,18,0.18)",
          transform: `rotate(${tilt * 0.4}deg) scale(${punchScale})`,
          opacity: punchOpacity,
        }}
      >
        <div style={{ position: "relative", display: "block" }}>
          <Img
            src={staticFile(article.image)}
            style={{
              height: ARTICLE_HEIGHT,
              width: "auto",
              maxWidth: 1040,
              objectFit: "contain",
              display: "block",
              borderRadius: 4,
            }}
          />
          <BlueHighlightLayer
            highlights={article.highlights}
            reveal={highlightReveal}
          />
          {article.exchangeBox && (
            <ExchangeNameUnderline
              box={article.exchangeBox}
              reveal={highlightReveal}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Exchange-name underline inside the article: a clean blue stroke ─────────

const ExchangeNameUnderline: React.FC<{
  box: Highlight;
  reveal: number;
}> = ({ box, reveal }) => {
  const local = Math.max(0, Math.min(1, reveal));
  const overshootX = 0.004;
  const overshootW = 0.008;

  return (
    <div
      style={{
        position: "absolute",
        left: `${(box.x - overshootX) * 100}%`,
        top: `${(box.y + box.h * 0.95) * 100}%`,
        width: `${(box.w + overshootW) * local * 100}%`,
        height: `${Math.max(0.008, box.h * 0.20) * 100}%`,
        background: colors.accent,
        borderRadius: 0,
        pointerEvents: "none",
        transform: "skewX(-2deg)",
        transformOrigin: "left center",
      }}
    />
  );
};

// ─── Blue highlighter — flat, ink-style, no multiply/screen blends ───────────

const BlueHighlightLayer: React.FC<{
  highlights: Highlight[];
  reveal: number;
}> = ({ highlights, reveal }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {highlights.map((h, idx) => {
        const stagger = idx * 0.12;
        const local = Math.max(
          0,
          Math.min(1, (reveal - stagger) / Math.max(0.01, 1 - stagger)),
        );
        const overshootX = 0.006;
        const overshootW = 0.012;
        const padY = h.h * 0.18;
        const top = h.y - padY;
        const heightPct = h.h + padY * 2;
        return (
          <React.Fragment key={idx}>
            {/* Translucent blue ink — multiply so the article text reads through */}
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX) * 100}%`,
                top: `${top * 100}%`,
                width: `${(h.w + overshootW) * local * 100}%`,
                height: `${heightPct * 100}%`,
                background: "rgba(0, 82, 255, 0.30)",
                mixBlendMode: "multiply",
                borderRadius: 1,
                transform: "skewX(-3deg) rotate(-0.4deg)",
                transformOrigin: "left center",
              }}
            />
            {/* Solid kick line beneath */}
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX * 0.6) * 100}%`,
                top: `${(h.y + h.h * 0.92) * 100}%`,
                width: `${(h.w + overshootW * 0.6) * local * 100}%`,
                height: `${Math.max(0.008, h.h * 0.22) * 100}%`,
                background: colors.accent,
                borderRadius: 1,
                transform: "skewX(-2deg)",
                transformOrigin: "left center",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const antiCheatRiggedMeta = {
  id: "AntiCheatRigged",
  component: AntiCheatRigged,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
