// Source: https://tympanus.net/Tutorials/3DGradientCarousel/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

/* ─── Card data ─── */

const CARDS = [
  { from: "#667eea", to: "#764ba2", label: "Indigo" },
  { from: "#f093fb", to: "#f5576c", label: "Fuchsia" },
  { from: "#4facfe", to: "#00f2fe", label: "Cyan" },
  { from: "#43e97b", to: "#38f9d7", label: "Mint" },
  { from: "#fa709a", to: "#fee140", label: "Sunset" },
  { from: "#a18cd1", to: "#fbc2eb", label: "Lavender" },
  { from: "#ffecd2", to: "#fcb69f", label: "Peach" },
];

/* ─── Geometry (Codrops exact) ─── */

const CARD_W = 360; // min(26vw @ 1920, 360) = 360
const CARD_H = 450; // 4:5 aspect
const GAP = 28;
const UNIT = CARD_W + GAP; // 388
const TRACK = UNIT * CARDS.length; // 2716
const BORDER_RADIUS = 15;

/* ─── 3D transform parameters ─── */

const PERSPECTIVE = 1800;
const MAX_ROTATION = 28; // degrees
const MAX_DEPTH = 140; // translateZ px
const SCALE_BASE = 0.92;
const SCALE_RANGE = 0.1; // 0.92 → 1.02

/* ─── Entry animation ─── */

const ENTRY_DURATION = 18; // 0.6s at 30fps
const ENTRY_STAGGER = 1.5; // 0.05s at 30fps
const ENTRY_VIEWPORT_RATIO = 0.6; // only cards within 60% of viewport center

/* ─── Scroll speed ─── */
// ~1 card transition per 1.5s → UNIT / 1.5s = 388 / 1.5 ≈ 259 px/s
const SCROLL_SPEED = 259;

/* ─── Background gradient ─── */

const BG_BASE = "#f6f7f9";

/* ─── Helpers ─── */

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Parse hex to [r, g, b] */
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

/** Lerp between two RGB colors */
const lerpColor = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** power3.out easing for Remotion */
const easePower3Out = Easing.out(Easing.poly(3));

export const GradientCarousel: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;
  const halfW = width / 2;

  /* ─── Scroll offset ─── */
  const scrollOffset = time * SCROLL_SPEED;

  /* ─── Determine center card for background gradient colors ─── */
  const centerProgress = scrollOffset / UNIT;
  const centerIdx = Math.floor(centerProgress);
  const centerFrac = centerProgress - centerIdx;
  const cardA = CARDS[mod(centerIdx, CARDS.length)];
  const cardB = CARDS[mod(centerIdx + 1, CARDS.length)];

  const fromRgb = lerpColor(hexToRgb(cardA.from), hexToRgb(cardB.from), centerFrac);
  const toRgb = lerpColor(hexToRgb(cardA.to), hexToRgb(cardB.to), centerFrac);

  /* ─── Lissajous blob centers ─── */
  const timeFactor = time * 0.2; // performance.now() * 0.0002 equivalent
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);

  const amp1 = minDim * 0.35;
  const amp2 = minDim * 0.28;
  const rad1 = maxDim * 0.75;
  const rad2 = maxDim * 0.65;

  const cx1 = width / 2 + Math.sin(timeFactor * 1.3) * amp1;
  const cy1 = height / 2 + Math.cos(timeFactor * 0.9) * amp1;
  const cx2 = width / 2 + Math.sin(timeFactor * 0.7 + 2) * amp2;
  const cy2 = height / 2 + Math.cos(timeFactor * 1.1 + 1) * amp2;

  /* ─── Compute card transforms ─── */

  const cards = useMemo(() => {
    return CARDS.map((card, i) => {
      const rawX =
        mod(i * UNIT - scrollOffset + TRACK / 2, TRACK) - TRACK / 2;
      const screenX = rawX + halfW - CARD_W / 2;

      const norm = clamp(rawX / halfW, -1, 1);
      const absNorm = Math.abs(norm);

      const rotateY = -norm * MAX_ROTATION;
      const translateZ = (1 - absNorm) * MAX_DEPTH;
      const scale = SCALE_BASE + (1 - absNorm) * SCALE_RANGE;
      const blur = absNorm < 0.15 ? 0 : 2 * Math.pow(absNorm, 1.1);

      /* ─── Entry animation ─── */
      const withinEntryViewport = Math.abs(rawX) < width * ENTRY_VIEWPORT_RATIO * 0.5;
      const entryDelay = i * ENTRY_STAGGER;
      let entryProgress = 1;
      let entryOpacity = 1;
      let entryTranslateY = 0;
      let entryScale = 1;

      if (frame < ENTRY_DURATION + entryDelay + 5 && withinEntryViewport) {
        entryProgress = clamp((frame - entryDelay) / ENTRY_DURATION, 0, 1);
        const eased = easePower3Out(entryProgress);
        entryOpacity = eased;
        entryTranslateY = (1 - eased) * 40;
        entryScale = 0.92 + eased * 0.08;
      }

      /* ─── Z-sort: cards closer to center render on top ─── */
      const zIndex = Math.round((1 - absNorm) * 100);

      return {
        ...card,
        screenX,
        rotateY,
        translateZ,
        scale: scale * entryScale,
        blur,
        entryOpacity,
        entryTranslateY,
        zIndex,
      };
    });
  }, [frame, scrollOffset, halfW, width]);

  return (
    <AbsoluteFill style={{ background: BG_BASE }}>
      {/* ─── Animated gradient background ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: "blur(24px) saturate(1.05)",
          background: [
            `radial-gradient(circle ${rad1}px at ${cx1}px ${cy1}px, rgba(${fromRgb[0]},${fromRgb[1]},${fromRgb[2]},0.85), transparent 70%)`,
            `radial-gradient(circle ${rad2}px at ${cx2}px ${cy2}px, rgba(${toRgb[0]},${toRgb[1]},${toRgb[2]},0.70), transparent 65%)`,
            BG_BASE,
          ].join(", "),
        }}
      />

      {/* ─── 3D Stage ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: PERSPECTIVE,
          transformStyle: "preserve-3d",
        }}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: card.screenX,
              top: "50%",
              width: CARD_W,
              height: CARD_H,
              transformOrigin: "90% center",
              transform: [
                `translateY(calc(-50% + ${card.entryTranslateY}px))`,
                `translateZ(${card.translateZ}px)`,
                `rotateY(${card.rotateY}deg)`,
                `scale(${card.scale})`,
              ].join(" "),
              borderRadius: BORDER_RADIUS,
              background: `linear-gradient(135deg, ${card.from}, ${card.to})`,
              filter: card.blur > 0.1 ? `blur(${card.blur}px)` : undefined,
              opacity: card.entryOpacity,
              zIndex: card.zIndex,
              boxShadow: `0 20px 60px ${card.from}33`,
              display: "flex",
              alignItems: "flex-end",
              padding: 24,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: 16,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase" as const,
              }}
            >
              {card.label}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
