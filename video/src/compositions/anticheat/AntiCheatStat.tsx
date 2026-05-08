import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom } from "./vibe";

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

// ─── Extraction bars (retired) — data inherited by the carousel cards ────────
//
// The horizontal bar chart used to live here. We dropped it; the same
// percentages now live on the carousel cards (see CATEGORIES below).
// REVEAL_AT only governs when the carousel + headline take the stage:
// give the caption a beat to land, then begin.
const REVEAL_AT = toFrames(0.4);

// Flanking hero words. "Extracted" sits on the left of the ring,
// "From You" on the right; together with the rotating cards they read
// as a single sentence: EXTRACTED [cards] FROM YOU.

// Flanking hero word entrance — slide-in + char cascade
const SIDE_WORD_ENTER_STAGGER = toFrames(0.045);
const SIDE_WORD_ENTER_FADE = toFrames(0.45);
const SIDE_WORD_LEFT_DELAY = toFrames(0.0);
const SIDE_WORD_RIGHT_DELAY = toFrames(0.18);

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

// Carousel3D ported (WebGLPicks 5:30 Paris scene). Four cards on a 3D
// ring. Each card carries TWO faces — front + back at rotateY(180°),
// both rendering the same content — so the rotation never hides a
// datum. backfaceVisibility hides the inert side of each face; the
// double-render keeps every category readable from any angle.
const CARD_W = 380;
const CARD_H = 500;
const CAROUSEL_W = 400;
const CAROUSEL_H = 540;
const CAROUSEL_RADIUS = 540;
const CAROUSEL_PERSPECTIVE = 1100;

// Phases — Carousel3D Paris timing, scaled to fit our budget.
//   Spiral-in       — rotateY -720→0, Z -1500→-540, expoOut
//   Scroll          — rotateY 0→-180, ring rotateX/Z tilt ±3°,
//                     card rotateZ 10→-10, brightness 200→100
//   Hold            — beat
//   Explode         — rotateX 0→90, rotateY adds -360, Z plunges -1800
//                     then surges +1500, rotateZ +270, opacity past 0.8
const CAROUSEL_SPIRAL_IN = toFrames(0.55);
const CAROUSEL_SCROLL = toFrames(1.95);
const CAROUSEL_EXPLODE = toFrames(0.95);
const CAROUSEL_ENTRY_FULL = CAROUSEL_SPIRAL_IN + CAROUSEL_SCROLL;
// Hold derived so explode ends on the hard cut to Rigged.
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
const sineInOut = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

// The bars + caption are gone. The scene is now the carousel + flanking
// hero words ("Extracted" / "From You") + a single headline below.
const ExtractionBars: React.FC = () => (
  <AbsoluteFill>
    <TouchedLine />
  </AbsoluteFill>
);

const TouchedLine: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - REVEAL_AT;

  if (local < 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Hero word — left flank */}
      <SideHeroWord
        text="Extracted"
        side="left"
        delay={SIDE_WORD_LEFT_DELAY}
        local={local}
      />

      {/* Carousel — centered */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CategoryCarousel local={local} />
      </div>

      {/* Hero word — right flank */}
      <SideHeroWord
        text="From You"
        side="right"
        delay={SIDE_WORD_RIGHT_DELAY}
        local={local}
      />
    </AbsoluteFill>
  );
};

// ─── Side hero words — flanking the carousel ────────────────────────────────
//
// "EXTRACTED" left, "FROM YOU" right. SF Pro Display, weight 800,
// near-black, tight letter-spacing. Each glyph cascades in: slight
// rise + fade with a short stagger across characters. Both words ride
// out via the same letter-wave-out as the headline below.

const SideHeroWord: React.FC<{
  text: string;
  side: "left" | "right";
  delay: number;
  local: number;
}> = ({ text, side, delay, local }) => {
  const exitLocal = local - TOUCHED_EXIT_AT;
  const chars = Array.from(text);
  const center = (chars.length - 1) / 2;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        [side]: 80,
        transform: "translateY(-50%)",
        fontFamily: font,
        fontSize: 168,
        fontWeight: 800,
        letterSpacing: "-0.045em",
        color: colors.fg,
        lineHeight: 0.95,
        whiteSpace: "nowrap",
      }}
    >
      {chars.map((ch, i) => {
        // Entry — char-by-char cascade
        const enterStart = delay + i * SIDE_WORD_ENTER_STAGGER;
        const enterT = Math.max(
          0,
          Math.min(1, (local - enterStart) / SIDE_WORD_ENTER_FADE),
        );
        const enterEased = expoOut(enterT);
        const enterY = (1 - enterEased) * 26;
        const enterOp = enterEased;
        const enterBlur = (1 - enterEased) * 8;

        // Exit — letter wave outward (TextTrail hide pattern)
        const dist = Math.abs(i - center);
        const exitStart = dist * LETTER_EXIT_STAGGER;
        const exitT = Math.max(
          0,
          Math.min(1, (exitLocal - exitStart) / LETTER_EXIT_FADE),
        );
        const exitEased = expoIn(exitT);
        // Push outward from word's center (same as headline)
        const sign = i < center ? -1 : 1;
        const exitX = sign * dist * LETTER_EXIT_DRIFT * exitEased;
        const exitOp = 1 - exitT;
        const exitScale = 1 - exitEased * 0.18;

        if (ch === " ") {
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
              transform: `translate3d(${exitX.toFixed(2)}px, ${enterY.toFixed(2)}px, 0) scale(${exitScale.toFixed(3)})`,
              filter: enterBlur > 0.05 ? `blur(${enterBlur.toFixed(2)}px)` : undefined,
              willChange: "transform, opacity, filter",
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// ─── Category carousel — Carousel3D 3D ring, double-sided cards ──────────────
//
// Spiral-in → continuous rotation → explode. The ring never stops:
// once the spiral lands, rotation accrues at a constant velocity and
// keeps accruing through what used to be a "hold" and through the
// explode. The explode adds its own extra spin on top, so the camera
// catches a ring that is *still turning* as it tips forward and rushes
// past. No frozen frame, no dead beat.
//
// Each cell carries front + back faces (Codrops trick) — the back face
// is rendered with rotateY(180deg) inside the cell, so when the cell
// rotates to face away, the back face's content presents itself. With
// backfaceVisibility: hidden on each face, exactly one side ever paints.
// All four cards are always readable, including launchpads.

const CategoryCarousel: React.FC<{ local: number }> = ({ local }) => {
  // Spiral-in (frames 0…CAROUSEL_SPIRAL_IN)
  const spiralT = Math.max(0, Math.min(1, local / CAROUSEL_SPIRAL_IN));
  const spiralEased = expoOut(spiralT);
  const spiralZ = interpolate(spiralEased, [0, 1], [-1500, -CAROUSEL_RADIUS - 60]);
  const spiralRotYAdd = interpolate(spiralEased, [0, 1], [-720, 0]);
  const spiralOpacity = spiralT;

  // Continuous rotation — once the spiral lands, the ring keeps turning
  // at a constant rate (-180° per CAROUSEL_SCROLL frames). Unbounded;
  // it accrues straight through hold and explode without pausing.
  const rotateSpeedDegPerFrame = -180 / CAROUSEL_SCROLL;
  const rotationFrames = Math.max(0, local - CAROUSEL_SPIRAL_IN);
  const continuousRotY = rotateSpeedDegPerFrame * rotationFrames;

  // Tilt + card-tilt are still tied to a normalized scroll progress so
  // they peak around the original scroll-end and ease through.
  const scrollT01 = Math.max(0, Math.min(1, rotationFrames / CAROUSEL_SCROLL));
  const tiltT = sineInOut(scrollT01);
  const ringRotX = interpolate(tiltT, [0, 1], [3, -3]);
  const ringRotZ = interpolate(tiltT, [0, 1], [3, -3]);
  const cardTiltZ = interpolate(scrollT01, [0, 1], [10, -10]);

  // Explode (frames CAROUSEL_ENTRY_FULL+HOLD…end)
  const explodeStart = CAROUSEL_ENTRY_FULL + CAROUSEL_HOLD;
  const explodeT = Math.max(
    0,
    Math.min(1, (local - explodeStart) / CAROUSEL_EXPLODE),
  );
  const explodeEased = power2InOut(explodeT);
  const explodeRotX = interpolate(explodeEased, [0, 0.4, 1], [0, 90, 90]);
  // Explode adds an extra full spin on top of the continuous rotation —
  // the ring's already-turning energy carries straight into the camera.
  const explodeRotYAdd = interpolate(explodeEased, [0, 1], [0, -360]);
  const explodeZ = interpolate(
    explodeEased,
    [0, 0.3, 1],
    [-CAROUSEL_RADIUS - 60, -1800, 1500],
  );
  const explodeRotZAdd = interpolate(explodeEased, [0.3, 1], [0, 270], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOpacity =
    explodeT > 0.8 ? interpolate(explodeT, [0.8, 1], [1, 0]) : 1;

  const finalZ = local < explodeStart ? spiralZ : explodeZ;
  const finalRotY = continuousRotY + spiralRotYAdd + explodeRotYAdd;
  const finalRotX = ringRotX + explodeRotX;
  const finalRotZ = ringRotZ + explodeRotZAdd;

  const step = 360 / CATEGORIES.length;

  return (
    <div
      style={{
        width: CAROUSEL_W,
        height: CAROUSEL_H,
        perspective: CAROUSEL_PERSPECTIVE,
        opacity: spiralOpacity,
        position: "relative",
      }}
    >
      {/* Soft scrim — lifts the carousel off the dot grid behind. */}
      <div
        style={{
          position: "absolute",
          inset: "-80px -240px",
          borderRadius: 96,
          background:
            "radial-gradient(ellipse at center, rgba(8, 14, 28, 0.08) 0%, rgba(8, 14, 28, 0) 65%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `translateZ(${finalZ.toFixed(1)}px) rotateY(${finalRotY.toFixed(2)}deg) rotateX(${finalRotX.toFixed(2)}deg) rotateZ(${finalRotZ.toFixed(2)}deg)`,
          willChange: "transform",
        }}
      >
        {CATEGORIES.map((cat, i) => (
          <CarouselCell
            key={cat.label}
            cat={cat}
            cellRotateY={i * step}
            cardRotateZ={cardTiltZ}
            cardOpacity={cardOpacity}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Carousel cell — Codrops double-sided trick ──────────────────────────────
//
// Each cell has its own rotateY+translateZ (its slot on the ring). Inside
// the cell, two CardFaces: a front face and a back face rotated 180° on Y.
// Both render the same Apple-light category content. backfaceVisibility
// hidden on each face: only the side facing the camera ever paints. The
// content is therefore always visible from any angle of the cell.

const CarouselCell: React.FC<{
  cat: Category;
  cellRotateY: number;
  cardRotateZ: number;
  cardOpacity: number;
}> = ({ cat, cellRotateY, cardRotateZ, cardOpacity }) => (
  <div
    style={{
      position: "absolute",
      width: CARD_W,
      height: CARD_H,
      left: (CAROUSEL_W - CARD_W) / 2,
      top: (CAROUSEL_H - CARD_H) / 2,
      transformStyle: "preserve-3d",
      transform: `rotateY(${cellRotateY}deg) translateZ(${CAROUSEL_RADIUS}px)`,
    }}
  >
    {/*
     * No `filter` on a 3D ancestor — `filter` creates a stacking
     * context that flattens descendants in WebKit/Blink, which is what
     * was eating the launchpads card. Tilt + opacity only.
     */}
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transform: `rotateZ(${cardRotateZ}deg)`,
        opacity: cardOpacity,
      }}
    >
      <CardFace cat={cat} />
      <CardFace cat={cat} isBack />
    </div>
  </div>
);

const CardFace: React.FC<{ cat: Category; isBack?: boolean }> = ({
  cat,
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
        "0 1px 0 rgba(255,255,255,0.6) inset, 0 32px 64px rgba(8, 14, 28, 0.22), 0 10px 20px rgba(8, 14, 28, 0.12)",
      border: `1px solid ${colors.rule}`,
      overflow: "hidden",
    }}
  >
    <CardSurface cat={cat} />
  </div>
);

// ─── Apple-light card — white surface, near-black type, accent % ────────────

const CardSurface: React.FC<{ cat: Category }> = ({ cat }) => (
  <div style={{ position: "relative", width: "100%", height: "100%" }}>

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
