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
// Iceberg fills the frame width edge to edge — no side margins, no
// columns, no panels. The camera opens with a soft pull-back (scale
// 1.9 → 1.518) and then scrolls down through six tiers. Each suffix
// magnets into place at the same screen Y; past suffixes scroll up
// with the iceberg.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

// FILL_SCALE puts the iceberg's full width across the frame.
const FILL_SCALE = W / IMG_NATIVE_W;                // ~1.518

// Opening close-up — image overflows horizontally; the pull-back lets it
// settle into the frame.
const ZOOM_START_SCALE = 1.9;

// Pink-line positions in native asset coordinates.
const TIER_Y_NATIVE = [269, 539, 857, 1141, 1430, 1550];
// And the same in FILL_SCALE display coordinates.
const TIER_Y_FILL = TIER_Y_NATIVE.map((y) => y * FILL_SCALE);
// → [408, 818, 1301, 1732, 2171, 2353]

// Where the active suffix sits in the frame — the upper pink line position
// at scrollY = 0. Every other tier scrolls TO this Y when it's active.
const ACTIVE_FRAME_Y = TIER_Y_FILL[0];              // ~408

const scrollAtTier = (i: number): number => ACTIVE_FRAME_Y - TIER_Y_FILL[i];

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

const SF_DISPLAY = `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif`;
const SF_TEXT = `"SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif`;

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

// Pacing.
const ZOOM_OUT = 22;
const TIER_ANIM = 11;
const TIER_HOLD = 12;
const FINAL_HOLD = 40;
const OUTRO = 14;

const tierAnimStart = (i: number) =>
  ZOOM_OUT + i * (TIER_ANIM + TIER_HOLD);
const SCENE_FRAMES =
  tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO;
// 22 + 5*(11+12) + 11 + 40 + 14 = 22 + 115 + 65 = 202

type State =
  | { phase: "zoom"; t: number }
  | { phase: "tier"; tier: number; sub: "anim" | "hold"; t: number };

const stateAt = (frame: number): State => {
  if (frame < ZOOM_OUT) return { phase: "zoom", t: frame / ZOOM_OUT };
  for (let i = 0; i < N; i++) {
    const animStart = tierAnimStart(i);
    const holdStart = animStart + TIER_ANIM;
    const holdLen = i === LAST ? FINAL_HOLD : TIER_HOLD;
    const holdEnd = holdStart + holdLen;
    if (frame < holdStart)
      return { phase: "tier", tier: i, sub: "anim", t: (frame - animStart) / TIER_ANIM };
    if (frame < holdEnd)
      return { phase: "tier", tier: i, sub: "hold", t: (frame - holdStart) / holdLen };
  }
  return { phase: "tier", tier: LAST, sub: "hold", t: 1 };
};

const computeScale = (state: State): number => {
  if (state.phase === "zoom")
    return interpolate(state.t, [0, 1], [ZOOM_START_SCALE, FILL_SCALE], {
      easing: EASE_OUT,
    });
  return FILL_SCALE;
};

const computeScrollY = (state: State): number => {
  if (state.phase === "zoom") return 0;
  if (state.sub === "hold") return scrollAtTier(state.tier);
  if (state.tier === 0) return 0;
  const a = scrollAtTier(state.tier - 1);
  const b = scrollAtTier(state.tier);
  return a + (b - a) * EASE_OUT(state.t);
};

// Label right inset from the frame's right edge.
const LABEL_RIGHT_INSET = 96;

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const scale = computeScale(state);
  const scrollY = computeScrollY(state);

  const activeTier = state.phase === "tier" ? state.tier : -1;

  // Prefix tracks the active suffix's frame Y exactly — both scroll together.
  const PREFIX_OFFSET = -48;
  const prefixY =
    activeTier >= 0
      ? TIER_Y_FILL[activeTier] + scrollY + PREFIX_OFFSET
      : ACTIVE_FRAME_Y + PREFIX_OFFSET;

  const prefixPulse =
    state.phase === "tier" && state.sub === "anim"
      ? Math.sin(state.t * Math.PI) * 0.045
      : 0;

  let prefixOpacity = 0;
  if (state.phase === "tier") {
    if (state.tier === 0 && state.sub === "anim") {
      prefixOpacity = interpolate(state.t, [0.3, 0.9], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_OUT,
      });
    } else {
      prefixOpacity = 1;
    }
  }

  const introOpacity = interpolate(frame, [0, ZOOM_OUT * 0.35], [0, 1], {
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
      {/* Iceberg — full-width, scrolling. Top-centre origin so the zoom
          and scroll both feel like the camera moving down through it. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: scrollY,
          width: IMG_NATIVE_W,
          height: IMG_NATIVE_H,
          transform: `translate(-50%, 0) scale(${scale.toFixed(4)})`,
          transformOrigin: "top center",
          willChange: "transform, top",
        }}
      >
        <Img
          src={staticFile("iceberg-tiers.webp")}
          style={{ width: IMG_NATIVE_W, height: IMG_NATIVE_H, display: "block" }}
        />
      </div>

      {/* Tier labels — frame coordinates that already account for scroll
          and per-tier slide-in. Render only once a tier has been reached. */}
      {SUFFIXES.map((word, i) => (
        <TierLabel
          key={i}
          word={word}
          index={i}
          state={state}
          scrollY={scrollY}
        />
      ))}

      {/* Prefix — single element, magnets to the active suffix. Disappears
          before the zoom-out completes. */}
      {activeTier >= 0 && (
        <div
          style={{
            position: "absolute",
            right: LABEL_RIGHT_INSET,
            top: prefixY,
            transform: `translateY(-100%) scale(${(1 + prefixPulse).toFixed(3)})`,
            transformOrigin: "right bottom",
            opacity: prefixOpacity,
            pointerEvents: "none",
            willChange: "transform, top",
          }}
        >
          <div
            style={{
              fontFamily: SF_TEXT,
              fontSize: 26,
              fontWeight: 400,
              color: "rgba(245, 245, 247, 0.82)",
              letterSpacing: "-0.012em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              textShadow: "0 1px 8px rgba(0,0,0,0.95)",
              paddingBottom: 12,
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

const TierLabel: React.FC<{
  word: string;
  index: number;
  state: State;
  scrollY: number;
}> = ({ word, index, state, scrollY }) => {
  if (state.phase !== "tier") return null;
  if (state.tier < index) return null;

  const isActive = state.tier === index;
  const isAnimEnter = isActive && state.sub === "anim";

  // The label's natural Y in frame coordinates. As scrollY changes, all
  // tier labels move together — settled past tiers ride up with the
  // iceberg, the active tier lands at ACTIVE_FRAME_Y.
  let labelY = TIER_Y_FILL[index] + scrollY;
  let opacity = 1;
  let scale = 1;

  if (isAnimEnter) {
    const t = state.t;
    const slideY = interpolate(t, [0, 1], [56, 0], { easing: EASE_OUT });
    labelY += slideY;
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

  // Skip far-off-screen labels so they don't cost paint.
  if (labelY < -160 || labelY > H + 160) return null;

  const fontSize = (() => {
    if (word.length <= 5) return 68;
    if (word.length <= 9) return 58;
    if (word.length <= 14) return 50;
    return 44;
  })();

  return (
    <div
      style={{
        position: "absolute",
        right: LABEL_RIGHT_INSET,
        top: labelY,
        transform: `translateY(-50%) scale(${scale.toFixed(3)})`,
        transformOrigin: "right center",
        opacity,
        pointerEvents: "none",
        willChange: "transform, top",
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
          padding: "14px 28px",
          borderRadius: 980,
          background: "rgba(10, 14, 26, 0.62)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.55)",
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
