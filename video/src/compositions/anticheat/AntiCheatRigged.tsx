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

// 5.5s scene. "is rigged." holds at the top throughout — red, hero-size,
// slammed into place by frame 5. Articles flash hard-cut underneath at
// ~0.7s each, exchange names highlighted in green. No brand logo cards.
const SCENE_SECONDS = 5.5;

const TITLE_IN = 0;
const ARTICLES_AT = toFrames(0.45);
const ARTICLE_HOLD = toFrames(0.7);

const PROOF_GREEN = "#22d97a";
const PROOF_GREEN_LIGHT = "#52ffa2";

type Highlight = { x: number; y: number; w: number; h: number };

type ArticleProof = {
  category: string;
  image: string;
  highlights: Highlight[];
};

// Articles pulled from public/insider-trading/articles/. The bbox coordinates
// for the green highlights are reused from InsiderCases.tsx — they target
// each article's exchange-name phrase exactly. Order is the bar-chart order
// followed by reinforcement articles (Kalshi, NYSE, Coinbase) so the rapid
// cuts feel like a torrent, not a list.
const ARTICLES: ArticleProof[] = [
  {
    category: "perps",
    image: "insider-trading/articles/1.png",
    highlights: [{ x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 }],
  },
  {
    category: "options",
    image: "insider-trading/articles/9.png",
    highlights: [{ x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 }],
  },
  {
    category: "predictions",
    image: "insider-trading/articles/3.png",
    highlights: [
      { x: 0.6467, y: 0.2828, w: 0.2445, h: 0.0273 },
      { x: 0.5126, y: 0.3313, w: 0.1197, h: 0.0281 },
    ],
  },
  {
    category: "launchpads",
    image: "insider-trading/articles/4.png",
    highlights: [{ x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 }],
  },
  {
    category: "predictions",
    image: "insider-trading/articles/6.png",
    highlights: [{ x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 }],
  },
  {
    category: "equity",
    image: "insider-trading/articles/8.png",
    highlights: [{ x: 0.0522, y: 0.5101, w: 0.3917, h: 0.0519 }],
  },
  {
    category: "spot",
    image: "insider-trading/articles/7.png",
    highlights: [{ x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 }],
  },
];

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title slams in once, in 5 frames. Mild hold-pulse after that.
  const slamT = spring({
    frame: frame - TITLE_IN,
    fps,
    config: { damping: 11, stiffness: 220, mass: 0.7 },
  });
  const titleOpacity = interpolate(slamT, [0, 1], [0, 1]);
  const titleScale = interpolate(slamT, [0, 1], [0.72, 1]);

  // Pulse: subtle scale breath every ~1.5s so the title doesn't flatten.
  const pulse = 1 + Math.sin((frame / 45) * Math.PI * 2) * 0.012;

  // Active article based on frame.
  const articleIdx = Math.max(
    0,
    Math.floor((frame - ARTICLES_AT) / ARTICLE_HOLD),
  );
  const articlesActive =
    frame >= ARTICLES_AT && articleIdx < ARTICLES.length;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      {/* Title — "is rigged." holds at top throughout */}
      <div
        style={{
          position: "absolute",
          top: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 96px",
          opacity: titleOpacity,
          transform: `scale(${titleScale * pulse})`,
          transformOrigin: "center top",
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: colors.dim,
            marginBottom: 14,
          }}
        >
          The verdict
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 200,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: colors.accent,
            lineHeight: 0.95,
            textShadow: "0 4px 32px rgba(255,59,59,0.35)",
          }}
        >
          is rigged.
        </div>
      </div>

      {/* Article carousel — flashes underneath the title */}
      {articlesActive && (
        <ArticleFlash
          article={ARTICLES[articleIdx]}
          startFrame={ARTICLES_AT + articleIdx * ARTICLE_HOLD}
        />
      )}

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
//
// The article sits in the bottom two-thirds of the canvas, beneath the
// "is rigged." title. No brand card — the article image and its green-
// highlighted exchange name are the entire visual.

const ARTICLE_HEIGHT = 580;

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
  const highlightReveal = Math.max(0, Math.min(1, (local - 1) / 6));

  // Tiny tilt — deterministic per article so the rapid cuts don't feel sterile.
  const tilt = ((startFrame * 7919) % 100) / 100 - 0.5;

  return (
    <div
      style={{
        position: "absolute",
        top: "44%",
        left: 0,
        right: 0,
        bottom: "5%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 96px",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          padding: 18,
          borderRadius: 22,
          boxShadow:
            "0 0 0 1px rgba(14,15,12,0.12), 0 30px 70px rgba(0,0,0,0.6)",
          transform: `rotate(${tilt * 0.35}deg) scale(${punchScale})`,
          opacity: punchOpacity,
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
    </div>
  );
};

// ─── Green highlighter — light-green body, brighter screen pass, dark kick ────

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

export const antiCheatRiggedMeta = {
  id: "AntiCheatRigged",
  component: AntiCheatRigged,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
