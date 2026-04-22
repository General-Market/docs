import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { SOURCES } from "../launch/data/sources";
import { InsiderPitch, PITCH_DURATION } from "./InsiderPitch";

const interFamily = loadInter("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "900"],
}).fontFamily;

// Wise design tokens — near-black + wiseGreen lime, Inter 900 as Wise Sans
// fallback, line-height 0.85, calt feature on. Matches the tutorial theme.
const WISE = {
  nearBlack: "#0e0f0c",
  wiseGreen: "#9fe870",
  darkGreen: "#163300",
  white: "#ffffff",
} as const;

const FPS = 30;
// Beat-synced anchors (articles-phase-local frames). Derived from the 143.5 BPM
// track; each value is a beat timestamp shifted by -PROLOGUE_DURATION (the
// articles phase lives in a Sequence from=PROLOGUE_DURATION, so its local
// frame 0 == music time 4.0s).
const LOGO_REVEAL_START = 184; // music beat at 6.124s (comp ~0:10.1)
const LOGO_REVEAL_FADE = 7;    // fast crossover — articles → logo
const PITCH_START = 223;       // music beat at 7.424s — logo dwells ~1.3s
const PITCH_FADE_IN = 10;

// ─── Prologue — 4s. Micro-onsets from librosa (first 3.65s of the track,
//     30fps comp frames). Each onset = a cut. Advance per cut = gap-since-
//     previous-onset × acceleration-weight, so drops (sparse onsets) push
//     the broll forward hard, while fast rolls (dense onsets) still nudge.
//     startFroms walk monotonically from frame 0 of the full source to
//     its tail; playbackRates bake in a harsh ramp so the broll itself
//     visibly accelerates, not just the cuts.
const PROLOGUE_ONSETS = [1, 5, 20, 32, 45, 58, 80, 96, 100, 103, 107, 109];
const PROLOGUE_DURATION = 120;
const PROLOGUE_SOURCE_TOTAL = 1780; // source frames to traverse (1836 total, margin)
const PROLOGUE_ACCEL_K = 2.2;

const computePrologueCuts = () => {
  const n = PROLOGUE_ONSETS.length;
  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = i === 0 ? 0 : PROLOGUE_ONSETS[i - 1];
    const gap = Math.max(1, PROLOGUE_ONSETS[i] - prev);
    const mult = 1 + PROLOGUE_ACCEL_K * (n === 1 ? 0 : i / (n - 1));
    weights.push(gap * mult);
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  const scale = PROLOGUE_SOURCE_TOTAL / sumW;

  const starts: number[] = [];
  const rates: number[] = [];
  let cum = 0;
  for (let i = 0; i < n; i++) {
    starts.push(Math.round(cum));
    const advance = weights[i] * scale;
    const nextOnset = i < n - 1 ? PROLOGUE_ONSETS[i + 1] : PROLOGUE_DURATION;
    const duration = Math.max(1, nextOnset - PROLOGUE_ONSETS[i]);
    rates.push(Math.max(0.4, Math.min(16, advance / duration)));
    cum += advance;
  }
  return { starts, rates };
};

const { starts: PROLOGUE_CUT_STARTS, rates: PROLOGUE_CUT_RATES } =
  computePrologueCuts();
const HARSH_EASE = Easing.bezier(0.88, 0, 0.08, 1);

const MAIN_DURATION = PITCH_START + PITCH_DURATION + 6;
const DURATION = PROLOGUE_DURATION + MAIN_DURATION;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// Wise lime used for the typer character entry animation, replacing the old
// rose tone. Characters flare wiseGreen, then settle to white.
const TYPER_ENTRY: [number, number, number] = [159, 232, 112];
const easeInPow = (t: number, p: number): number =>
  Math.pow(Math.max(0, Math.min(1, t)), p);

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

// Article entrances land every other beat (~0.84s apart). Stride between
// entries stays near the old STRIDE=26, but now snapped to the music.
const ARTICLE_STARTS = [4, 29, 55, 81, 106, 132, 158];
// Beats (articles-local frames) used for per-beat punch on the article row.
// Trimmed at LOGO_REVEAL_START — after that the logo reveal owns the canvas.
const ARTICLE_BEATS = [
  4, 17, 29, 42, 55, 68, 81, 94, 106, 119, 132, 145, 158, 170, 184,
];

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
        gap: 16,
        boxSizing: "border-box",
      }}
    >
      <Img
        src={staticFile(brand.icon)}
        style={{
          height: "64%",
          maxWidth: "36%",
          width: "auto",
          objectFit: "contain",
          display: "block",
        }}
      />
      <span
        style={{
          fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 54,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: "#0a0a0a",
          opacity: appear,
          whiteSpace: "nowrap",
          transform: "translateY(-2px)",
        }}
      >
        {brand.name}
      </span>
    </div>
  );
};

const LogoCard: React.FC<{ brand: Brand; appear: number }> = ({
  brand,
  appear,
}) => {
  return (
    <div
      style={{
        width: 560,
        height: 360,
        background: "#ffffff",
        borderRadius: 30,
        padding: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 0 1px rgba(14,15,12,0.12), 0 ${46 * appear}px ${
          90 * appear
        }px rgba(0,0,0,${0.5 * appear}), 0 2px 10px rgba(0,0,0,${
          0.3 * appear
        })`,
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
  index: number;
  total: number;
}> = ({ article, appear, tilt, highlightReveal }) => {
  const maxH = 960;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 68,
        transform: `rotate(${tilt * 0.25}deg)`,
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          padding: 20,
          borderRadius: 30,
          boxShadow: `0 0 0 1px rgba(14,15,12,0.12), 0 ${46 * appear}px ${
            92 * appear
          }px rgba(0,0,0,${0.55 * appear}), 0 2px 10px rgba(0,0,0,${
            0.3 * appear
          })`,
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
              maxWidth: 1180,
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
      <LogoCard brand={article.brand} appear={appear} />
    </div>
  );
};

// General Market lockup — seven stacked bars centered in a 102×102 field.
// Lifted directly from /frontend/public/logo.svg. Used as both the zoom-out
// mask AND the solid-fill destination state.
const GM_LOGO_PATHS = [
  "M15.2794 49.5703C15.2794 49.1458 15.4181 48.7941 15.6956 48.5155C15.9731 48.2369 16.3233 48.0976 16.7462 48.0976H28.7186C29.1414 48.0976 29.4916 48.2369 29.7691 48.5155C30.0466 48.7941 30.1854 49.1458 30.1854 49.5703V52.5955C30.1854 53.0201 30.0466 53.3717 29.7691 53.6503C29.4916 53.929 29.1414 54.0683 28.7186 54.0683H16.7462C16.3233 54.0683 15.9731 53.929 15.6956 53.6503C15.4181 53.3717 15.2794 53.0201 15.2794 52.5955V49.5703Z",
  "M26.6227 49.5703C26.6227 49.1458 26.7615 48.7941 27.039 48.5155C27.3165 48.2369 27.6667 48.0976 28.0895 48.0976H40.0619C40.4848 48.0976 40.835 48.2369 41.1125 48.5155C41.39 48.7941 41.5288 49.1458 41.5288 49.5703V52.5955C41.5288 53.0201 41.39 53.3717 41.1125 53.6503C40.835 53.929 40.4848 54.0683 40.0619 54.0683H28.0895C27.6667 54.0683 27.3165 53.929 27.039 53.6503C26.7615 53.3717 26.6227 53.0201 26.6227 52.5955V49.5703Z",
  "M37.9661 49.5703C37.9661 49.1458 38.1048 48.7941 38.3824 48.5155C38.6599 48.2369 39.01 48.0976 39.4329 48.0976H51.4053C51.8282 48.0976 52.1784 48.2369 52.4559 48.5155C52.7334 48.7941 52.8721 49.1458 52.8721 49.5703V52.5955C52.8721 53.0201 52.7334 53.3717 52.4559 53.6503C52.1784 53.929 51.8282 54.0683 51.4053 54.0683H39.4329C39.01 54.0683 38.6599 53.929 38.3824 53.6503C38.1048 53.3717 37.9661 53.0201 37.9661 52.5955V49.5703Z",
  "M49.3095 49.5703C49.3095 49.1458 49.4482 48.7941 49.7257 48.5155C50.0032 48.2369 50.3534 48.0976 50.7763 48.0976H62.7487C63.1716 48.0976 63.5217 48.2369 63.7992 48.5155C64.0768 48.7941 64.2155 49.1458 64.2155 49.5703V52.5955C64.2155 53.0201 64.0768 53.3717 63.7992 53.6503C63.5217 53.929 63.1716 54.0683 62.7487 54.0683H50.7763C50.3534 54.0683 50.0032 53.929 49.7257 53.6503C49.4482 53.3717 49.3095 53.0201 49.3095 52.5955V49.5703Z",
  "M60.6528 49.5902C60.6528 49.1657 60.7916 48.814 61.0691 48.5354C61.3466 48.2568 61.6968 48.1175 62.1197 48.1175H68.423C68.8459 48.1175 69.1961 48.2568 69.4736 48.5354C69.7511 48.814 69.8898 49.1657 69.8898 49.5902V52.5955C69.8898 53.0201 69.7511 53.3717 69.4736 53.6503C69.1961 53.929 68.8459 54.0683 68.423 54.0683H62.1197C61.6968 54.0683 61.3466 53.929 61.0691 53.6503C60.7916 53.3717 60.6528 53.0201 60.6528 52.5955V49.5902Z",
  "M66.3245 49.5703C66.3245 49.1458 66.4633 48.7941 66.7408 48.5155C67.0183 48.2369 67.3685 48.0976 67.7913 48.0976H79.7637C80.1866 48.0976 80.5368 48.2369 80.8143 48.5155C81.0918 48.7941 81.2306 49.1458 81.2306 49.5703V52.5955C81.2306 53.0201 81.0918 53.3717 80.8143 53.6503C80.5368 53.929 80.1866 54.0683 79.7637 54.0683H67.7913C67.3685 54.0683 67.0183 53.929 66.7408 53.6503C66.4633 53.3717 66.3245 53.0201 66.3245 52.5955V49.5703Z",
  "M77.6679 49.5902C77.6679 49.1657 77.8066 48.814 78.0841 48.5354C78.3617 48.2568 78.7118 48.1175 79.1347 48.1175H85.4381C85.8609 48.1175 86.2111 48.2568 86.4886 48.5354C86.7661 48.814 86.9049 49.1657 86.9049 49.5902V52.5955C86.9049 53.0201 86.7661 53.3717 86.4886 53.6503C86.2111 53.929 85.8609 54.0683 85.4381 54.0683H79.1347C78.7118 54.0683 78.3617 53.929 78.0841 53.6503C77.8066 53.3717 77.6679 53.0201 77.6679 52.5955V49.5902Z",
];

const GM_LOGO_MASK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 102 102'>${GM_LOGO_PATHS.map(
  (d) => `<path d='${d}' fill='white'/>`,
).join("")}</svg>`;
const GM_LOGO_MASK_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  GM_LOGO_MASK_SVG,
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
 * Mosaic lives inside the GM lockup. The seven bars of /logo.svg occupy only
 * a thin horizontal strip of the 102×102 viewBox — so the mask has to start
 * enormous (~14000 px) to bleed the bars beyond the frame and read as a
 * full-screen mosaic wall. Pull-back: mask shrinks to ~620 px; the bars
 * become distinct strips (mid-zoom), then a centered GM mark (final).
 * Closer to the end, the tiles fade into the solid white lockup.
 */
const InsiderLogoReveal: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame);

  const maskSize = interpolate(t, [0, 60], [14000, 620], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  const gridOpacity = interpolate(t, [50, 72], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoFill = interpolate(t, [52, 74], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scrollY = t * MEGA_SCROLL_SPEED;

  const maskStyle: React.CSSProperties = {
    maskImage: GM_LOGO_MASK_URL,
    WebkitMaskImage: GM_LOGO_MASK_URL,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: `${maskSize}px ${maskSize}px`,
    WebkitMaskSize: `${maskSize}px ${maskSize}px`,
  };

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      {/* Solid white General Market lockup — the destination state. Sits
          under the mosaic and materialises as the tiles fade. Same 102×102
          viewBox as the mask so bar geometry matches perfectly. */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoFill,
        }}
      >
        <svg
          width={620}
          height={620}
          viewBox="0 0 102 102"
          style={{
            filter:
              "drop-shadow(0 0 24px rgba(255,255,255,0.35)) drop-shadow(0 8px 48px rgba(0,0,0,0.6))",
          }}
        >
          {GM_LOGO_PATHS.map((d, i) => (
            <path key={i} d={d} fill="#ffffff" />
          ))}
        </svg>
      </AbsoluteFill>

      {/* Mosaic, clipped to the GM bars. SVG mask shrinks — that's the
          zoom-out. */}
      <AbsoluteFill style={{ ...maskStyle, opacity: gridOpacity }}>
        <MegaGrid scrollY={scrollY} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Wise-style pill title — near-black background, Inter 900 white text,
// wiseGreen highlight on the accent phrase. Full pill radius, ring shadow.
// Sits above the article card so it reads against any background.
const ArticlesTitle: React.FC<{ hide: number }> = ({ hide }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [6, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const lift = interpolate(frame, [6, 24], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  // Green highlight block grows left-to-right just after the pill lands.
  const highlight = interpolate(frame, [18, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: 56,
        opacity: appear * hide,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          background: WISE.nearBlack,
          borderRadius: 40,
          padding: "34px 64px 38px",
          boxShadow:
            "0 0 0 1px rgba(14,15,12,0.12), 0 22px 60px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.35)",
          transform: `translateY(${lift}px)`,
          fontFamily: interFamily,
          fontFeatureSettings: '"calt" 1',
          fontWeight: 900,
          fontSize: 120,
          lineHeight: 0.85,
          letterSpacing: "-0.03em",
          color: WISE.white,
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        <span>Every Exchanges Concede</span>
        <span
          style={{
            position: "relative",
            color: WISE.darkGreen,
            display: "inline-block",
            padding: "0 10px",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: "-4%",
              bottom: "-8%",
              width: `${highlight * 100}%`,
              background: WISE.wiseGreen,
              borderRadius: 10,
              zIndex: 0,
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>
            Insider Trading
          </span>
        </span>
      </div>
    </AbsoluteFill>
  );
};

const InsiderArticlesPhase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgFade = interpolate(frame, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const outroFade = interpolate(frame, [MAIN_DURATION - 18, MAIN_DURATION], [1, 0], {
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

  // Per-beat punch on the articles backdrop: find the most recent beat
  // still within a short decay window and raise contrast/brightness. Subtle
  // enough not to fight the entrance springs; enough to feel the music.
  let beatPunch = 0;
  for (let i = ARTICLE_BEATS.length - 1; i >= 0; i--) {
    const b = ARTICLE_BEATS[i];
    if (frame >= b) {
      const d = frame - b;
      if (d < 6) beatPunch = Math.pow(1 - d / 6, 1.4);
      break;
    }
  }

  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        opacity: bgFade * outroFade,
      }}
    >
      <AbsoluteFill
        style={{
          filter: `saturate(${1.04 + beatPunch * 0.15}) contrast(${1.08 + beatPunch * 0.08}) brightness(${0.96 + beatPunch * 0.09})`,
          transform: `scale(${1 + beatPunch * 0.006})`,
          transformOrigin: "50% 50%",
        }}
      >
      {ARTICLES.map((article, i) => {
        const start = ARTICLE_STARTS[i] ?? (INTRO_FRAMES + i * STRIDE);
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
          [-10, isLast ? MAIN_DURATION : ON_STAGE + 14],
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
                filter: `grayscale(1) blur(4px) saturate(0.9) brightness(${bgBrightness})`,
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
        const start = ARTICLE_STARTS[i] ?? (INTRO_FRAMES + i * STRIDE);
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
          [0, isLast ? MAIN_DURATION : ON_STAGE + 8],
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

      <ArticlesTitle hide={articleHide} />

      {frame >= LOGO_REVEAL_START && frame < PITCH_START + PITCH_FADE_IN + 2 ? (
        <AbsoluteFill style={{ opacity: logoHide }}>
          <InsiderLogoReveal startFrame={LOGO_REVEAL_START} />
        </AbsoluteFill>
      ) : null}
      </AbsoluteFill>

      {frame >= PITCH_START ? (
        <AbsoluteFill style={{ opacity: pitchFadeIn }}>
          <InsiderPitch startFrame={PITCH_START} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/* ─── Beat-stepped typewriter — chars hold still between onsets, then burst
       in via the same harsh bezier that drives the broll cuts. Each beat
       lifts the visible char count from charsAtBeat[i-1] to charsAtBeat[i]
       over burstFrames. The rose→final color age is derived from the per-
       char appearance frame, so later chars stay warmer longer. ──────── */
const BeatTypewriter: React.FC<{
  text: string;
  revealBeats: number[];
  charsAtBeat: number[];
  burstFrames?: number;
  wipeStart?: number;
  wipeEnd?: number;
  fontSize?: number;
  redRange?: [number, number];
}> = ({
  text,
  revealBeats,
  charsAtBeat,
  burstFrames = 4,
  wipeStart,
  wipeEnd,
  fontSize = 64,
  redRange,
}) => {
  const frame = useCurrentFrame();
  const len = text.length;
  const ws = wipeStart ?? 9999;
  const we = wipeEnd ?? 9999;
  if (frame < revealBeats[0] || frame > we) return null;

  // Wise palette: highlighted range → Wise darkGreen text on wiseGreen block.
  const isHot = (i: number) =>
    !!redRange && i >= redRange[0] && i < redRange[1];
  const finalRGB = (i: number): [number, number, number] =>
    isHot(i) ? [22, 51, 0] : [255, 255, 255];

  const appearFrame = (i: number): number => {
    for (let b = 0; b < revealBeats.length; b++) {
      const prev = b === 0 ? 0 : charsAtBeat[b - 1];
      const target = charsAtBeat[b];
      if (i >= prev && i < target) {
        const span = Math.max(1, target - prev);
        const fraction = (i - prev + 0.5) / span;
        return revealBeats[b] + fraction * burstFrames;
      }
    }
    return revealBeats[revealBeats.length - 1] + burstFrames;
  };

  let beatIdx = 0;
  for (let i = revealBeats.length - 1; i >= 0; i--) {
    if (frame >= revealBeats[i]) {
      beatIdx = i;
      break;
    }
  }
  const prevTarget = beatIdx === 0 ? 0 : charsAtBeat[beatIdx - 1];
  const target = charsAtBeat[beatIdx];
  const timeIn = frame - revealBeats[beatIdx];
  const tBurst = Math.max(0, Math.min(1, timeIn / burstFrames));
  const harshT = HARSH_EASE(tBurst);
  let visibleEnd = Math.round(prevTarget + (target - prevTarget) * harshT);
  let visibleStart = 0;
  let wiping = false;

  if (frame >= ws) {
    wiping = true;
    const t = (frame - ws) / Math.max(1, we - ws);
    visibleStart = Math.min(len, Math.round(len * easeInPow(t, 2.4)));
    visibleEnd = len;
  }

  if (visibleEnd <= visibleStart) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 140px",
      }}
    >
      <div
        style={{
          fontFamily: interFamily,
          fontFeatureSettings: '"calt" 1',
          fontSize,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          textAlign: "center",
          lineHeight: 0.9,
          color: "white",
          textShadow: "0 6px 30px rgba(0,0,0,0.78)",
          maxWidth: 1560,
        }}
      >
        {text.split("").map((ch, i) => {
          if (i < visibleStart || i >= visibleEnd) return null;
          const display = ch === " " ? " " : ch;
          const [fr, fg, fb] = finalRGB(i);
          const hot = isHot(i);
          const edgeLeft = hot && !isHot(i - 1);
          const edgeRight = hot && !isHot(i + 1);

          const highlightBg = hot
            ? {
                background: WISE.wiseGreen,
                padding: "0.06em 0.02em",
                borderTopLeftRadius: edgeLeft ? 8 : 0,
                borderBottomLeftRadius: edgeLeft ? 8 : 0,
                borderTopRightRadius: edgeRight ? 8 : 0,
                borderBottomRightRadius: edgeRight ? 8 : 0,
                paddingLeft: edgeLeft ? "0.18em" : undefined,
                paddingRight: edgeRight ? "0.18em" : undefined,
                textShadow: "none",
                boxShadow: edgeLeft
                  ? "-2px 0 0 0 rgba(159,232,112,0)"
                  : undefined,
              }
            : null;

          if (wiping) {
            const dist = i - visibleStart;
            const op = interpolate(dist, [0, 2], [0.2, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  color: `rgba(${fr},${fg},${fb},${op})`,
                  ...highlightBg,
                }}
              >
                {display}
              </span>
            );
          }

          const age = frame - appearFrame(i);
          const colorT = interpolate(age, [0, 4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const r = interpolate(colorT, [0, 1], [TYPER_ENTRY[0], fr]);
          const g = interpolate(colorT, [0, 1], [TYPER_ENTRY[1], fg]);
          const b = interpolate(colorT, [0, 1], [TYPER_ENTRY[2], fb]);
          return (
            <span
              key={i}
              style={{ color: `rgb(${r},${g},${b})`, ...highlightBg }}
            >
              {display}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};


/* ─── Per-onset broll shot — harsh bezier decay on cut: tremble, jitter,
       scale punch, heavy Gaussian blur snap, chromatic fringe. Each cut
       carries its own playbackRate so the broll itself accelerates. ─── */
const BeatShot: React.FC<{
  startFromFrame: number;
  playbackRate: number;
}> = ({ startFromFrame, playbackRate }) => {
  const frame = useCurrentFrame();
  const t = Math.min(1, frame / 10);
  const settle = HARSH_EASE(t);
  const punch = 1 - settle;

  const seed = startFromFrame;
  const jx = punch * Math.sin(frame * 19.1 + seed * 0.37) * 10;
  const jy = punch * Math.cos(frame * 15.3 + seed * 0.52) * 10;
  const rot = punch * Math.sin(frame * 22.7 + seed * 0.11) * 1.1;
  const scale = 1.04 + punch * 0.14;
  // Gaussian blur snap: strong on impact, zero by the time it settles.
  const blur = punch * 9;
  // Chromatic aberration — red/cyan fringe that pulses with the cut.
  const chroma = punch * 5;
  const contrast = 1.08 + punch * 0.28;
  const brightness = 0.76 - punch * 0.08;
  const saturation = 0.85 + punch * 0.5;

  const filter = [
    "grayscale(0.28)",
    `contrast(${contrast})`,
    `brightness(${brightness})`,
    `saturate(${saturation})`,
    `blur(${blur}px)`,
    `drop-shadow(${chroma}px 0 0 rgba(255,50,90,0.35))`,
    `drop-shadow(${-chroma}px 0 0 rgba(60,200,255,0.32))`,
  ].join(" ");

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Video
        src={staticFile("insider-trading/broll/dezoom.mp4")}
        startFrom={startFromFrame}
        playbackRate={playbackRate}
        muted
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate(${jx}px, ${jy}px) scale(${scale}) rotate(${rot}deg)`,
          transformOrigin: "50% 50%",
          filter,
        }}
      />
    </AbsoluteFill>
  );
};

/* ─── Animated film grain via SVG turbulence — reseeds every frame so the
       noise texture crawls. Cheap at 1920×1080, only used in the prologue. */
const PrologueGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const filterId = `prologue-grain-${frame}`;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        mixBlendMode: "overlay",
        opacity: 0.22,
      }}
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.92"
          numOctaves="2"
          seed={frame}
          stitchTiles="stitch"
        />
        <feColorMatrix
          values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.2 0"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
};

const InsiderPrologue: React.FC = () => {
  const frame = useCurrentFrame();

  // Curtain fade in/out — tight on the tail so the cut into articles snaps.
  const curtain = interpolate(
    frame,
    [0, 3, PROLOGUE_DURATION - 4, PROLOGUE_DURATION],
    [1, 0, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      {PROLOGUE_ONSETS.map((start, i) => {
        const end = PROLOGUE_ONSETS[i + 1] ?? PROLOGUE_DURATION;
        const len = Math.max(end - start + 3, 4);
        return (
          <Sequence
            key={`onset-${i}`}
            from={start}
            durationInFrames={len}
          >
            <BeatShot
              startFromFrame={PROLOGUE_CUT_STARTS[i] ?? 0}
              playbackRate={PROLOGUE_CUT_RATES[i] ?? 1}
            />
          </Sequence>
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 44%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      {/* Radial vignette — crushes the corners, pushes focus to centre */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 95% 75% at 50% 50%, transparent 28%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Animated film grain */}
      <PrologueGrain />

      {/* Phase 1 — almost instant reveal (8 frames for 32 chars), holds, wipes */}
      {/* Phase 1 — chars stall, then burst in on onsets 1, 5, 20. Holds,
          then wipes left-to-right across the 45→58 beat window. */}
      <BeatTypewriter
        text="The average trader loses $50,000"
        revealBeats={[1, 5, 20]}
        charsAtBeat={[12, 22, 32]}
        burstFrames={4}
        wipeStart={45}
        wipeEnd={58}
        fontSize={62}
        redRange={[25, 32]}
      />

      {/* Phase 2 — quick type (20 frames for 37 chars), then long hold */}
      {/* Phase 2 — larger first beats carry the sentence, the drop cluster
          (onsets 100,103,107,109) fires the last few chars in a rapid tail.
          Hold through the end of the prologue; curtain fades it out. */}
      <BeatTypewriter
        text="to insider traders in their lifetime."
        revealBeats={[58, 80, 96, 100, 103, 107, 109]}
        charsAtBeat={[3, 12, 22, 26, 30, 34, 37]}
        burstFrames={4}
        fontSize={58}
      />

      {/* Black curtain at both edges */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: curtain,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const InsiderCases: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <Audio src={staticFile("music/insider-cases.mp3")} volume={0.85} />
      <Sequence from={0} durationInFrames={PROLOGUE_DURATION}>
        <InsiderPrologue />
      </Sequence>
      <Sequence from={PROLOGUE_DURATION} durationInFrames={MAIN_DURATION}>
        <InsiderArticlesPhase />
      </Sequence>
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
