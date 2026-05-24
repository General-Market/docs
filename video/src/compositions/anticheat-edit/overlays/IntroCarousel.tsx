// IntroCarousel — the product ring that orbits the speaker on the intro line
// "…perps, option, prediction markets, and meme coins…".
//
// Lifted from anticheat/AntiCheatStat.tsx's CategoryCarousel and rebuilt for
// this edit:
//   • beat-lock stripped — the ring is driven off the four spoken WORD times,
//     so a card faces the camera exactly as its product is named;
//   • cells are split front/back by their true world-Z, so the IntroHero can
//     stack the far cards BEHIND the person cutout and the near cards in FRONT
//     — a real orbit around the head, not a flat halo;
//   • the "% extracted by unfair trading" content (which belonged to the other
//     film) is dropped — here each card is just the product it names.
//
// Render two instances with the same props, half="back" and half="front", with
// the person cutout between them. A cell crosses the divide edge-on, so the
// handoff between the two instances is invisible.

import React from "react";
import { interpolate } from "remotion";
import { colors } from "../../anticheat/theme";
import { font, monoFont } from "../../../common/fonts";

export type IntroCarouselConfig = {
  /** Card face size (px, before the container scale). */
  cardW: number;
  cardH: number;
  /** Ring radius — how far each card sits from the centre. */
  radius: number;
  /** CSS perspective on the container. */
  perspective: number;
  /** Settled depth of the ring centre. ~0 puts the orbit on the person's
   *  plane so near cards swell toward camera and far cards fall behind. */
  ringZ: number;
  /** Whole-ring scale, to fit the orbit around a head-and-shoulders shot. */
  scale: number;
  /** Forward tilt (deg) of the horizontal ring. Negative drops the near card
   *  DOWN to the chest and lifts the far card UP to peek behind the head — so
   *  the orbit frames the face instead of parking a card over it. */
  tiltX: number;
};

export const INTRO_CAROUSEL_DEFAULT: IntroCarouselConfig = {
  cardW: 320,
  cardH: 350,
  // Wide orbit: cards swing out beside the head into open wall, then clip behind
  // his head edge as they rotate to the back — that crossing is the "behind me".
  radius: 560,
  perspective: 1150,
  ringZ: 0, // ring centre on the person's plane — near cards in front, far behind
  scale: 0.5,
  tiltX: -12,
};

type Product = { label: string; tag: string };
// Order matches the spoken list: perps → option → prediction → meme coins.
const PRODUCTS: Product[] = [
  { label: "perps", tag: "perpetual futures" },
  { label: "options", tag: "calls & puts" },
  { label: "predictions", tag: "event markets" },
  { label: "meme coins", tag: "spot degens" },
];

const STEP = 360 / PRODUCTS.length; // 90° between cards

const expoOut = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const power2InOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const sineInOut = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

// Base ring rotation: card i faces the camera (rotY = -i·90°) at wordAnchors[i].
// Between two anchors the ring turns exactly one card (−90°) on an integral that
// freezes on each word and peaks halfway — the source's music modulation, now
// anchored to speech instead of beats.
function baseRotY(local: number, wordAnchors: number[]): number {
  const DEG = -STEP;
  if (local <= wordAnchors[0]) return 0;
  let seg = wordAnchors.length - 1;
  for (let i = 0; i < wordAnchors.length - 1; i++) {
    if (local >= wordAnchors[i] && local < wordAnchors[i + 1]) {
      seg = i;
      break;
    }
  }
  const t0 = wordAnchors[seg];
  const t1 = seg < wordAnchors.length - 1 ? wordAnchors[seg + 1] : t0 + 26;
  const p = Math.max(0, Math.min(1, (local - t0) / (t1 - t0)));
  const A = 1.0;
  const posInSeg = DEG * p - ((DEG * A) / (2 * Math.PI)) * Math.sin(2 * Math.PI * p);
  return DEG * seg + posInSeg;
}

export type IntroCarouselProps = {
  /** Frames since the carousel began (spiral-in starts at 0). */
  local: number;
  /** Local frames at which each product faces the camera (length 4, ascending).
   *  wordAnchors[0] doubles as the spiral-in length. */
  wordAnchors: number[];
  /** Local frame where the ring explodes outward. */
  explodeStart: number;
  /** Length of the explode, in frames. */
  explodeDur: number;
  /** Which depth half to draw — paired across two instances around the cutout. */
  half: "front" | "back";
  config?: IntroCarouselConfig;
};

export const IntroCarousel: React.FC<IntroCarouselProps> = ({
  local,
  wordAnchors,
  explodeStart,
  explodeDur,
  half,
  config = INTRO_CAROUSEL_DEFAULT,
}) => {
  const { cardW, cardH, radius, perspective, ringZ, scale, tiltX } = config;
  const SPIRAL_IN = wordAnchors[0];

  // Spiral-in — the ring rushes from deep behind and lands facing perps.
  const spiralT = Math.max(0, Math.min(1, local / SPIRAL_IN));
  const spiralEased = expoOut(spiralT);
  const spiralZ = interpolate(spiralEased, [0, 1], [-1400, ringZ]);
  const spiralRotYAdd = interpolate(spiralEased, [0, 1], [-720, 0]);
  const spiralOpacity = Math.min(1, spiralT * 1.4);

  // Settled rotation — driven by the words.
  const rotYBase = baseRotY(local, wordAnchors);

  // A breathing tilt across the spoken phrase, easing through.
  const scrollT = Math.max(
    0,
    Math.min(1, (local - SPIRAL_IN) / (explodeStart - SPIRAL_IN)),
  );
  const tiltT = sineInOut(scrollT);
  const ringTiltX = tiltX + interpolate(tiltT, [0, 1], [3, -3]);
  const ringTiltZ = interpolate(tiltT, [0, 1], [2, -2]);
  const cardTiltZ = interpolate(scrollT, [0, 1], [8, -8]);

  // Explode — tips forward, adds a full spin, plunges then surges past camera.
  const explodeT = Math.max(0, Math.min(1, (local - explodeStart) / explodeDur));
  const explodeEased = power2InOut(explodeT);
  const explodeRotX = interpolate(explodeEased, [0, 0.4, 1], [0, 90, 90]);
  const explodeRotYAdd = interpolate(explodeEased, [0, 1], [0, -360]);
  const explodeZ = interpolate(explodeEased, [0, 0.3, 1], [ringZ, -1800, 1500]);
  const explodeRotZAdd = interpolate(explodeEased, [0.3, 1], [0, 270], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOpacity = explodeT > 0.8 ? interpolate(explodeT, [0.8, 1], [1, 0]) : 1;

  const inExplode = local >= explodeStart;
  const finalZ = inExplode ? explodeZ : local < SPIRAL_IN ? spiralZ : ringZ;
  const finalRotY = rotYBase + spiralRotYAdd + explodeRotYAdd;
  const finalRotX = ringTiltX + explodeRotX;
  const finalRotZ = ringTiltZ + explodeRotZAdd;

  return (
    <div
      style={{
        width: cardW,
        height: cardH,
        perspective,
        position: "relative",
        opacity: spiralOpacity,
        transform: `scale(${scale.toFixed(4)})`,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          // rotateX BEFORE rotateY (applied after the spin) so the forward tilt
          // is camera-fixed — the front-facing card lands at the same height on
          // every word, instead of bobbing as the ring turns.
          transform: `translateZ(${finalZ.toFixed(1)}px) rotateX(${finalRotX.toFixed(2)}deg) rotateY(${finalRotY.toFixed(2)}deg) rotateZ(${finalRotZ.toFixed(2)}deg)`,
          willChange: "transform",
        }}
      >
        {PRODUCTS.map((p, i) => {
          // True world-Z of this card relative to the person's plane (≈0).
          // > 0 → in front of the cutout; ≤ 0 → behind it. The edge-on crossing
          // (cardZ ≈ finalZ) is where a card is invisible, so the front/back
          // handoff between the two instances never shows a seam.
          const phi = ((i * STEP + finalRotY) * Math.PI) / 180;
          const cardZ = finalZ + radius * Math.cos(phi);
          const isFront = cardZ > 0;
          if ((half === "front") !== isFront) return null;
          return (
            <CarouselCell
              key={p.label}
              product={p}
              cellRotateY={i * STEP}
              cardTiltZ={cardTiltZ}
              opacity={cardOpacity}
              cardW={cardW}
              cardH={cardH}
              radius={radius}
            />
          );
        })}
      </div>
    </div>
  );
};

const CarouselCell: React.FC<{
  product: Product;
  cellRotateY: number;
  cardTiltZ: number;
  opacity: number;
  cardW: number;
  cardH: number;
  radius: number;
}> = ({ product, cellRotateY, cardTiltZ, opacity, cardW, cardH, radius }) => (
  <div
    style={{
      position: "absolute",
      width: cardW,
      height: cardH,
      left: 0,
      top: 0,
      transformStyle: "preserve-3d",
      transform: `rotateY(${cellRotateY}deg) translateZ(${radius}px)`,
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transform: `rotateZ(${cardTiltZ}deg)`,
        opacity,
      }}
    >
      <CardFace product={product} />
      <CardFace product={product} isBack />
    </div>
  </div>
);

const CardFace: React.FC<{ product: Product; isBack?: boolean }> = ({
  product,
  isBack,
}) => (
  <div
    style={{
      position: "absolute",
      width: "100%",
      height: "100%",
      backfaceVisibility: "hidden",
      transform: isBack ? "rotateY(180deg)" : undefined,
      borderRadius: 24,
      background: colors.surface,
      boxShadow:
        "0 1px 0 rgba(255,255,255,0.6) inset, 0 32px 64px rgba(8, 14, 28, 0.30), 0 10px 20px rgba(8, 14, 28, 0.16)",
      border: `1px solid ${colors.rule}`,
      overflow: "hidden",
    }}
  >
    <CardSurface product={product} />
  </div>
);

// Apple-light card — eyebrow, the product name large and centred, a hairline,
// and a mono tag. No percentage; the card simply names what was traded.
const CardSurface: React.FC<{ product: Product }> = ({ product }) => (
  <div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      padding: "34px 28px",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 16,
        fontWeight: 500,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: colors.dim,
      }}
    >
      traded
    </div>

    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        fontFamily: font,
        // Sized to the longest word so nothing clips: "predictions" (11),
        // "meme coins" wraps on its space, the short ones stay big.
        fontSize: product.label.includes(" ")
          ? 58
          : product.label.length >= 9
            ? 46
            : 66,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: colors.fg,
        lineHeight: 0.98,
      }}
    >
      {product.label}
    </div>

    <div style={{ height: 1, background: colors.rule, marginBottom: 16 }} />

    <div
      style={{
        fontFamily: monoFont,
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: colors.accent,
      }}
    >
      {product.tag}
    </div>
  </div>
);
