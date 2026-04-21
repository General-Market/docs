import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SOURCES } from "../launch/data/sources";
import { InsiderPitch, PITCH_DURATION } from "./InsiderPitch";

const FPS = 30;
const LOGO_REVEAL_START = 260;
const LOGO_REVEAL_FADE = 18;
const PITCH_START = LOGO_REVEAL_START + 48; // logo sits ~1.6s, then pitch begins
const PITCH_FADE_IN = 14;
const DURATION = PITCH_START + PITCH_DURATION + 6;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

type Brand =
  | { kind: "wordmark"; src: string; pad?: number }
  | { kind: "composite"; icon: string; name: string; accent: string };

type Highlight = { x: number; y: number; w: number; h: number };

type Article = {
  image: string;
  brand: Brand;
  highlights?: Highlight[];
  background: string;
};

const ARTICLES: Article[] = [
  {
    image: "insider-trading/articles/1.png",
    brand: { kind: "wordmark", src: "logos/exchanges/binance.svg", pad: 36 },
    highlights: [
      { x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 },
    ],
    background: "insider-trading/backgrounds/binance.jpg",
  },
  {
    image: "insider-trading/articles/2.png",
    brand: { kind: "wordmark", src: "logos/exchanges/coinbase.svg", pad: 40 },
    highlights: [
      { x: 0.4075, y: 0.2758, w: 0.1564, h: 0.0352 },
      { x: 0.6036, y: 0.3375, w: 0.3384, h: 0.0461 },
    ],
    background: "insider-trading/backgrounds/coinbase.png",
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
    background: "insider-trading/backgrounds/polymarket.jpg",
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
    background: "insider-trading/backgrounds/pumpfun.jpg",
  },
  {
    image: "insider-trading/articles/5.png",
    brand: { kind: "wordmark", src: "logos/exchanges/cftc.svg", pad: 28 },
    highlights: [
      { x: 0.6477, y: 0.3550, w: 0.1375, h: 0.0280 },
    ],
    background: "insider-trading/backgrounds/nyse.jpg",
  },
  {
    image: "insider-trading/articles/6.png",
    brand: { kind: "wordmark", src: "logos/exchanges/kalshi.svg", pad: 22 },
    highlights: [
      { x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 },
    ],
    background: "insider-trading/backgrounds/kalshi.jpg",
  },
  {
    image: "insider-trading/articles/7.png",
    brand: { kind: "wordmark", src: "logos/exchanges/coinbase.svg", pad: 40 },
    highlights: [
      { x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 },
    ],
    background: "insider-trading/backgrounds/coinbase.png",
  },
  {
    image: "insider-trading/articles/8.png",
    brand: { kind: "wordmark", src: "logos/exchanges/nyse.svg", pad: 32 },
    highlights: [
      { x: 0.0522, y: 0.5101, w: 0.3917, h: 0.0519 },
    ],
    background: "insider-trading/backgrounds/nyse.jpg",
  },
  {
    image: "insider-trading/articles/9.png",
    brand: { kind: "wordmark", src: "logos/exchanges/robinhood.svg", pad: 40 },
    highlights: [
      { x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 },
    ],
    background: "insider-trading/backgrounds/robinhood.png",
  },
];

const INTRO_FRAMES = 10;
const STRIDE = 26;
const ON_STAGE = 34;

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

const InfoPanel: React.FC<{
  brand: Brand;
  appear: number;
  index: number;
  total: number;
}> = ({ brand, appear, index, total }) => {
  return (
    <div
      style={{
        width: 460,
        alignSelf: "stretch",
        background: "rgba(10,10,10,0.82)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 18,
        padding: "44px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 32,
        boxShadow: `0 ${42 * appear}px ${82 * appear}px rgba(0,0,0,${
          0.55 * appear
        })`,
        fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,43,68,0.16)",
            border: "1px solid rgba(255,43,68,0.55)",
            color: "#ff5566",
            padding: "9px 16px",
            borderRadius: 999,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 2.4,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ff2b44",
              boxShadow: "0 0 8px #ff2b44",
            }}
          />
          INSIDER TRADING
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: 3.2,
          }}
        >
          CASE {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: "#fafaf7",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 220,
          padding: 18,
        }}
      >
        <BrandPlate brand={brand} appear={appear} />
      </div>
      <div
        style={{
          color: "rgba(255,255,255,0.38)",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: 2.6,
          borderTop: "1px solid rgba(255,255,255,0.09)",
          paddingTop: 18,
          textAlign: "center",
        }}
      >
        EXCHANGE · REGULATORY RECORD
      </div>
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
  index: number;
  total: number;
}> = ({ article, appear, tilt, highlightReveal, index, total }) => {
  const maxH = 820;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        gap: 44,
        transform: `rotate(${tilt * 0.25}deg)`,
      }}
    >
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
        }}
      >
        <div style={{ position: "relative", display: "block" }}>
          <Img
            src={staticFile(article.image)}
            style={{
              height: maxH,
              width: "auto",
              maxWidth: 980,
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
      </div>
      <InfoPanel
        brand={article.brand}
        appear={appear}
        index={index}
        total={total}
      />
    </div>
  );
};

const STAR_PATH =
  "M300 20 C300 165, 165 300, 20 300 C165 300, 300 435, 300 580 C300 435, 435 300, 580 300 C435 300, 300 165, 300 20Z";

const STAR_MASK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><path d='${STAR_PATH}' fill='white'/></svg>`;
const STAR_MASK_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  STAR_MASK_SVG,
)}")`;

const MEGA_TILT_X = 14;
const MEGA_SCROLL_SPEED = 0.7;
const MOSAIC: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  perspective: 1800,
  perspectiveOrigin: "50% 48%",
};

const MegaGrid: React.FC<{ scrollY: number }> = ({ scrollY }) => {
  const cols = 12;
  const rows = 12;
  const count = cols * rows;

  return (
    <div style={MOSAIC}>
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 2,
          padding: 2,
          transform: `rotateX(${MEGA_TILT_X}deg) scale(1.25) translateY(${-scrollY}px)`,
          transformStyle: "preserve-3d",
          filter: "saturate(0.92) brightness(0.95)",
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const source = SOURCES[i % SOURCES.length];
          const logoSrc = source.logo.startsWith("/")
            ? source.logo.slice(1)
            : source.logo;
          return (
            <div
              key={i}
              style={{
                background: source.bg,
                borderRadius: 3,
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 4,
              }}
            >
              <Img
                src={staticFile(logoSrc)}
                style={{
                  maxWidth: "82%",
                  maxHeight: "82%",
                  objectFit: "contain",
                }}
              />
            </div>
          );
        })}
      </AbsoluteFill>
    </div>
  );
};

/**
 * Mosaic lives inside the GM star. Start: mask is huge — the star exceeds the
 * frame, so the grid reads as a full-screen tilted wall. Zoom out: the star
 * shrinks to a centered logo, revealing the mosaic was always inside it.
 * Final beats: the tiles fade into the solid white lockup underneath.
 */
const InsiderLogoReveal: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame);

  // Mask zooms from well past screen diagonal (~2200 px) down to the final
  // logo size. EASE_OUT gives a cinema pull-back feel.
  const maskSize = interpolate(t, [0, 58], [3600, 300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  // Tiles fade into the solid lockup on the tail so the final frame reads
  // as a clean white star — not a mosaic confetti.
  const gridOpacity = interpolate(t, [46, 68], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Solid white star emerges beneath the mosaic; invisible until the tiles
  // thin out.
  const starFill = interpolate(t, [48, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scrollY = t * MEGA_SCROLL_SPEED;

  const maskStyle: React.CSSProperties = {
    maskImage: STAR_MASK_URL,
    WebkitMaskImage: STAR_MASK_URL,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: `${maskSize}px ${maskSize}px`,
    WebkitMaskSize: `${maskSize}px ${maskSize}px`,
  };

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      {/* Solid white star — the destination state. Sits under the mosaic
          and materialises as the tiles fade. */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: starFill,
        }}
      >
        <svg
          width={300}
          height={300}
          viewBox="0 0 600 600"
          style={{
            filter:
              "drop-shadow(0 0 32px rgba(255,255,255,0.35)) drop-shadow(0 8px 48px rgba(0,0,0,0.6))",
          }}
        >
          <path d={STAR_PATH} fill="#ffffff" />
        </svg>
      </AbsoluteFill>

      {/* Mosaic, clipped to the star silhouette. The SVG mask shrinks over
          time — that's the zoom-out. */}
      <AbsoluteFill style={{ ...maskStyle, opacity: gridOpacity }}>
        <MegaGrid scrollY={scrollY} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const InsiderCases: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgFade = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const outroFade = interpolate(frame, [DURATION - 18, DURATION], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const articleHide = interpolate(
    frame,
    [LOGO_REVEAL_START, LOGO_REVEAL_START + LOGO_REVEAL_FADE],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const logoHide = interpolate(
    frame,
    [PITCH_START, PITCH_START + PITCH_FADE_IN],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pitchFadeIn = interpolate(
    frame,
    [PITCH_START, PITCH_START + PITCH_FADE_IN],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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

        if (local < -20) return null;
        if (!isLast && local > ON_STAGE + 20) return null;

        const bgOpacity = isLast
          ? interpolate(local, [-10, 4], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(
              local,
              [-10, 4, ON_STAGE - 4, ON_STAGE + 14],
              [0, 1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );

        if (bgOpacity <= 0) return null;

        const kenBurns = interpolate(
          local,
          [-10, isLast ? DURATION : ON_STAGE + 14],
          [1.0, 1.03],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const bgBrightness = 0.85;

        return (
          <AbsoluteFill
            key={`bg-${i}`}
            style={{
              opacity: bgOpacity * (isLast ? articleHide : 1),
              background: "#0a0a0a",
            }}
          >
            <Img
              src={staticFile(article.background)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${kenBurns})`,
                transformOrigin: "center",
                filter: `blur(4px) saturate(0.95) brightness(${bgBrightness})`,
              }}
            />
          </AbsoluteFill>
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.18) 0%, rgba(10,10,10,0.05) 40%, rgba(10,10,10,0.30) 100%)",
        }}
      />

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
              opacity: opacity * (isLast ? articleHide : 1),
              transform: `translateY(${lift}px) scale(${scale})`,
            }}
          >
            <ArticleFrame
              article={article}
              appear={opacity}
              tilt={tilt}
              highlightReveal={highlightReveal}
              index={i}
              total={ARTICLES.length}
            />
          </AbsoluteFill>
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
          opacity: articleHide,
        }}
      />

      {frame >= LOGO_REVEAL_START && frame < PITCH_START + PITCH_FADE_IN + 2 ? (
        <AbsoluteFill style={{ opacity: logoHide }}>
          <InsiderLogoReveal startFrame={LOGO_REVEAL_START} />
        </AbsoluteFill>
      ) : null}

      {frame >= PITCH_START ? (
        <AbsoluteFill style={{ opacity: pitchFadeIn }}>
          <InsiderPitch startFrame={PITCH_START} />
        </AbsoluteFill>
      ) : null}
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
