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

// 5.5s scene. Title block holds on the LEFT for the entire scene:
//   line 1 — exchange name (green, underlined; updates per article)
//   line 2 — "is rigged." (red, hero size; constant)
// Articles flash hard-cut on the RIGHT, much larger than before, with the
// original yellow highlighter restored on the article phrase.
const SCENE_SECONDS = 5.5;

const TITLE_IN = 0;
const ARTICLES_AT = toFrames(0.4);
const ARTICLE_HOLD = toFrames(0.7);

const PROOF_GREEN = "#22d97a";

type Highlight = { x: number; y: number; w: number; h: number };

type ArticleProof = {
  exchange: string;
  category: string;
  image: string;
  highlights: Highlight[];      // yellow body highlight (insider-trading phrases)
  exchangeBox?: Highlight;       // green underline on the exchange name in title
};

// `exchangeBox` coords were eyeballed from each article PNG. Two articles
// don't carry their exchange name in the visible upper portion (pump.fun's
// article is about a Solana memecoin lawsuit; the SEC/Cohen article doesn't
// name NYSE) — those keep just the yellow body highlight, while the green
// title element on the left of the scene already names them.
const ARTICLES: ArticleProof[] = [
  {
    exchange: "binance",
    category: "perps",
    image: "insider-trading/articles/1.png",
    highlights: [{ x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 }],
    exchangeBox: { x: 0.038, y: 0.083, w: 0.205, h: 0.045 },
  },
  {
    exchange: "robinhood",
    category: "options",
    image: "insider-trading/articles/9.png",
    highlights: [{ x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 }],
    exchangeBox: { x: 0.097, y: 0.062, w: 0.282, h: 0.052 },
  },
  {
    exchange: "polymarket",
    category: "predictions",
    image: "insider-trading/articles/3.png",
    highlights: [
      { x: 0.6467, y: 0.2828, w: 0.2445, h: 0.0273 },
      { x: 0.5126, y: 0.3313, w: 0.1197, h: 0.0281 },
    ],
    exchangeBox: { x: 0.045, y: 0.205, w: 0.215, h: 0.04 },
  },
  {
    exchange: "pump.fun",
    category: "launchpads",
    image: "insider-trading/articles/4.png",
    highlights: [{ x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 }],
    // No exchangeBox — pump.fun isn't named in the visible upper portion.
  },
  {
    exchange: "kalshi",
    category: "predictions",
    image: "insider-trading/articles/6.png",
    highlights: [{ x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 }],
    exchangeBox: { x: 0.057, y: 0.123, w: 0.118, h: 0.038 },
  },
  {
    exchange: "nyse",
    category: "equity",
    image: "insider-trading/articles/8.png",
    highlights: [{ x: 0.0522, y: 0.5101, w: 0.3917, h: 0.0519 }],
    // No exchangeBox — NYSE isn't named in this SEC/Cohen press release.
  },
  {
    exchange: "coinbase",
    category: "spot",
    image: "insider-trading/articles/7.png",
    highlights: [{ x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 }],
    exchangeBox: { x: 0.42, y: 0.27, w: 0.265, h: 0.045 },
  },
];

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "is rigged." slams in once at the start.
  const slamT = spring({
    frame: frame - TITLE_IN,
    fps,
    config: { damping: 11, stiffness: 220, mass: 0.7 },
  });
  const verdictOpacity = interpolate(slamT, [0, 1], [0, 1]);
  const verdictScale = interpolate(slamT, [0, 1], [0.78, 1]);
  // Subtle breath so the verdict doesn't flatten over 5s.
  const verdictPulse = 1 + Math.sin((frame / 45) * Math.PI * 2) * 0.012;

  // Active article based on frame.
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
      {/* Left — exchange name (line 1) + "is rigged." (line 2) */}
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
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: colors.dim,
          }}
        >
          The verdict
        </div>

        {/* Line 1: exchange name with green underline (re-mounts per article) */}
        {currentArticle && (
          <ExchangeLabel
            key={articleIdx}
            name={currentArticle.exchange}
            startFrame={articleStartFrame}
          />
        )}

        {/* Line 2: "is rigged." — held constant for the scene */}
        <div
          style={{
            fontFamily: font,
            fontSize: 168,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: colors.accent,
            lineHeight: 0.92,
            textShadow: "0 4px 32px rgba(255,59,59,0.35)",
            opacity: verdictOpacity,
            transform: `scale(${verdictScale * verdictPulse})`,
            transformOrigin: "left center",
          }}
        >
          is rigged.
        </div>
      </div>

      {/* Right — big article flash */}
      {currentArticle && (
        <ArticleFlash
          article={currentArticle}
          startFrame={articleStartFrame}
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

// ─── Exchange label: name + green underline drawing left → right ──────────────

const ExchangeLabel: React.FC<{ name: string; startFrame: number }> = ({
  name,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  // Snap-in: scale punch in 4 frames so the cut feels alive.
  const punchT = Math.max(0, Math.min(1, local / 4));
  const punchScale = interpolate(punchT, [0, 1], [1.06, 1]);
  const punchOpacity = interpolate(punchT, [0, 1], [0.35, 1]);

  // Underline draws over 12 frames after a brief delay.
  const lineT = Math.max(0, Math.min(1, (local - 1) / 12));
  const lineEased = 1 - Math.pow(1 - lineT, 3);

  return (
    <div style={{ display: "inline-block" }}>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 78,
          fontWeight: 500,
          letterSpacing: "0.01em",
          color: PROOF_GREEN,
          lineHeight: 1,
          textShadow: "0 0 22px rgba(34,217,122,0.45)",
          opacity: punchOpacity,
          transform: `scale(${punchScale})`,
          transformOrigin: "left center",
          position: "relative",
          paddingBottom: 14,
          whiteSpace: "nowrap",
        }}
      >
        {name}
        {/* Green underline */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: `${lineEased * 100}%`,
            height: 6,
            background: PROOF_GREEN,
            borderRadius: 3,
            boxShadow: `0 0 14px ${PROOF_GREEN}`,
          }}
        />
      </div>
    </div>
  );
};

// ─── Article flash: hard-cut entry, big size, yellow highlighter restored ─────

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
          background: "#ffffff",
          padding: 22,
          borderRadius: 24,
          boxShadow:
            "0 0 0 1px rgba(14,15,12,0.12), 0 36px 80px rgba(0,0,0,0.6)",
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
          <YellowHighlightLayer
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

// ─── Exchange-name underline — clean green line beneath the exchange word ─────
//
// Drawn ON the article image at the bbox of the exchange name (binance,
// polymarket, etc). Two parts: a thicker green underline beneath the word
// plus a faint green text-glow over the bbox so the eye is pulled to it
// without obscuring the underlying ink.

const ExchangeNameUnderline: React.FC<{
  box: Highlight;
  reveal: number;
}> = ({ box, reveal }) => {
  const drawn = Math.max(0, Math.min(1, reveal));
  return (
    <>
      {/* Faint green wash over the word — multiply blend so the ink shows */}
      <div
        style={{
          position: "absolute",
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * drawn * 100}%`,
          height: `${box.h * 100}%`,
          background:
            "linear-gradient(180deg, rgba(82,255,162,0.0) 0%, rgba(34,217,122,0.18) 100%)",
          mixBlendMode: "multiply",
          borderRadius: 2,
          pointerEvents: "none",
        }}
      />
      {/* The underline itself */}
      <div
        style={{
          position: "absolute",
          left: `${box.x * 100}%`,
          top: `${(box.y + box.h * 1.02) * 100}%`,
          width: `${box.w * drawn * 100}%`,
          height: `${Math.max(0.012, box.h * 0.22) * 100}%`,
          background: PROOF_GREEN,
          borderRadius: 2,
          boxShadow: `0 0 12px ${PROOF_GREEN}, 0 0 4px ${PROOF_GREEN_LIGHT}`,
          pointerEvents: "none",
        }}
      />
    </>
  );
};

// ─── Yellow highlighter — original InsiderCases tones, red kick ───────────────

const YellowHighlightLayer: React.FC<{
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
            {/* Multiply pass — body of the yellow highlighter */}
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
            {/* Screen pass — saturation boost */}
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
            {/* Red kick line */}
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

export const antiCheatRiggedMeta = {
  id: "AntiCheatRigged",
  component: AntiCheatRigged,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
