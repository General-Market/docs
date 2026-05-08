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
// Bars 104f (3.47s) — extended from 78f to give the touched-line beat
// time to play its letter-wave exit and the 3D category cards. Hard cut
// to Rigged lands on beat 12 (332) instead of beat 11 (306). Rigged's
// internal article cadence (ARTICLE_FRAMES) drifts ~1f against beats —
// negligible.
const BARS_FRAMES = 104;
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

// ─── Extraction bars ──────────────────────────────────────────────────────────

type Bar = {
  label: string;
  value: number;
  displayValue: string;
};

const BARS: Bar[] = [
  { label: "perps", value: 80, displayValue: "80%" },
  { label: "options", value: 90, displayValue: "90%" },
  { label: "predictions", value: 71, displayValue: "71%" },
  { label: "launchpads", value: 87, displayValue: "87%" },
];

const MAX_VALUE = Math.max(...BARS.map((b) => b.value));
const BAR_STAGGER = toFrames(0.26);
const BAR_GROW = toFrames(0.5);
const REVEAL_AT =
  BAR_STAGGER * (BARS.length - 1) + BAR_GROW + toFrames(0.3);

// Headline loses its trailing "..." — the categories below take that role.
const TOUCHED_WORDS = ["every", "market", "you", "touched"];
const TOUCHED_WORD_STAGGER = toFrames(0.07);
const TOUCHED_WORD_FADE = toFrames(0.28);
const TOUCHED_ENTRY_FULL =
  TOUCHED_WORD_STAGGER * (TOUCHED_WORDS.length - 1) + TOUCHED_WORD_FADE;

// 3D rotating ring of category cards — Carousel3D scroll phase, ported.
// Six categories arranged in a circle, the whole ring rotates Y while
// each card carries its own rotateZ tilt and brightness sweep.
type Category = { label: string; gradient: string };
const CATEGORIES: Category[] = [
  {
    label: "stocks",
    gradient: "linear-gradient(135deg, #0a3a8c 0%, #061f4d 55%, #02112e 100%)",
  },
  {
    label: "crypto",
    gradient: "linear-gradient(135deg, #4a2010 0%, #2c1208 55%, #15080a 100%)",
  },
  {
    label: "sports",
    gradient: "linear-gradient(135deg, #0f3a2a 0%, #062418 55%, #04140e 100%)",
  },
  {
    label: "predictions",
    gradient: "linear-gradient(135deg, #2f1456 0%, #190a32 55%, #0c0518 100%)",
  },
  {
    label: "options",
    gradient: "linear-gradient(135deg, #0a3a4c 0%, #062028 55%, #03121a 100%)",
  },
  {
    label: "perps",
    gradient: "linear-gradient(135deg, #4a0a2a 0%, #28051a 55%, #14020e 100%)",
  },
];

// Carousel cell geometry — scaled-down from Carousel3D. Six cards in a
// 360° ring, large enough to read the labels at this composition's scale.
const CAROUSEL_W = 280;
const CAROUSEL_H = 360;
const CARD_W = 240;
const CARD_H = 320;
const CAROUSEL_RADIUS = 260;
const CAROUSEL_PERSPECTIVE = 1100;

const CAROUSEL_SPIRAL_IN = toFrames(0.42);
const CAROUSEL_SPIRAL_HOLD_AFTER = toFrames(0.04);
// After spiral-in completes, the ring scrolls −180° — different cards
// rotate forward. Compressed to fit the available window.
const CAROUSEL_SCROLL = toFrames(0.80);
const CAROUSEL_ENTRY_FULL =
  CAROUSEL_SPIRAL_IN + CAROUSEL_SPIRAL_HOLD_AFTER + CAROUSEL_SCROLL;

// Hold both before the wave-out begins.
const TOUCHED_HOLD = toFrames(0.18);
const TOUCHED_EXIT_AT =
  Math.max(TOUCHED_ENTRY_FULL, CAROUSEL_ENTRY_FULL) + TOUCHED_HOLD;

// Per-letter wave-out: each letter exits with a stagger from the center
// outward, drifting away from center while it fades. TextTrail hide()
// pattern — wave radiates, then nothing remains.
const LETTER_EXIT_STAGGER = 1.4;
const LETTER_EXIT_FADE = toFrames(0.34);
const LETTER_EXIT_DRIFT = 22; // px per unit of distance from center

// Carousel exit — explode away in Z, fade out.
const CAROUSEL_EXIT_DURATION = toFrames(0.36);

const expoOut = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoIn = (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));
const power3 = (t: number): number => t * t * t;
const sineInOut = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

// Bars + caption fade out as the touched line / carousel takes the stage.
// The fade starts a hair before REVEAL_AT so the carousel arrives onto a
// dimmed canvas instead of competing with the chart.
const BARS_FADE_START = REVEAL_AT - toFrames(0.1);
const BARS_FADE_DURATION = toFrames(0.32);

const ExtractionBars: React.FC = () => {
  const frame = useCurrentFrame();
  const barsOpacity = interpolate(
    frame,
    [BARS_FADE_START, BARS_FADE_START + BARS_FADE_DURATION],
    [1, 0.18],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const barsBlur = interpolate(
    frame,
    [BARS_FADE_START, BARS_FADE_START + BARS_FADE_DURATION],
    [0, 4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: barsOpacity,
          filter: barsBlur > 0.05 ? `blur(${barsBlur.toFixed(2)}px)` : undefined,
          willChange: "opacity, filter",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "8%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 36,
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

        <div
          style={{
            position: "absolute",
            top: "20%",
            bottom: "22%",
            left: 0,
            right: 0,
            padding: "0 200px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 36,
          }}
        >
          {BARS.map((bar, i) => (
            <BarRow
              key={bar.label}
              bar={bar}
              maxValue={MAX_VALUE}
              delayFrames={i * BAR_STAGGER}
            />
          ))}
        </div>
      </AbsoluteFill>

      <TouchedLine />
    </AbsoluteFill>
  );
};

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

// ─── Category carousel — Carousel3D scroll phase, ported in miniature ────────
//
// A six-card 3D ring. Spiral-in lands it at the resting Z, then it scrolls
// 180° so the user sees half the categories rotate forward. Each card
// carries its own rotateZ tilt (10° → −10° across the scroll) and a
// brightness ramp (250% → 80%) that quotes the original effect's "glare"
// without overwhelming the bar chart behind it. On exit, the ring
// retreats in Z and dissolves.

const CategoryCarousel: React.FC<{ local: number }> = ({ local }) => {
  // Spiral-in (frames 0…CAROUSEL_SPIRAL_IN)
  const spiralT = Math.max(0, Math.min(1, local / CAROUSEL_SPIRAL_IN));
  const spiralEased = expoOut(spiralT);
  const spiralZ = interpolate(spiralEased, [0, 1], [-1500, -CAROUSEL_RADIUS - 60]);
  const spiralRotYAdd = interpolate(spiralEased, [0, 1], [-720, 0]);
  const spiralOpacity = spiralT;

  // Scroll phase — starts after spiral, runs CAROUSEL_SCROLL frames.
  const scrollLocal = local - CAROUSEL_SPIRAL_IN - CAROUSEL_SPIRAL_HOLD_AFTER;
  const scrollT = Math.max(0, Math.min(1, scrollLocal / CAROUSEL_SCROLL));
  const scrollRotY = interpolate(scrollT, [0, 1], [0, -180]);
  const tiltT = sineInOut(scrollT);
  const ringRotX = interpolate(tiltT, [0, 1], [3, -3]);
  const ringRotZ = interpolate(tiltT, [0, 1], [3, -3]);
  const cardTiltZ = interpolate(scrollT, [0, 1], [10, -10]);
  const brightness = interpolate(power3(scrollT), [0, 1], [200, 95]);

  // Exit — fade + retreat.
  const exitT = Math.max(
    0,
    Math.min(1, (local - TOUCHED_EXIT_AT) / CAROUSEL_EXIT_DURATION),
  );
  const exitEased = expoIn(exitT);
  const exitZAdd = -exitEased * 900;
  const exitRotZAdd = exitEased * 80;
  const exitOpacity = 1 - exitT;

  const finalZ = spiralZ + exitZAdd;
  const finalRotY = scrollRotY + spiralRotYAdd;
  const finalRotZ = ringRotZ + exitRotZAdd;
  const opacity = spiralOpacity * exitOpacity;

  const step = 360 / CATEGORIES.length;

  return (
    <div
      style={{
        width: CAROUSEL_W,
        height: CAROUSEL_H,
        perspective: CAROUSEL_PERSPECTIVE,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `translateZ(${finalZ.toFixed(1)}px) rotateY(${finalRotY.toFixed(2)}deg) rotateX(${ringRotX.toFixed(2)}deg) rotateZ(${finalRotZ.toFixed(2)}deg)`,
        }}
      >
        {CATEGORIES.map((cat, i) => (
          <CarouselCell
            key={cat.label}
            cat={cat}
            cellRotateY={i * step}
            cardRotateZ={cardTiltZ}
            brightness={brightness}
          />
        ))}
      </div>
    </div>
  );
};

const CarouselCell: React.FC<{
  cat: Category;
  cellRotateY: number;
  cardRotateZ: number;
  brightness: number;
}> = ({ cat, cellRotateY, cardRotateZ, brightness }) => (
  <div
    style={{
      position: "absolute",
      width: "100%",
      height: "100%",
      left: 0,
      top: 0,
      transformStyle: "preserve-3d",
      transform: `rotateY(${cellRotateY}deg) translateZ(${CAROUSEL_RADIUS}px)`,
    }}
  >
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        marginLeft: (CAROUSEL_W - CARD_W) / 2,
        marginTop: (CAROUSEL_H - CARD_H) / 2,
        borderRadius: 6,
        background: cat.gradient,
        filter: `brightness(${brightness}%)`,
        transform: `rotateZ(${cardRotateZ}deg)`,
        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.35)",
        overflow: "hidden",
        backfaceVisibility: "hidden",
      }}
    >
      {/* Subtle scan-line / sheen for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.18) 100%)",
        }}
      />
      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 22,
          fontFamily: monoFont,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.55)",
        }}
      >
        market
      </div>
      {/* Hero label */}
      <div
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          bottom: 22,
          fontFamily: font,
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: "#ffffff",
          lineHeight: 0.95,
        }}
      >
        {cat.label}
      </div>
    </div>
  </div>
);

const LABEL_COL = 360;
const VALUE_COL = 240;

const BarRow: React.FC<{
  bar: Bar;
  maxValue: number;
  delayFrames: number;
}> = ({ bar, maxValue, delayFrames }) => {
  const frame = useCurrentFrame();
  const local = frame - delayFrames;

  const labelOpacity = interpolate(
    local,
    [0, toFrames(0.25)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const labelX = interpolate(
    local,
    [0, toFrames(0.3)],
    [-24, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const growT = Math.max(0, Math.min(1, (local - toFrames(0.15)) / BAR_GROW));
  const easedGrow = 1 - Math.pow(1 - growT, 3);
  const widthPct = (bar.value / maxValue) * 100 * easedGrow;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        height: 84,
      }}
    >
      <div
        style={{
          width: LABEL_COL,
          flexShrink: 0,
          fontFamily: monoFont,
          fontSize: 56,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: colors.fgSoft,
          textAlign: "right",
          opacity: labelOpacity,
          transform: `translateX(${labelX}px)`,
        }}
      >
        {bar.label}
      </div>

      <div
        style={{
          flex: 1,
          height: 36,
          position: "relative",
          background: colors.accentTint,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${widthPct}%`,
            background: colors.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -6,
            bottom: -6,
            left: `calc(${widthPct}% - 1px)`,
            width: 2,
            background: colors.fg,
            opacity: easedGrow * 0.85,
          }}
        />
      </div>

      <div
        style={{
          width: VALUE_COL,
          flexShrink: 0,
          textAlign: "left",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: colors.fg,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <ZoomEchoText
          text={bar.displayValue}
          delayFrames={Math.round(BAR_GROW * 0.55)}
          containerLocalFrame={local}
        />
      </div>
    </div>
  );
};

// ─── Zoom-echo text: number emerges with trailing depth-clones ────────────────

const ECHO_COUNT = 5;
const ECHO_GAP_FRAMES = 1.6;
const ZOOM_DURATION = toFrames(0.55);

const ZoomEchoText: React.FC<{
  text: string;
  delayFrames: number;
  containerLocalFrame: number;
}> = ({ text, delayFrames, containerLocalFrame }) => {
  const local = containerLocalFrame - delayFrames;

  if (local < 0) {
    return (
      <span style={{ display: "inline-block", visibility: "hidden" }}>
        {text}
      </span>
    );
  }

  const echoFade = interpolate(
    local,
    [
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.05),
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.35),
    ],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ visibility: "hidden" }}>{text}</span>

      {Array.from({ length: ECHO_COUNT + 1 }).map((_, i) => {
        const f = local - i * ECHO_GAP_FRAMES;
        if (f < 0) return null;

        const t = Math.max(0, Math.min(1, f / ZOOM_DURATION));
        const eased = 1 - Math.pow(1 - t, 4);

        const scale = interpolate(eased, [0, 1], [3.6, 1]);
        const dim = i === 0 ? 1 : Math.pow(0.5, i) * echoFade;
        const op = eased * dim;

        const tint = i === 0 ? colors.fg : i % 2 === 0 ? colors.fg : colors.accent;

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              textAlign: "left",
              transform: `scale(${scale})`,
              transformOrigin: "left center",
              opacity: op,
              color: tint,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </span>
        );
      })}
    </span>
  );
};

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
