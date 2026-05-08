import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

// Two compositions live in this file:
//   AntiCheatStat — primary number 0.01%/70% then hard-cut to 99.9%/30%
//   AntiCheatBars — the % extracted by unfair trading bar chart
// Both durations locked to beats. Stat = 145f (4.83s) — the primary
// number cuts to its inverse on a beat partway through.
// Bars = 78f (2.6s) — its hard cut to Rigged lands on beat 11.
const STAT_FRAMES = 145;
// Bars 129f (4.3s) — extended from 78f. The bar chart is gone; the room
// goes to a screen-filling Carousel3D ring of category cards. Hard cut
// to Rigged lands on beat 13 (357) instead of beat 11 (306). Rigged's
// article cadence still hits beats 13–18 within ±1f — negligible drift.
const BARS_FRAMES = 129;
// Hard-cut flip from 0.01%/take/70% to 99.9%/get/30% on scene-local
// beat 2 (frame 51 inside Stat = absolute beat 19).
const STAT_FLIP_AT = 51;

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={STAT_FRAMES} from={1} to={1.04}>
        <DotGrid />
        <StatPanel />
        <DotGridVignette intensity={0.22} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

export const AntiCheatBars: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={BARS_FRAMES} from={1} to={1.025}>
        <DotGrid />
        <ExtractionBars />
        <DotGridVignette intensity={0.22} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── Stat panel: Ember-style typewriter, two phases ──────────────────────────
// Phase 1 (0–50)  types "0.01% take 70%", wipes out before the flip.
// Phase 2 (51+)   types "99.9% get 30%" on beat 2 and holds to the
//                 snap-zoom-out at the scene tail.

const ROSE = [254, 186, 189] as const;

const easeIn = (t: number, power: number): number =>
  Math.pow(Math.max(0, Math.min(1, t)), power);

const EmberTypewriter: React.FC<{
  text: string;
  typeStart: number;
  typeEnd: number;
  wipeStart?: number;
  wipeEnd?: number;
  fontSize?: number;
  endColor?: string;
  typePower?: number;
}> = ({
  text,
  typeStart,
  typeEnd,
  wipeStart,
  wipeEnd,
  fontSize = 168,
  endColor = colors.fg,
  typePower = 2.8,
}) => {
  const frame = useCurrentFrame();
  const len = text.length;
  const hasWipe = wipeStart !== undefined && wipeEnd !== undefined;
  const wipeS = wipeStart ?? typeEnd + 1;
  const wipeE = wipeEnd ?? wipeS + 1;

  if (frame < typeStart || (hasWipe && frame > wipeE)) return null;

  let visibleStart = 0;
  let visibleEnd = 0;
  let phase: "typing" | "hold" | "wiping" = "hold";

  if (frame < typeEnd) {
    phase = "typing";
    const t = (frame - typeStart) / Math.max(1, typeEnd - typeStart);
    visibleEnd = Math.min(len, Math.max(1, Math.round(len * easeIn(t, typePower))));
  } else if (!hasWipe || frame < wipeS) {
    phase = "hold";
    visibleEnd = len;
  } else {
    phase = "wiping";
    const t = (frame - wipeS) / Math.max(1, wipeE - wipeS);
    const removed = Math.min(len, Math.round(len * easeIn(t, 2)));
    visibleStart = removed;
    visibleEnd = len;
  }

  if (visibleEnd <= visibleStart) return null;

  return (
    <AbsoluteFill
      style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          whiteSpace: "nowrap",
          color: endColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {text.split("").map((ch, i) => {
          if (i < visibleStart || i >= visibleEnd) return null;

          if (phase === "typing") {
            const currentT = (frame - typeStart) / Math.max(1, typeEnd - typeStart);
            const charThreshold = i / len;
            const age =
              (easeIn(currentT, typePower) - charThreshold) *
              Math.max(1, typeEnd - typeStart);
            const colorT = interpolate(age, [0, 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const r = Math.round(interpolate(colorT, [0, 1], [ROSE[0], 10]));
            const g = Math.round(interpolate(colorT, [0, 1], [ROSE[1], 10]));
            const b = Math.round(interpolate(colorT, [0, 1], [ROSE[2], 12]));
            const display = ch === " " ? " " : ch;
            return (
              <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>
                {display}
              </span>
            );
          }

          if (phase === "wiping") {
            const dist = i - visibleStart;
            const op = interpolate(dist, [0, 2], [0.18, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const display = ch === " " ? " " : ch;
            return (
              <span key={i} style={{ color: endColor, opacity: op }}>
                {display}
              </span>
            );
          }

          const display = ch === " " ? " " : ch;
          return (
            <span key={i} style={{ color: endColor }}>
              {display}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const StatPanel: React.FC = () => {
  return (
    <AbsoluteFill>
      <Caption />

      {/* Phase 1 — types in by beat 1, wipes out into the flip */}
      <EmberTypewriter
        text="0.01% take 70%"
        typeStart={0}
        typeEnd={26}
        wipeStart={STAT_FLIP_AT - 6}
        wipeEnd={STAT_FLIP_AT}
        fontSize={168}
        endColor={colors.fg}
      />

      {/* Phase 2 — flips on beat 2, types in by beat 3, holds to snap-zoom */}
      <EmberTypewriter
        text="99.9% get 30%"
        typeStart={STAT_FLIP_AT}
        typeEnd={STAT_FLIP_AT + 26}
        fontSize={168}
        endColor={colors.fg}
      />
    </AbsoluteFill>
  );
};

// ─── Caption — sets the frame, monospace, dim, anchors the slide. ────────

const Caption: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: "9%",
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: monoFont,
      fontSize: 32,
      fontWeight: 500,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: colors.dim,
    }}
  >
    <RevealChars
      text="who captures the profits"
      startFrame={0}
      stagger={0.5}
      duration={8}
      y={8}
      blur={1.5}
      scale={0.97}
    />
  </div>
);

// ─── Extraction bars (retired) — data inherited by the carousel cards ────────
//
// The horizontal bar chart used to live here. We dropped it; the same
// percentages now live on the carousel cards (see CATEGORIES below).
// REVEAL_AT only governs when the carousel + headline take the stage:
// give the caption a beat to land, then begin.
const REVEAL_AT = toFrames(0.4);

// Headline loses its trailing "..." — the cards below take that role.
const TOUCHED_WORDS = ["every", "market", "you", "touched"];
const TOUCHED_WORD_STAGGER = toFrames(0.07);
const TOUCHED_WORD_FADE = toFrames(0.28);

// 3D rotating ring of category cards — Carousel3D ported, Apple-light.
// Each card carries the bar-chart datum it replaces: category name + the
// % extracted by unfair trading. White surface, near-black type, accent
// blue %, soft drop shadow. Same data as the old bar chart, prouder form.
type Category = { label: string; pct: number };
const CATEGORIES: Category[] = [
  { label: "perps", pct: 80 },
  { label: "options", pct: 90 },
  { label: "predictions", pct: 71 },
  { label: "launchpads", pct: 87 },
];

// Card geometry — full-stage fan. Four cards laid out side-by-side with
// slight rotateY tilt, all visible at once. A 3D ring would hide the
// back card; a fan keeps every datum legible.
const CARD_W = 380;
const CARD_H = 500;
const CARD_X_SPACING = 440;       // distance between card centers
const CARD_FAN_ROT_STEP = 12;     // deg of rotateY per index from center
const CARD_FAN_Z_DEPTH = 80;      // outer cards pushed back this many px
const CARD_FAN_Y_LIFT = 22;       // outer cards drop slightly
const CAROUSEL_PERSPECTIVE = 1500;

// Fan entrance: each card spirals in (rotateY from −90 + Z from −1400)
// with a stagger across the four. CAROUSEL_ENTRY_FULL = last card's
// finish — used to schedule hold + explode against scene end.
const CARD_ENTRY_STAGGER = toFrames(0.07);
const CARD_ENTRY_FADE = toFrames(0.55);
const CAROUSEL_ENTRY_FULL =
  CARD_ENTRY_STAGGER * (CATEGORIES.length - 1) + CARD_ENTRY_FADE;
// Carousel3D explode phase reinterpreted per-card: outer cards fly to
// the corners with rotateY/rotateZ spin while Z plunges then surges
// past the camera. Last frame lands on the hard cut to Rigged.
const CAROUSEL_EXPLODE = toFrames(0.85);
// Hold sized so the explode ends at BARS_FRAMES. Computed in Bars-local
// frames: REVEAL_AT + ENTRY + HOLD + EXPLODE = BARS_FRAMES.
const CAROUSEL_HOLD = BARS_FRAMES - REVEAL_AT - CAROUSEL_ENTRY_FULL - CAROUSEL_EXPLODE;

// Hold the headline alongside the carousel hold; the explode begins after.
const TOUCHED_EXIT_AT = CAROUSEL_ENTRY_FULL + CAROUSEL_HOLD;

// Per-letter wave-out for the headline — TextTrail hide() pattern. The
// letters drift outward from center while the carousel explodes.
const LETTER_EXIT_STAGGER = 1.4;
const LETTER_EXIT_FADE = toFrames(0.34);
const LETTER_EXIT_DRIFT = 22;

const expoOut = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoIn = (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));
const power2InOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// REVEAL_AT no longer means "bar chart finishes" — it now means "the
// carousel + headline take the stage." Caption holds at the top.
const ExtractionBars: React.FC = () => (
  <AbsoluteFill>
    <div
      style={{
        position: "absolute",
        top: "7%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: monoFont,
        fontSize: 32,
        fontWeight: 500,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: colors.dim,
      }}
    >
      <RevealChars
        text="% extracted by unfair trading"
        startFrame={0}
        stagger={0.5}
        duration={8}
        y={10}
        blur={2}
        scale={0.97}
      />
    </div>

    <TouchedLine />
  </AbsoluteFill>
);

const TouchedLine: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - REVEAL_AT;

  if (local < 0) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        pointerEvents: "none",
      }}
    >
      <CategoryCarousel local={local} />
      <TouchedHeadline local={local} />
    </AbsoluteFill>
  );
};

const TouchedHeadline: React.FC<{ local: number }> = ({ local }) => {
  // Per-letter exit ride: each letter waits its turn (stagger from center
  // outward), drifts away from center, fades. The text appears word-by-word
  // on entry; on exit it disintegrates from the inside out.
  const exitLocal = local - TOUCHED_EXIT_AT;

  // Build glyph list with word boundaries so spacing survives.
  type Glyph = { ch: string; isSpace: boolean; wordIdx: number };
  const glyphs: Glyph[] = [];
  TOUCHED_WORDS.forEach((word, wi) => {
    if (wi > 0) glyphs.push({ ch: " ", isSpace: true, wordIdx: wi });
    for (const ch of word) glyphs.push({ ch, isSpace: false, wordIdx: wi });
  });

  const center = (glyphs.length - 1) / 2;

  return (
    <div
      style={{
        textAlign: "center",
        fontFamily: font,
        fontSize: 96,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        color: colors.fg,
        lineHeight: 0.95,
        whiteSpace: "nowrap",
      }}
    >
      {glyphs.map((g, i) => {
        // Entry — staggered by word, glyph rides up + fades in.
        const wLocal = local - g.wordIdx * TOUCHED_WORD_STAGGER;
        const enterOp = interpolate(
          wLocal,
          [0, TOUCHED_WORD_FADE],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const enterY = interpolate(
          wLocal,
          [0, TOUCHED_WORD_FADE],
          [26, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        // Exit — wave outward from the center.
        const dist = Math.abs(i - center);
        const exitStart = dist * LETTER_EXIT_STAGGER;
        const exitT = Math.max(
          0,
          Math.min(1, (exitLocal - exitStart) / LETTER_EXIT_FADE),
        );
        const exitEased = expoIn(exitT);
        const sign = i < center ? -1 : 1;
        const exitX = sign * dist * LETTER_EXIT_DRIFT * exitEased;
        const exitY = -exitEased * 18;
        const exitOp = 1 - exitT;
        const exitScale = 1 - exitEased * 0.18;

        if (g.isSpace) {
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre" }}>
              {" "}
            </span>
          );
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: enterOp * exitOp,
              transform: `translate3d(${exitX.toFixed(2)}px, ${(enterY + exitY).toFixed(2)}px, 0) scale(${exitScale.toFixed(3)})`,
              willChange: "transform, opacity",
            }}
          >
            {g.ch}
          </span>
        );
      })}
    </div>
  );
};

// ─── Category fan — four cards in a curved row, all visible ────────────────
//
// Resting state: a fan of four cards centered on the camera, each with
// its own rotateY tilt (-18 / -6 / +6 / +18) and Z stagger so the outer
// pair sits behind the inner pair. Per-card spiral entrance (rotateY
// from far + Z from −1500) with a small stagger reads like Carousel3D's
// arrival without the back-card hiding problem of a full ring. On exit
// the cards split apart — left pair flies up-left, right pair flies
// up-right, each rotating Y/Z, retreating in Z — then dissolves.

const CategoryCarousel: React.FC<{ local: number }> = ({ local }) => (
  <div
    style={{
      width: 1840,
      height: CARD_H + 60,
      perspective: CAROUSEL_PERSPECTIVE,
      position: "relative",
    }}
  >
    {/* Soft scrim — lifts the cards off the dot grid behind. */}
    <div
      style={{
        position: "absolute",
        inset: "-40px -120px",
        borderRadius: 64,
        background:
          "radial-gradient(ellipse at center, rgba(8, 14, 28, 0.06) 0%, rgba(8, 14, 28, 0) 70%)",
        pointerEvents: "none",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformStyle: "preserve-3d",
      }}
    >
      {CATEGORIES.map((cat, i) => (
        <FanCard
          key={cat.label}
          cat={cat}
          index={i}
          count={CATEGORIES.length}
          local={local}
        />
      ))}
    </div>
  </div>
);

const FanCard: React.FC<{
  cat: Category;
  index: number;
  count: number;
  local: number;
}> = ({ cat, index, count, local }) => {
  const offset = index - (count - 1) / 2; // -1.5, -0.5, +0.5, +1.5
  const absOffset = Math.abs(offset);

  // Resting fan position
  const restingX = offset * CARD_X_SPACING;
  const restingY = absOffset * CARD_FAN_Y_LIFT;
  const restingZ = -absOffset * CARD_FAN_Z_DEPTH;
  const restingRotY = offset * CARD_FAN_ROT_STEP;

  // Entrance — spiral in from far, with stagger across cards
  const enterStart = index * CARD_ENTRY_STAGGER;
  const enterT = Math.max(
    0,
    Math.min(1, (local - enterStart) / CARD_ENTRY_FADE),
  );
  const enterEased = expoOut(enterT);
  const entryDir = offset >= 0 ? 1 : -1;
  const entryX = (1 - enterEased) * 480 * entryDir;
  const entryZ = (1 - enterEased) * -1400;
  const entryRotY = (1 - enterEased) * -90 * entryDir;
  const entryY = (1 - enterEased) * 80;
  const entryOpacity = enterT;

  // Explode — cards split apart in 3D, retreat, fade.
  // Aligned to the same explodeStart as the rest of the scene.
  const explodeStart = CAROUSEL_ENTRY_FULL + CAROUSEL_HOLD;
  const explodeT = Math.max(
    0,
    Math.min(1, (local - explodeStart) / CAROUSEL_EXPLODE),
  );
  const explodeEased = power2InOut(explodeT);
  const explodeDir = offset >= 0 ? 1 : -1;
  // Outer cards fly farther; inner pair drift more gently.
  const explodeX = explodeEased * (480 + 380 * absOffset) * explodeDir;
  const explodeY = explodeEased * (index % 2 === 0 ? -260 : 220);
  const explodeRotY = explodeEased * 110 * explodeDir;
  const explodeRotZ = explodeEased * 28 * explodeDir;
  const explodeZ = interpolate(explodeEased, [0, 0.4, 1], [0, -700, 1300]);
  const explodeOpacity = 1 - explodeT;

  const totalX = restingX + entryX + explodeX;
  const totalY = restingY + entryY + explodeY;
  const totalZ = restingZ + entryZ + explodeZ;
  const totalRotY = restingRotY + entryRotY + explodeRotY;
  const totalRotZ = explodeRotZ;
  const opacity = entryOpacity * explodeOpacity;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -CARD_W / 2,
        marginTop: -CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        transformStyle: "preserve-3d",
        transform: `translate3d(${totalX.toFixed(1)}px, ${totalY.toFixed(1)}px, ${totalZ.toFixed(1)}px) rotateY(${totalRotY.toFixed(2)}deg) rotateZ(${totalRotZ.toFixed(2)}deg)`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      <CardSurface cat={cat} />
    </div>
  );
};

// ─── Apple-light card — white surface, near-black type, accent % ────────────
//
// Eyebrow ("market" mono caps, dim) ▸ category name (SF Pro Display, 800,
// near-black) ▸ % (SF Pro Display, 800, accent blue, tabular nums) ▸
// caption ("extracted" mono small, dim). Soft shadow, 24px radius, hairline
// border. Apple homepage vocabulary.

const CardSurface: React.FC<{ cat: Category }> = ({ cat }) => (
  <div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      borderRadius: 24,
      background: colors.surface,
      boxShadow:
        "0 1px 0 rgba(255,255,255,0.6) inset, 0 32px 64px rgba(8, 14, 28, 0.22), 0 10px 20px rgba(8, 14, 28, 0.12)",
      border: `1px solid ${colors.rule}`,
      overflow: "hidden",
      backfaceVisibility: "hidden",
    }}
  >
    {/* Top eyebrow */}
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 30,
        fontFamily: monoFont,
        fontSize: 17,
        fontWeight: 500,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: colors.dim,
      }}
    >
      market
    </div>

    {/* Category name */}
    <div
      style={{
        position: "absolute",
        top: 78,
        left: 30,
        right: 30,
        fontFamily: font,
        fontSize: 60,
        fontWeight: 800,
        letterSpacing: "-0.022em",
        color: colors.fg,
        lineHeight: 1.0,
      }}
    >
      {cat.label}
    </div>

    {/* Big percentage */}
    <div
      style={{
        position: "absolute",
        left: 30,
        right: 30,
        bottom: 80,
        fontFamily: font,
        fontSize: 156,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: colors.accent,
        lineHeight: 0.92,
        fontVariantNumeric: "tabular-nums",
        textAlign: "left",
      }}
    >
      {cat.pct}
      <span
        style={{
          fontSize: 88,
          color: colors.accent,
          marginLeft: 2,
          letterSpacing: "-0.02em",
        }}
      >
        %
      </span>
    </div>

    {/* Caption */}
    <div
      style={{
        position: "absolute",
        left: 30,
        right: 30,
        bottom: 30,
        fontFamily: monoFont,
        fontSize: 16,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: colors.dim,
      }}
    >
      extracted by unfair trading
    </div>
  </div>
);

export const antiCheatStatMeta = {
  id: "AntiCheatStat",
  component: AntiCheatStat,
  durationInFrames: STAT_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};

export const antiCheatBarsMeta = {
  id: "AntiCheatBars",
  component: AntiCheatBars,
  durationInFrames: BARS_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
