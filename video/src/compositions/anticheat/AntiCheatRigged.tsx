import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
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

// Per-article visual treatment. Each beat looks structurally different
// so the rigged-evidence montage doesn't flatten into six identical
// flashes. Treatments only affect framing and entry — the underlying
// article PNG, yellow highlight, and green exchange underline stay.
type Treatment =
  | "wide"          // current behaviour — clean card, slight tilt, scale punch
  | "extreme-zoom"  // image is dollied so the exchange name fills the frame
  | "corkboard"     // pinned with two thumbtacks, harder shadow, tilted
  | "magnifier"     // circular lens ring expands over the exchange name, card zooms in
  | "whip"          // whips in from the left with motion blur
  | "fullscreen";   // takes over the entire frame, no card chrome, no left verdict

type ArticleProof = {
  exchange: string;
  image: string;
  source: string;                // canonical URL — printed under the card
  highlights: Highlight[];       // yellow body highlight (insider-trading phrases)
  exchangeBox?: Highlight;       // green underline on the exchange name in title
  logoMask?: LogoMask;           // black blackout over a brand logo
  treatment: Treatment;          // per-beat visual variant
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
    treatment: "wide",
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
    treatment: "extreme-zoom",
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
    treatment: "corkboard",
  },
  {
    exchange: "pump.fun",
    image: "insider-trading/articles/4.png",
    source:
      "cointribune.com/en/solana-memecoin-lawsuit-advances-as-investors-cite-insider-trading-claims",
    highlights: [{ x: 0.1253, y: 0.5158, w: 0.2653, h: 0.0487 }],
    exchangeBox: { x: 0.0414, y: 0.4601, w: 0.3163, h: 0.0386 },
    treatment: "magnifier",
  },
  {
    exchange: "kalshi",
    image: "insider-trading/articles/6.png",
    source: "thehill.com/policy/technology/5797999-prediction-markets-insider-trading-ban",
    highlights: [{ x: 0.4819, y: 0.176, w: 0.216, h: 0.0303 }],
    exchangeBox: { x: 0.0249, y: 0.1760, w: 0.0964, h: 0.0279 },
    treatment: "whip",
  },
  {
    exchange: "coinbase",
    image: "insider-trading/articles/7.png",
    source: "sec.gov/newsroom/press-releases/2022-127",
    highlights: [{ x: 0.2453, y: 0.4009, w: 0.3414, h: 0.0417 }],
    exchangeBox: { x: 0.5953, y: 0.3042, w: 0.2109, h: 0.0346 },
    treatment: "fullscreen",
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

  // Fade the verdict column for fullscreen takeover so the article owns
  // the entire frame on the final beat. 5f fade in around the cut.
  const verdictOpacity =
    currentArticle?.treatment === "fullscreen"
      ? interpolate(
          frame - articleStartFrame,
          [0, 5],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

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
            opacity: verdictOpacity,
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

// ─── Article flash: per-treatment renderer ────────────────────────────────────
//
// The dispatcher picks the variant; each variant owns its framing, entry,
// and any extra ornament (stamp, thumbtacks, motion blur). They all share
// one inner core (ArticleCore) that paints the image + highlight layers,
// so changing the highlighter logic stays one-place.

const ARTICLE_HEIGHT = 940;

const ArticleFlash: React.FC<{
  article: ArticleProof;
  startFrame: number;
}> = ({ article, startFrame }) => {
  switch (article.treatment) {
    case "extreme-zoom":
      return <ExtremeZoomTreatment article={article} startFrame={startFrame} />;
    case "corkboard":
      return <CorkboardTreatment article={article} startFrame={startFrame} />;
    case "magnifier":
      return <MagnifierTreatment article={article} startFrame={startFrame} />;
    case "whip":
      return <WhipTreatment article={article} startFrame={startFrame} />;
    case "fullscreen":
      return <FullscreenTreatment article={article} startFrame={startFrame} />;
    case "wide":
    default:
      return <WideTreatment article={article} startFrame={startFrame} />;
  }
};

type TreatmentProps = { article: ArticleProof; startFrame: number };

// The image + all overlay layers, no card chrome. Card chrome (white pad,
// rounded corners, shadow) is added by the wrapping treatment, so e.g.
// fullscreen can drop it entirely.
const ArticleCore: React.FC<{
  article: ArticleProof;
  reveal: number;
  imgStyle?: React.CSSProperties;
}> = ({ article, reveal, imgStyle }) => (
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
        ...imgStyle,
      }}
    />
    {article.logoMask && <LogoBlackout mask={article.logoMask} />}
    <YellowHighlightLayer highlights={article.highlights} reveal={reveal} />
    {article.exchangeBox && (
      <ExchangeNameUnderline box={article.exchangeBox} reveal={reveal} />
    )}
  </div>
);

// ─── Wide (binance) — clean white card, slight tilt, scale punch ──────────────

const WideTreatment: React.FC<TreatmentProps> = ({ article, startFrame }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const punchT = Math.max(0, Math.min(1, local / 4));
  const punchScale = interpolate(punchT, [0, 1], [1.04, 1]);
  const punchOpacity = interpolate(punchT, [0, 1], [0.35, 1]);
  const highlightReveal = Math.max(0, Math.min(1, (local - 1) / 6));
  const tilt = ((startFrame * 7919) % 100) / 100 - 0.5;

  return (
    <div style={cardWrapStyle()}>
      <div
        style={{
          ...cardChromeStyle(),
          transform: `rotate(${tilt * 0.4}deg) scale(${punchScale})`,
          opacity: punchOpacity,
        }}
      >
        <ArticleCore article={article} reveal={highlightReveal} />
        <SourceCitation url={article.source} />
      </div>
    </div>
  );
};

// ─── Extreme zoom (robinhood) — image dollies until exchange name fills frame ─

const ExtremeZoomTreatment: React.FC<TreatmentProps> = ({
  article,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const highlightReveal = Math.max(0, Math.min(1, (local - 2) / 6));

  // Camera dollies in: starts at 1.6x already-zoomed, settles at 3.4x.
  // The lens lives on the exchange name in the headline — that word is the
  // whole point of the beat.
  const zoom = interpolate(local, [0, 12, 26], [1.6, 3.0, 3.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Anchor on the exchange-name box. Fall back to the body highlight only
  // if an article doesn't carry an exchangeBox (currently all do).
  const anchor = article.exchangeBox ?? article.highlights[0];
  const acx = anchor.x + anchor.w / 2;
  const acy = anchor.y + anchor.h / 2;

  const originX = `${acx * 100}%`;
  const originY = `${acy * 100}%`;

  const opacity = interpolate(local, [0, 4], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          ...cardChromeStyle(),
          transform: `scale(${zoom})`,
          transformOrigin: `${originX} ${originY}`,
          opacity,
        }}
      >
        <ArticleCore article={article} reveal={highlightReveal} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Corkboard (polymarket) — pinned with two thumbtacks, harder shadow ───────

const CorkboardTreatment: React.FC<TreatmentProps> = ({
  article,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  // Drop-and-settle: the card falls 60px and rebounds slightly.
  const dropY = interpolate(local, [0, 6, 10], [-60, 8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(local, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const highlightReveal = Math.max(0, Math.min(1, (local - 4) / 8));

  return (
    <div style={cardWrapStyle()}>
      <div
        style={{
          ...cardChromeStyle(),
          // Heavier tilt + harder cast shadow — feels nailed to a board.
          transform: `translateY(${dropY}px) rotate(2.4deg)`,
          boxShadow:
            "0 0 0 1px rgba(10,12,18,0.18), 0 32px 60px rgba(10,12,18,0.32)",
          opacity,
        }}
      >
        <Thumbtack x={"6%"} y={"-10px"} />
        <Thumbtack x={"94%"} y={"-10px"} delay={2} />
        <ArticleCore article={article} reveal={highlightReveal} />
        <SourceCitation url={article.source} />
      </div>
    </div>
  );
};

const Thumbtack: React.FC<{ x: string; y: string; delay?: number }> = ({
  x,
  y,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  // Pin lands a hair after the card with a small bounce.
  const t = Math.max(0, frame - delay);
  const scale = interpolate(t, [0, 4, 8], [0, 1.25, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(t, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 32% 30%, #ff7a8a 0%, #d61b2c 60%, #8a0a16 100%)",
        boxShadow:
          "inset 0 -3px 6px rgba(0,0,0,0.35), 0 4px 8px rgba(10,12,18,0.45)",
        opacity,
        zIndex: 5,
      }}
    />
  );
};

// ─── Magnifier (pump.fun) — circular lens expands over the exchange name ─────
//
// The lens is the camera, not an editorial overlay. The article enters
// normally; on local frame 6 a thick ring scribes around the exchange-name
// box and the card simultaneously dollies in toward it. The eye lands on
// the screenshot's own typography.

const MagnifierTreatment: React.FC<TreatmentProps> = ({
  article,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const punchT = Math.max(0, Math.min(1, local / 4));
  const punchOpacity = interpolate(punchT, [0, 1], [0.35, 1]);
  const highlightReveal = Math.max(0, Math.min(1, (local - 1) / 6));

  const LENS_AT = 6;
  const lensLocal = local - LENS_AT;

  // Card dolly: 1.0 → 1.4 with origin on the exchange name. The whole card
  // grows toward the box so the box becomes the centre of attention.
  const cardZoom = interpolate(lensLocal, [0, 10, 24], [1.0, 1.32, 1.40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const box = article.exchangeBox;
  const ecx = box ? box.x + box.w / 2 : 0.5;
  const ecy = box ? box.y + box.h / 2 : 0.5;

  return (
    <div style={cardWrapStyle()}>
      <div
        style={{
          ...cardChromeStyle(),
          transform: `scale(${cardZoom})`,
          transformOrigin: `${ecx * 100}% ${ecy * 100}%`,
          opacity: punchOpacity,
        }}
      >
        <ArticleCore article={article} reveal={highlightReveal} />
        <SourceCitation url={article.source} />
        {box && lensLocal >= 0 && (
          <MagnifierLens box={box} local={lensLocal} />
        )}
      </div>
    </div>
  );
};

const MagnifierLens: React.FC<{ box: Highlight; local: number }> = ({
  box,
  local,
}) => {
  // Ring scribes outward from box width to ~1.6× box width over 5 frames,
  // then holds with a faint pulse. Stroke fades from 0 to 1 as it grows.
  const ringScale = interpolate(local, [0, 5, 24], [0.3, 1.0, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(local, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // Lens diameter = 1.6× the box width. The width is in image fractions, so
  // use percent units to size — the lens scales with the article.
  const diameterPct = box.w * 1.7 * 100;

  return (
    <div
      style={{
        position: "absolute",
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: `${diameterPct}%`,
        aspectRatio: "1 / 1",
        borderRadius: "50%",
        border: "5px solid rgba(34,217,122,0.95)",
        boxShadow:
          "0 0 0 3px rgba(34,217,122,0.18), 0 8px 22px rgba(10,12,18,0.25), inset 0 0 24px rgba(82,255,162,0.20)",
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        opacity: ringOpacity,
        pointerEvents: "none",
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%)",
      }}
    />
  );
};

// ─── Whip (kalshi) — flies in from the left with motion blur ──────────────────

const WhipTreatment: React.FC<TreatmentProps> = ({ article, startFrame }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  // Whip travel: -2200px → 0 in 8 frames with cubic ease-out, then a small
  // overshoot rebound so the card lands like it bounced off a wall.
  const whipT = Math.max(0, Math.min(1, local / 8));
  const eased = 1 - Math.pow(1 - whipT, 3);
  const tx = (1 - eased) * -2200;
  const overshoot = interpolate(local, [8, 11, 14], [60, -16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cssBlur = interpolate(local, [0, 6, 9], [10, 4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(local, [0, 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const highlightReveal = Math.max(0, Math.min(1, (local - 8) / 8));

  // Skew during travel only — zeroes once the card has landed.
  const skew = local < 8 ? -6 : 0;
  const rotate = local < 8 ? 0 : -1.2;

  return (
    <div style={cardWrapStyle()}>
      <CameraMotionBlur shutterAngle={150} samples={4}>
        <div
          style={{
            ...cardChromeStyle(),
            transform: `translateX(${tx + overshoot}px) skewX(${skew}deg) rotate(${rotate}deg)`,
            opacity,
            filter: `blur(${cssBlur}px)`,
          }}
        >
          <ArticleCore article={article} reveal={highlightReveal} />
          <SourceCitation url={article.source} />
        </div>
      </CameraMotionBlur>
      {/* Speed lines — three streaks behind the card during travel. */}
      {local < 8 && <SpeedLines local={local} />}
    </div>
  );
};

const SpeedLines: React.FC<{ local: number }> = ({ local }) => {
  const opacity = interpolate(local, [0, 4, 8], [0, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        top: "50%",
        transform: "translateY(-50%)",
        opacity,
        pointerEvents: "none",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 380 - i * 60,
            height: 6,
            background:
              "linear-gradient(90deg, rgba(10,12,18,0) 0%, rgba(10,12,18,0.55) 100%)",
            top: -120 + i * 120,
            right: 0,
            borderRadius: 3,
          }}
        />
      ))}
    </div>
  );
};

// ─── Fullscreen (coinbase) — takes over the frame, no card chrome ─────────────

const FullscreenTreatment: React.FC<TreatmentProps> = ({
  article,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  // Fade-zoom in: starts at 1.10, settles to 1.00 over 10f. Slow continuous
  // dolly past the settle so the receipt keeps growing through the beat.
  const scale = interpolate(local, [0, 10, 49], [1.10, 1.00, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(local, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const highlightReveal = Math.max(0, Math.min(1, (local - 4) / 10));

  // Render the article wrapper at the full frame width. Height is auto so
  // the natural aspect is preserved and the yellow highlight overlay still
  // lines up with the phrase. The receipt is centred vertically; the dark
  // backdrop frames it like a held-up exhibit.
  return (
    <AbsoluteFill
      style={{
        background: "#0a0c12",
        overflow: "hidden",
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: W,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={staticFile(article.image)}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
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
      {/* Source citation — subtle bottom-left, white on dark over the photo. */}
      <div
        style={{
          position: "absolute",
          left: 56,
          bottom: 48,
          fontFamily: monoFont,
          fontSize: 22,
          color: "rgba(255,255,255,0.78)",
          letterSpacing: "0.02em",
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        source — {article.source}
      </div>
    </AbsoluteFill>
  );
};

// ─── Shared style helpers ─────────────────────────────────────────────────────

const cardWrapStyle = (): React.CSSProperties => ({
  position: "absolute",
  right: 40,
  top: "50%",
  transform: "translateY(-50%)",
  width: 1200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const cardChromeStyle = (): React.CSSProperties => ({
  position: "relative",
  background: "#ffffff",
  padding: 24,
  paddingBottom: 56,
  borderRadius: 14,
  boxShadow:
    "0 0 0 1px rgba(10,12,18,0.16), 0 24px 56px rgba(10,12,18,0.20)",
});

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
