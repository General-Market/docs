import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { VerticalDotGrid } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

// 4.5s scene. Title block holds on the LEFT for the entire scene:
//   line 1 — exchange name (green, underlined; updates per article)
//   line 2 — "is rigged." (red, hero size; constant)
// Articles flash hard-cut on the RIGHT, much larger than before, with the
// original yellow highlighter restored on the article phrase.
// 5.93s — articles + glitches + verdict, snap-zoom intense to Stat.
// Locked so the Rigged→Stat transition starts on beat 17 (frame 460).
const SCENE_SECONDS = 178 / FPS;
const SCENE_FRAMES = 178;

const TITLE_IN = 0;
// One article per beat. Rigged starts on beat 11, articles cycle on
// beats 11–16 (scene-local 0, 26, 51, 77, 102, 129). Beat-to-beat gaps
// aren't uniform (25, 25, 26, 25, 27) so spell them out, don't step.
const ARTICLE_FRAMES = [0, 26, 51, 77, 102, 129];

// Glitches detonate on scene-local beats 1, 3, 5 (frames 26, 77, 129).
const GLITCH_AT = [26, 77, 129];
const GLITCH_LEN = 6;

type Highlight = { x: number; y: number; w: number; h: number };

// Flat fill that hides a logo on the article photo. Coords are
// fractions of the rendered image (cx, cy = center; size in width units).
// `rect` accepts independent width and height so a tilted bar can hug a
// wordmark without spilling into the surrounding non-screen area.
type LogoMask =
  | { kind: "circle"; cx: number; cy: number; size: number; color?: string }
  | {
      kind: "rect";
      cx: number;
      cy: number;
      width: number;
      height: number;
      rotate: number;
      color?: string;
    };

type ArticleProof = {
  exchange: string;
  image: string;
  source: string;                // canonical URL — printed under the card
  highlights: Highlight[];       // yellow body highlight (insider-trading phrases)
  exchangeBox?: Highlight;       // green underline on the exchange name in title
  logoMask?: LogoMask;           // black blackout over a brand logo
};

// `exchangeBox` coords were eyeballed from each article PNG. Two articles
// don't carry their exchange name in the visible upper portion (pump.fun's
// article is about a Solana memecoin lawsuit; the SEC/Cohen article doesn't
// name NYSE) — those keep just the yellow body highlight, while the green
// title element on the left of the scene already names them.
const ARTICLES: ArticleProof[] = [
  {
    exchange: "binance",
    image: "insider-trading/articles/1.png",
    source:
      "theblock.co/post/381752/binance-confirm-insider-trading-year-yellow-fruit-meme-token-higher",
    highlights: [{ x: 0.5737, y: 0.1383, w: 0.3183, h: 0.0453 }],
    exchangeBox: { x: 0.0131, y: 0.1383, w: 0.1759, h: 0.0352 },
    logoMask: { kind: "circle", cx: 0.499, cy: 0.738, size: 0.42 },
  },
  {
    exchange: "robinhood",
    image: "insider-trading/articles/9.png",
    source:
      "pymnts.com/markets/2026/robinhood-blocks-some-prediction-markets-over-insider-trading-worries",
    highlights: [{ x: 0.4119, y: 0.1968, w: 0.2831, h: 0.042 }],
    exchangeBox: { x: 0.1625, y: 0.1433, w: 0.2065, h: 0.0331 },
    logoMask: {
      kind: "rect",
      cx: 0.51,
      cy: 0.71,
      width: 0.46,
      height: 0.13,
      rotate: -8,
      color: "#ffffff",
    },
  },
  {
    exchange: "polymarket",
    image: "insider-trading/articles/3.png",
    source:
      "coindesk.com/markets/2026/02/27/polymarket-bettors-appear-to-have-insider-traded-on-a-market-designed-to-catch-insider-traders",
    highlights: [
      { x: 0.6467, y: 0.2828, w: 0.2445, h: 0.0273 },
      { x: 0.5126, y: 0.3313, w: 0.1197, h: 0.0281 },
    ],
    exchangeBox: { x: 0.0540, y: 0.2828, w: 0.1998, h: 0.0359 },
  },
  {
    exchange: "pump.fun",
    image: "insider-trading/articles/4.png",
    source:
      "cointribune.com/en/solana-memecoin-lawsuit-advances-as-investors-cite-insider-trading-claims",
    highlights: [{ x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 }],
    exchangeBox: { x: 0.0414, y: 0.4601, w: 0.3163, h: 0.0386 },
  },
  {
    exchange: "kalshi",
    image: "insider-trading/articles/6.png",
    source: "thehill.com/policy/technology/5797999-prediction-markets-insider-trading-ban",
    highlights: [{ x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 }],
    exchangeBox: { x: 0.0249, y: 0.1760, w: 0.0964, h: 0.0279 },
  },
  {
    exchange: "coinbase",
    image: "insider-trading/articles/7.png",
    source: "sec.gov/newsroom/press-releases/2022-127",
    highlights: [{ x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 }],
    exchangeBox: { x: 0.5953, y: 0.3042, w: 0.2109, h: 0.0346 },
  },
];

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle breath so the verdict doesn't flatten over 5s.
  const verdictPulse = 1 + Math.sin((frame / 45) * Math.PI * 2) * 0.012;

  // Glitch intensity: the strongest pulse currently active.
  let glitch = 0;
  for (const at of GLITCH_AT) {
    const local = frame - at;
    if (local >= 0 && local < GLITCH_LEN) {
      const v = Math.sin((local / GLITCH_LEN) * Math.PI);
      if (v > glitch) glitch = v;
    }
  }

  // Active article based on frame — pick the latest beat that has fired.
  let articleIdx = -1;
  for (let i = 0; i < ARTICLE_FRAMES.length; i++) {
    if (frame >= ARTICLE_FRAMES[i] && i < ARTICLES.length) articleIdx = i;
  }
  const articlesActive = articleIdx >= 0;
  const currentArticle = articlesActive ? ARTICLES[articleIdx] : null;
  const articleStartFrame = articlesActive ? ARTICLE_FRAMES[articleIdx] : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <VerticalDotGrid />
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.025}>
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
          {/* "is rigged" — two lines, char-slammed in, glitch flickers thrice */}
          <div
            style={{
              transform: `scale(${verdictPulse})`,
              transformOrigin: "left center",
              willChange: "transform",
            }}
          >
            <GlitchVerdict glitch={glitch} />
          </div>
        </div>

        {/* Right — big article flash */}
        {currentArticle && (
          <ArticleFlash
            article={currentArticle}
            startFrame={articleStartFrame}
          />
        )}

        {/* Light-field vignette — corners fade to bg, not to black */}
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, rgba(240,242,244,0) 50%, rgba(240,242,244,0.30) 100%)",
          }}
        />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── GlitchVerdict ────────────────────────────────────────────────────────────
//
// "is rigged" rendered three times: red-shifted left, cyan-shifted right,
// base accent-blue centered. RevealChars per layer for the slam-in entry.
// During glitch pulses, the two chromatic copies translate apart and
// brighten. Between pulses they vanish, the base sits clean.

const GlitchVerdict: React.FC<{ glitch: number }> = ({ glitch }) => {
  const baseStyle: React.CSSProperties = {
    fontFamily: font,
    fontSize: 168,
    fontWeight: 800,
    letterSpacing: "-0.05em",
    lineHeight: 0.92,
    whiteSpace: "nowrap",
  };
  const ghostShift = 10 * glitch;
  const ghostOpacity = 0.7 * glitch;
  const reveal = (
    <>
      <div>
        <RevealChars
          text="Everyone"
          startFrame={TITLE_IN}
          stagger={2.0}
          duration={9}
          y={26}
          blur={6}
          scale={0.82}
        />
      </div>
      <div>
        <RevealChars
          text="is"
          startFrame={TITLE_IN + 6}
          stagger={2.0}
          duration={9}
          y={26}
          blur={6}
          scale={0.82}
        />
      </div>
      <div>
        <RevealChars
          text="rigged"
          startFrame={TITLE_IN + 12}
          stagger={2.0}
          duration={9}
          y={26}
          blur={6}
          scale={0.82}
        />
      </div>
    </>
  );

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Red ghost — shifts left during glitch */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          ...baseStyle,
          color: "#ff2b44",
          opacity: ghostOpacity,
          transform: `translateX(${(-ghostShift).toFixed(2)}px)`,
          pointerEvents: "none",
        }}
      >
        {reveal}
      </div>

      {/* Cyan ghost — shifts right during glitch */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          ...baseStyle,
          color: "#00bcd4",
          opacity: ghostOpacity,
          transform: `translateX(${ghostShift.toFixed(2)}px)`,
          pointerEvents: "none",
        }}
      >
        {reveal}
      </div>

      {/* Base verdict */}
      <div
        style={{
          ...baseStyle,
          color: colors.accent,
          position: "relative",
        }}
      >
        {reveal}
      </div>
    </div>
  );
};

// ─── Article flash: hard-cut entry, big size, yellow highlighter restored ─────

const ARTICLE_HEIGHT = 940;

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
        right: 40,
        top: "50%",
        transform: "translateY(-50%)",
        width: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          padding: 24,
          paddingBottom: 56,
          borderRadius: 14,
          boxShadow:
            "0 0 0 1px rgba(10,12,18,0.16), 0 24px 56px rgba(10,12,18,0.20)",
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
              maxWidth: 1160,
              objectFit: "contain",
              display: "block",
              borderRadius: 4,
            }}
          />
          {article.logoMask && <LogoBlackout mask={article.logoMask} />}
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
        <SourceCitation url={article.source} />
      </div>
    </div>
  );
};

// ─── Source citation — small mono link printed under the article card ─────────

const SourceCitation: React.FC<{ url: string }> = ({ url }) => (
  <div
    style={{
      position: "absolute",
      left: 28,
      right: 28,
      bottom: 18,
      fontFamily: monoFont,
      fontSize: 18,
      color: "rgba(10,12,18,0.55)",
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }}
  >
    source — {url}
  </div>
);

// ─── Logo blackout — flat black shape that covers a brand mark ───────────────
//
// Sized as a fraction of image width and centered on (cx, cy). aspect-ratio:1
// keeps the shape square in display pixels so the circle stays round and the
// square stays square regardless of the image's native aspect.

const LogoBlackout: React.FC<{ mask: LogoMask }> = ({ mask }) => {
  if (mask.kind === "circle") {
    return (
      <div
        style={{
          position: "absolute",
          left: `${mask.cx * 100}%`,
          top: `${mask.cy * 100}%`,
          width: `${mask.size * 100}%`,
          aspectRatio: "1 / 1",
          background: mask.color ?? "#000",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: `${mask.cx * 100}%`,
        top: `${mask.cy * 100}%`,
        width: `${mask.width * 100}%`,
        height: `${mask.height * 100}%`,
        background: mask.color ?? "#000",
        transform: `translate(-50%, -50%) rotate(${mask.rotate}deg)`,
        pointerEvents: "none",
      }}
    />
  );
};

// Marker-stroke only — multiply + screen passes that sit over the text,
// mirroring the yellow highlighter's body. No hard kick line beneath.

const ExchangeNameUnderline: React.FC<{
  box: Highlight;
  reveal: number;
}> = ({ box, reveal }) => {
  const local = Math.max(0, Math.min(1, reveal));
  const overshootX = 0.008;
  const overshootW = 0.016;
  const padY = box.h * 0.22;
  const top = box.y - padY;
  const heightPct = box.h + padY * 2;

  return (
    <>
      {/* Multiply pass — the green ink body */}
      <div
        style={{
          position: "absolute",
          left: `${(box.x - overshootX) * 100}%`,
          top: `${top * 100}%`,
          width: `${(box.w + overshootW) * local * 100}%`,
          height: `${heightPct * 100}%`,
          background:
            "linear-gradient(180deg, rgba(82,255,162,0.55) 0%, rgba(34,217,122,0.74) 45%, rgba(34,217,122,0.74) 55%, rgba(82,255,162,0.55) 100%)",
          mixBlendMode: "multiply",
          borderRadius: 3,
          transform: "skewX(-5deg) rotate(-0.8deg)",
          transformOrigin: "left center",
          pointerEvents: "none",
        }}
      />
      {/* Screen pass — saturation boost */}
      <div
        style={{
          position: "absolute",
          left: `${(box.x - overshootX) * 100}%`,
          top: `${top * 100}%`,
          width: `${(box.w + overshootW) * local * 100}%`,
          height: `${heightPct * 100}%`,
          background:
            "linear-gradient(180deg, rgba(82,255,162,0.45) 0%, rgba(34,217,122,0.55) 45%, rgba(34,217,122,0.55) 55%, rgba(82,255,162,0.45) 100%)",
          mixBlendMode: "screen",
          borderRadius: 3,
          transform: "skewX(-5deg) rotate(-0.8deg)",
          transformOrigin: "left center",
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
