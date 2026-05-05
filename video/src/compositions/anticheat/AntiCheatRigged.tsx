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

// Scene timing — 5.5s total.
//
// Title "every market you touched" enters first and stays on top.
// Four articles flash hard-cut, one per market category, each on stage
// ~0.65s with green highlights revealing in 0.2s. After the last article,
// "is rigged" punches in red title font as the verdict.
//
// Articles are pulled from public/insider-trading/articles/ (already in repo).
// Highlight bbox coordinates are reused from InsiderCases.tsx — the original
// yellow highlighter is replaced with a vivid green for this scene.
const SCENE_SECONDS = 5.5;

const TITLE_IN = 0;
const ARTICLES_AT = toFrames(0.5);
const ARTICLE_HOLD = toFrames(0.7);
const VERDICT_AT = ARTICLES_AT + ARTICLE_HOLD * 4 + toFrames(0.2);

const PROOF_GREEN = "#22d97a";
const PROOF_GREEN_LIGHT = "#52ffa2";

type Highlight = { x: number; y: number; w: number; h: number };

type Brand =
  | { kind: "wordmark"; src: string; pad?: number }
  | { kind: "composite"; icon: string; name: string };

type ArticleProof = {
  category: string;
  image: string;
  brand: Brand;
  highlights: Highlight[];
};

const ARTICLES: ArticleProof[] = [
  {
    category: "perps",
    image: "insider-trading/articles/1.png",
    brand: { kind: "wordmark", src: "logos/exchanges/binance.svg", pad: 36 },
    highlights: [{ x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 }],
  },
  {
    category: "options",
    image: "insider-trading/articles/9.png",
    brand: { kind: "wordmark", src: "logos/exchanges/robinhood.svg", pad: 40 },
    highlights: [{ x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 }],
  },
  {
    category: "predictions",
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
    category: "launchpads",
    image: "insider-trading/articles/4.png",
    brand: {
      kind: "composite",
      icon: "logos/exchanges/pumpfun.png",
      name: "pump.fun",
    },
    highlights: [{ x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 }],
  },
];

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title fades + slides in once.
  const titleT = spring({
    frame: frame - TITLE_IN,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const titleOpacity = interpolate(titleT, [0, 1], [0, 1]);
  const titleY = interpolate(titleT, [0, 1], [22, 0]);

  // Title dims slightly when the verdict arrives so "IS RIGGED" can hit harder.
  const titleDim = interpolate(
    frame,
    [VERDICT_AT, VERDICT_AT + toFrames(0.3)],
    [1, 0.45],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Active article index based on frame.
  const articleIdx = Math.min(
    ARTICLES.length - 1,
    Math.max(0, Math.floor((frame - ARTICLES_AT) / ARTICLE_HOLD)),
  );
  const articlesActive =
    frame >= ARTICLES_AT && frame < VERDICT_AT - toFrames(0.05);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      {/* Top-line title */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 96px",
          opacity: titleOpacity * titleDim,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: colors.dim,
            marginBottom: 18,
          }}
        >
          The proof
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: colors.fg,
            lineHeight: 0.95,
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          }}
        >
          every market you touched
        </div>
      </div>

      {/* Article slot — only the currently active article renders */}
      {articlesActive && (
        <ArticleFlash
          article={ARTICLES[articleIdx]}
          startFrame={ARTICLES_AT + articleIdx * ARTICLE_HOLD}
        />
      )}

      {/* Verdict — "is rigged" punches in red */}
      <Verdict />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Article flash: hard-cut entry, fast green highlight reveal ───────────────

const ARTICLE_HEIGHT = 720;

const ArticleFlash: React.FC<{
  article: ArticleProof;
  startFrame: number;
}> = ({ article, startFrame }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  // Snap-in: tiny scale punch in the first 4 frames so the cut feels alive.
  const punchT = Math.max(0, Math.min(1, local / 4));
  const punchScale = interpolate(punchT, [0, 1], [1.04, 1]);
  const punchOpacity = interpolate(punchT, [0, 1], [0.35, 1]);

  // Highlight reveals over 6 frames.
  const highlightReveal = Math.max(
    0,
    Math.min(1, (local - 1) / 6),
  );

  // Tiny tilt — same cinematic gesture as InsiderCases.
  const tilt = ((startFrame * 7919) % 100) / 100 - 0.5; // deterministic per-article

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 220,
        paddingBottom: 180,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          transform: `rotate(${tilt * 0.4}deg) scale(${punchScale})`,
          opacity: punchOpacity,
        }}
      >
        {/* Article card */}
        <div
          style={{
            position: "relative",
            background: "#ffffff",
            padding: 18,
            borderRadius: 24,
            boxShadow:
              "0 0 0 1px rgba(14,15,12,0.12), 0 30px 70px rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ position: "relative", display: "block" }}>
            <Img
              src={staticFile(article.image)}
              style={{
                height: ARTICLE_HEIGHT,
                width: "auto",
                maxWidth: 1100,
                objectFit: "contain",
                display: "block",
                borderRadius: 4,
              }}
            />
            <GreenHighlightLayer
              highlights={article.highlights}
              reveal={highlightReveal}
            />
          </div>
        </div>

        {/* Brand logo card */}
        <BrandCard brand={article.brand} />
      </div>

      {/* Category tag below — the bar-chart label echoed back */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: PROOF_GREEN,
          opacity: punchOpacity,
          textShadow: `0 0 18px rgba(34,217,122,0.45)`,
        }}
      >
        · {article.category} ·
      </div>
    </AbsoluteFill>
  );
};

// ─── Brand card — same primitive as InsiderCases, sized down for fast flash ───

const BrandCard: React.FC<{ brand: Brand }> = ({ brand }) => {
  return (
    <div
      style={{
        width: 360,
        height: 240,
        background: "#ffffff",
        borderRadius: 24,
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow:
          "0 0 0 1px rgba(14,15,12,0.12), 0 24px 60px rgba(0,0,0,0.5)",
      }}
    >
      {brand.kind === "wordmark" ? (
        <Img
          src={staticFile(brand.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: brand.pad ?? 32,
            boxSizing: "border-box",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "100%",
            height: "100%",
          }}
        >
          <Img
            src={staticFile(brand.icon)}
            style={{
              height: "70%",
              maxWidth: "38%",
              width: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
          <span
            style={{
              fontFamily: font,
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "#0a0a0a",
              whiteSpace: "nowrap",
            }}
          >
            {brand.name}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Green highlighter — three-stack of green tones with a darker green kick ──

const GreenHighlightLayer: React.FC<{
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
        const overshootX = 0.008;
        const overshootW = 0.016;
        const padY = h.h * 0.22;
        const top = h.y - padY;
        const heightPct = h.h + padY * 2;
        return (
          <React.Fragment key={idx}>
            {/* Body — multiply blend so the article ink shows through */}
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX) * 100}%`,
                top: `${top * 100}%`,
                width: `${(h.w + overshootW) * local * 100}%`,
                height: `${heightPct * 100}%`,
                background: `linear-gradient(180deg, rgba(82,255,162,0.55) 0%, rgba(34,217,122,0.74) 45%, rgba(34,217,122,0.74) 55%, rgba(82,255,162,0.55) 100%)`,
                mixBlendMode: "multiply",
                borderRadius: 3,
                transform: "skewX(-5deg) rotate(-0.8deg)",
                transformOrigin: "left center",
              }}
            />
            {/* Screen pass — boosts the green saturation */}
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX) * 100}%`,
                top: `${top * 100}%`,
                width: `${(h.w + overshootW) * local * 100}%`,
                height: `${heightPct * 100}%`,
                background: `linear-gradient(180deg, rgba(82,255,162,0.45) 0%, rgba(34,217,122,0.55) 45%, rgba(34,217,122,0.55) 55%, rgba(82,255,162,0.45) 100%)`,
                mixBlendMode: "screen",
                borderRadius: 3,
                transform: "skewX(-5deg) rotate(-0.8deg)",
                transformOrigin: "left center",
              }}
            />
            {/* Kick — darker green underline beneath the highlight */}
            <div
              style={{
                position: "absolute",
                left: `${(h.x - overshootX * 0.6) * 100}%`,
                top: `${(h.y + h.h * 0.92) * 100}%`,
                width: `${(h.w + overshootW * 0.6) * local * 100}%`,
                height: `${Math.max(0.008, h.h * 0.22) * 100}%`,
                background: "#0e8f4a",
                borderRadius: 2,
                transform: "skewX(-3deg) rotate(-0.4deg)",
                transformOrigin: "left center",
                boxShadow: `0 0 6px ${PROOF_GREEN_LIGHT}`,
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Verdict: "IS RIGGED" punches in red after the last article ───────────────

const Verdict: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - VERDICT_AT;
  if (local < -2) return null;

  const enter = spring({
    frame: local,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.7, 1]);

  // Single hero-word punch.
  const punch = spring({
    frame: local - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const punchScale =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(10,10,10,0.78)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 220,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          color: colors.accent,
          lineHeight: 0.95,
          textAlign: "center",
          padding: "0 96px",
          opacity,
          transform: `scale(${scale * punchScale})`,
          textShadow: "0 4px 32px rgba(255,59,59,0.35)",
          textTransform: "lowercase",
        }}
      >
        is rigged.
      </div>
    </AbsoluteFill>
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
