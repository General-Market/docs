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

const FPS = 30;
const DURATION = 300;

type Brand =
  | { kind: "wordmark"; src: string; pad?: number }
  | { kind: "composite"; icon: string; name: string; accent: string };

type Highlight = { x: number; y: number; w: number; h: number };

type Article = {
  image: string;
  brand: Brand;
  highlights?: Highlight[];
};

const ARTICLES: Article[] = [
  {
    image: "insider-trading/articles/1.png",
    brand: { kind: "wordmark", src: "logos/exchanges/binance.svg", pad: 36 },
    highlights: [
      { x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 },
    ],
  },
  {
    image: "insider-trading/articles/2.png",
    brand: { kind: "wordmark", src: "logos/exchanges/coinbase.svg", pad: 40 },
    highlights: [
      { x: 0.4075, y: 0.2758, w: 0.1564, h: 0.0352 },
      { x: 0.6036, y: 0.3375, w: 0.3384, h: 0.0461 },
    ],
  },
  {
    image: "insider-trading/articles/3.png",
    brand: {
      kind: "wordmark",
      src: "logos/exchanges/polymarket-black.svg",
      pad: 40,
    },
    highlights: [
      { x: 0.6467, y: 0.2828, w: 0.2445, h: 0.0273 },
      { x: 0.5126, y: 0.3313, w: 0.1197, h: 0.0281 },
    ],
  },
  {
    image: "insider-trading/articles/4.png",
    brand: {
      kind: "composite",
      icon: "logos/exchanges/pumpfun.png",
      name: "pump.fun",
      accent: "#18c27a",
    },
    highlights: [
      { x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 },
    ],
  },
  {
    image: "insider-trading/articles/6.png",
    brand: { kind: "wordmark", src: "logos/exchanges/kalshi.svg", pad: 22 },
    highlights: [
      { x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 },
    ],
  },
  {
    image: "insider-trading/articles/7.png",
    brand: { kind: "wordmark", src: "logos/exchanges/coinbase.svg", pad: 40 },
    highlights: [
      { x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 },
    ],
  },
  {
    image: "insider-trading/articles/8.png",
    brand: { kind: "wordmark", src: "logos/exchanges/nyse.svg", pad: 32 },
    highlights: [
      { x: 0.0522, y: 0.5101, w: 0.3917, h: 0.0519 },
    ],
  },
  {
    image: "insider-trading/articles/9.png",
    brand: { kind: "wordmark", src: "logos/exchanges/robinhood.svg", pad: 40 },
    highlights: [
      { x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 },
    ],
  },
];

const INTRO_FRAMES = 10;
const STRIDE = 26;
const ON_STAGE = 34;

const BADGE_W = 860;
const BADGE_H = 260;

const BrandPlate: React.FC<{ brand: Brand; appear: number }> = ({
  brand,
  appear,
}) => {
  if (brand.kind === "wordmark") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: brand.pad ?? 32,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile(brand.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  // composite
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "0 44px",
        boxSizing: "border-box",
      }}
    >
      <Img
        src={staticFile(brand.icon)}
        style={{
          height: "72%",
          width: "auto",
          objectFit: "contain",
        }}
      />
      <span
        style={{
          fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 120,
          letterSpacing: "-0.03em",
          color: "#0a0a0a",
          opacity: appear,
        }}
      >
        {brand.name}
      </span>
    </div>
  );
};

const BrandBadge: React.FC<{ brand: Brand; appear: number }> = ({
  brand,
  appear,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: -BADGE_H / 2,
        transform: `translateX(-50%) scale(${0.85 + 0.15 * appear})`,
        width: BADGE_W,
        height: BADGE_H,
        borderRadius: BADGE_H / 2,
        background: "#fafaf7",
        boxShadow: `0 30px 80px rgba(0,0,0,${
          0.6 * appear
        }), 0 0 0 14px #0a0a0a`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BrandPlate brand={brand} appear={appear} />
    </div>
  );
};

const HighlightLayer: React.FC<{
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
        const stagger = idx * 0.18;
        const local = Math.max(
          0,
          Math.min(1, (reveal - stagger) / Math.max(0.01, 1 - stagger)),
        );
        const overshootX = 0.008;
        const overshootW = 0.016;
        const padY = h.h * 0.22;
        const top = h.y - padY;
        const heightPct = h.h + padY * 2;
        return (
          <React.Fragment key={idx}>
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX) * 100}%`,
                top: `${top * 100}%`,
                width: `${(h.w + overshootW) * local * 100}%`,
                height: `${heightPct * 100}%`,
                background:
                  "linear-gradient(180deg, rgba(255,241,82,0.55) 0%, rgba(255,224,38,0.72) 45%, rgba(255,224,38,0.72) 55%, rgba(255,241,82,0.55) 100%)",
                mixBlendMode: "multiply",
                borderRadius: 3,
                transform: "skewX(-5deg) rotate(-0.8deg)",
                transformOrigin: "left center",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX) * 100}%`,
                top: `${top * 100}%`,
                width: `${(h.w + overshootW) * local * 100}%`,
                height: `${heightPct * 100}%`,
                background:
                  "linear-gradient(180deg, rgba(255,241,82,0.45) 0%, rgba(255,224,38,0.55) 45%, rgba(255,224,38,0.55) 55%, rgba(255,241,82,0.45) 100%)",
                mixBlendMode: "screen",
                borderRadius: 3,
                transform: "skewX(-5deg) rotate(-0.8deg)",
                transformOrigin: "left center",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX * 0.6) * 100}%`,
                top: `${(h.y + h.h * 0.92) * 100}%`,
                width: `${(h.w + overshootW * 0.6) * local * 100}%`,
                height: `${Math.max(0.008, h.h * 0.22) * 100}%`,
                background: "#ff2b44",
                borderRadius: 2,
                transform: "skewX(-3deg) rotate(-0.4deg)",
                transformOrigin: "left center",
                boxShadow: "0 0 6px rgba(255,43,68,0.45)",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ArticleFrame: React.FC<{
  article: Article;
  appear: number;
  tilt: number;
  highlightReveal: number;
}> = ({ article, appear, tilt, highlightReveal }) => {
  const maxH = 980;
  return (
    <div
      style={{
        position: "relative",
        background: "#fafaf7",
        padding: 18,
        borderRadius: 14,
        boxShadow: `0 ${40 * appear}px ${80 * appear}px rgba(0,0,0,${
          0.55 * appear
        }), 0 2px 8px rgba(0,0,0,${0.3 * appear})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <div style={{ position: "relative", display: "block" }}>
        <Img
          src={staticFile(article.image)}
          style={{
            height: maxH,
            width: "auto",
            maxWidth: 1400,
            objectFit: "contain",
            display: "block",
            borderRadius: 4,
          }}
        />
        {article.highlights && article.highlights.length > 0 ? (
          <HighlightLayer
            highlights={article.highlights}
            reveal={highlightReveal}
          />
        ) : null}
      </div>
      <BrandBadge brand={article.brand} appear={appear} />
    </div>
  );
};

export const InsiderCases: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgFade = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const outroFade = interpolate(frame, [DURATION - 12, DURATION], [1, 0.88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#0a0a0a",
        opacity: bgFade * outroFade,
      }}
    >
      {ARTICLES.map((article, i) => {
        const start = INTRO_FRAMES + i * STRIDE;
        const local = frame - start;
        const isLast = i === ARTICLES.length - 1;

        if (local < -10) return null;
        if (!isLast && local > ON_STAGE + 10) return null;

        const entrance = spring({
          frame: local,
          fps,
          config: { damping: 16, mass: 0.9, stiffness: 130 },
          durationInFrames: 22,
        });

        const opacity = isLast
          ? interpolate(local, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(local, [0, 6, ON_STAGE, ON_STAGE + 8], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

        const lift = interpolate(
          local,
          [0, isLast ? DURATION : ON_STAGE + 8],
          [28, -14],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const tilt = (i % 2 === 0 ? 1 : -1) * 0.6;
        const scale = 0.92 + 0.08 * entrance;

        const highlightReveal = interpolate(local, [10, 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <AbsoluteFill
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity,
              transform: `translateY(${lift}px) scale(${scale})`,
            }}
          >
            <ArticleFrame
              article={article}
              appear={opacity}
              tilt={tilt}
              highlightReveal={highlightReveal}
            />
          </AbsoluteFill>
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

export const insiderCasesMeta = {
  id: "InsiderCases",
  component: InsiderCases,
  durationInFrames: DURATION,
  fps: FPS,
  width: 1920,
  height: 1080,
};
