import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { FPS, H, W } from "./theme";

// The "I lost because of …" iceberg.
//
// Opens on a tight zoom into the iceberg's tip, then zooms out to reveal
// the whole asset fitting the frame. From there, labels appear one by one
// at each pink-line tier, starting at the upper line. The prefix is a
// single element that magnets to each new active tier; the previous suffix
// is left behind on the iceberg.
//
// Nothing lives outside the iceberg image — no right panel, no header.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

// Wide scale — image fits frame height. ~0.647.
const WIDE_SCALE = H / IMG_NATIVE_H;
const IMG_DISPLAY_W = IMG_NATIVE_W * WIDE_SCALE;          // ~818

// Zoom-in scale — iceberg's tip fills the frame width; bottom overflows.
const ZOOM_IN_SCALE = 1.0;  // image at native size, top visible, bottom past frame

// Tier centres in NATIVE image coordinates, derived from detected pink-line
// positions. First entry is the upper line itself — words start there.
const TIER_Y_NATIVE = [269, 539, 857, 1141, 1430, 1550];

// Tier centres in FRAME coordinates, at the wide scale we hold for the
// label phase. These don't change while we hold; they're computed once.
const TIER_Y = TIER_Y_NATIVE.map((y) => Math.round(y * WIDE_SCALE));
// → [174, 349, 554, 738, 925, 1003]

// Right-edge inset of every label from the image's right edge.
const LABEL_RIGHT_INSET = 48;
const LABEL_RIGHT_FROM_FRAME = (W - IMG_DISPLAY_W) / 2 + LABEL_RIGHT_INSET;
// Distance from the frame's right edge to the right edge of each label.
// (W - IMG_DISPLAY_W)/2 = 551; + 48 = 599. So `right: 599px`.

const SUFFIXES = [
  "strategy",
  "fees",
  "liquidation hunters",
  "front runners",
  "orderbook spoofers",
  "insider traders",
];
const N = SUFFIXES.length;
const LAST = N - 1;

// Apple type.
const SF_DISPLAY = `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif`;
const SF_TEXT = `"SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif`;

// Apple easing.
const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

// Pacing.
const ZOOM_OUT = 24;       // initial zoom-out reveal
const WIDE_HOLD = 6;        // breathe before the first label
const TIER_ANIM = 10;       // suffix magnet-in + prefix magnet to tier
const TIER_HOLD = 12;       // read-it pause before the next tier fires
const FINAL_HOLD = 40;      // extra hold on tier 5 — punchline lands
const OUTRO = 14;

const tierAnimStart = (i: number) =>
  ZOOM_OUT + WIDE_HOLD + i * (TIER_ANIM + TIER_HOLD);

const SCENE_FRAMES =
  tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO;
// 24 + 6 + 5*(10+12) + (10 + 40) + 14 = 24 + 6 + 110 + 50 + 14 = 214

type State =
  | { phase: "zoom"; t: number }
  | { phase: "wide" }
  | {
      phase: "tier";
      tier: number;
      sub: "anim" | "hold";
      t: number; // 0..1 within sub
    };

const stateAt = (frame: number): State => {
  if (frame < ZOOM_OUT) return { phase: "zoom", t: frame / ZOOM_OUT };
  if (frame < ZOOM_OUT + WIDE_HOLD) return { phase: "wide" };
  for (let i = 0; i < N; i++) {
    const animStart = tierAnimStart(i);
    const holdStart = animStart + TIER_ANIM;
    const holdLen = i === LAST ? FINAL_HOLD : TIER_HOLD;
    const holdEnd = holdStart + holdLen;
    if (frame < holdStart)
      return {
        phase: "tier",
        tier: i,
        sub: "anim",
        t: (frame - animStart) / TIER_ANIM,
      };
    if (frame < holdEnd)
      return {
        phase: "tier",
        tier: i,
        sub: "hold",
        t: (frame - holdStart) / holdLen,
      };
  }
  return { phase: "tier", tier: LAST, sub: "hold", t: 1 };
};

const computeScale = (state: State): number => {
  if (state.phase === "zoom")
    return interpolate(state.t, [0, 1], [ZOOM_IN_SCALE, WIDE_SCALE], {
      easing: EASE_OUT,
    });
  return WIDE_SCALE;
};

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const scale = computeScale(state);

  // Active tier index — only set during the tier phase.
  const activeTier = state.phase === "tier" ? state.tier : -1;

  // Prefix Y — magnets to active tier. Sits just above the suffix line.
  // During an anim phase from tier (i-1) to tier i, interpolates between
  // the two tier Ys for the magnet-glide.
  const PREFIX_OFFSET = -38; // above the suffix
  let prefixYBase: number;
  if (activeTier < 0) {
    prefixYBase = TIER_Y[0];
  } else if (
    state.phase === "tier" &&
    state.sub === "anim" &&
    state.tier > 0
  ) {
    const a = TIER_Y[state.tier - 1];
    const b = TIER_Y[state.tier];
    prefixYBase = a + (b - a) * EASE_OUT(state.t);
  } else {
    prefixYBase = TIER_Y[activeTier];
  }
  const prefixY = prefixYBase + PREFIX_OFFSET;

  // Prefix opacity — fades in with tier 0 entry, holds through the scene.
  let prefixOpacity = 0;
  if (state.phase === "tier") {
    if (state.tier === 0 && state.sub === "anim") {
      prefixOpacity = interpolate(state.t, [0.2, 0.9], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_OUT,
      });
    } else {
      prefixOpacity = 1;
    }
  }

  // Magnet pulse on the prefix during each tier transition.
  const prefixPulse =
    state.phase === "tier" && state.sub === "anim"
      ? Math.sin(state.t * Math.PI) * 0.045
      : 0;

  // Scene-level fade.
  const introOpacity = interpolate(frame, [0, ZOOM_OUT * 0.4], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(
    frame,
    [SCENE_FRAMES - OUTRO, SCENE_FRAMES],
    [1, 0],
    { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneOpacity = Math.min(introOpacity, outroOpacity);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        fontFamily: SF_TEXT,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Iceberg — origin top-centre so the zoom-out grows downward, the
          tip stays pinned, and the depths reveal themselves. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: IMG_NATIVE_W,
          height: IMG_NATIVE_H,
          transform: `translate(-50%, 0) scale(${scale.toFixed(4)})`,
          transformOrigin: "top center",
          willChange: "transform",
        }}
      >
        <Img
          src={staticFile("iceberg-tiers.webp")}
          style={{ width: IMG_NATIVE_W, height: IMG_NATIVE_H, display: "block" }}
        />
      </div>

      {/* All six tier labels. Each only renders once its tier has been
          reached — no pre-writing. They live in frame coordinates because
          the iceberg is held at WIDE_SCALE for the entire label phase. */}
      {SUFFIXES.map((word, i) => (
        <TierLabel key={i} word={word} index={i} state={state} />
      ))}

      {/* Prefix — magnets to each new active tier. Only exists during the
          tier phase. */}
      {activeTier >= 0 && (
        <div
          style={{
            position: "absolute",
            right: LABEL_RIGHT_FROM_FRAME,
            top: prefixY,
            transform: `translateY(-100%) scale(${(1 + prefixPulse).toFixed(3)})`,
            transformOrigin: "right bottom",
            opacity: prefixOpacity,
            pointerEvents: "none",
            willChange: "transform, top, opacity",
          }}
        >
          <div
            style={{
              fontFamily: SF_TEXT,
              fontSize: 22,
              fontWeight: 400,
              color: "rgba(245, 245, 247, 0.72)",
              letterSpacing: "-0.012em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              textShadow: "0 1px 6px rgba(0,0,0,0.9)",
              paddingBottom: 8,
            }}
          >
            I lost because of
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── Tier label ───────────────────────────────────────────────────────────────
//
// Three rendering states based on the scene's state:
//   • Below the active tier (state.tier > index)   → settled, fully visible
//   • At the active tier (state.tier === index)
//        • anim sub-phase → magnet-in animation
//        • hold sub-phase → fully visible, "current"
//   • Above the active tier (state.tier < index) or pre-tier phase → not yet
//     rendered. Future words don't exist.

const TierLabel: React.FC<{
  word: string;
  index: number;
  state: State;
}> = ({ word, index, state }) => {
  // Does this tier exist yet?
  if (state.phase !== "tier") return null;
  if (state.tier < index) return null;

  const isActive = state.tier === index;
  const isAnimEnter = isActive && state.sub === "anim";

  // Magnet-in animation when this tier first appears.
  let slideY = 0;
  let opacity = 1;
  let scale = 1;
  if (isAnimEnter) {
    const t = state.t;
    slideY = interpolate(t, [0, 1], [56, 0], { easing: EASE_OUT });
    opacity = interpolate(t, [0.35, 0.85], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    scale = interpolate(t, [0.55, 0.85, 1], [0.96, 1.05, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_DEFAULT,
    });
  }

  // Type sizing — single line for everything, Apple Display weight 600.
  const fontSize = (() => {
    if (word.length <= 5) return 56;
    if (word.length <= 9) return 48;
    if (word.length <= 14) return 40;
    return 34;
  })();

  return (
    <div
      style={{
        position: "absolute",
        right: LABEL_RIGHT_FROM_FRAME,
        top: TIER_Y[index] + slideY,
        transform: `translateY(-50%) scale(${scale.toFixed(3)})`,
        transformOrigin: "right center",
        opacity,
        pointerEvents: "none",
        willChange: "transform, top, opacity",
      }}
    >
      <div
        style={{
          fontFamily: SF_DISPLAY,
          fontSize,
          fontWeight: 600,
          color: "rgba(245, 245, 247, 0.98)",
          letterSpacing: "-0.024em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          padding: "12px 22px",
          borderRadius: 980,
          background: "rgba(12, 18, 30, 0.62)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 28px rgba(0,0,0,0.5)",
        }}
      >
        {word}
      </div>
    </div>
  );
};

export const antiCheatIcebergMeta = {
  id: "AntiCheatIceberg",
  component: AntiCheatIceberg,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
