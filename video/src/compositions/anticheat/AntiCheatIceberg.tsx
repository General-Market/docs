import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font } from "../../common/fonts";
import { FPS, H, W } from "./theme";

// The "I lost because of …" iceberg.
//
// Iceberg fills the frame width edge to edge. Opens with a hard zoom-out
// from a close-up on the tip (scale 2.6 → ~1.518), then the camera scrolls
// down through six tiers. The scroll clamps when the iceberg's bottom hits
// the frame's bottom — past that, the camera just sits, and the last two
// tiers land lower in the frame because there's nowhere left to go.
//
// Typography matches the rest of AntiCheat — heavy weight, tight tracking,
// hero size, centred. No glass pills.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

const FILL_SCALE = W / IMG_NATIVE_W;                // ~1.518
const FILL_H = IMG_NATIVE_H * FILL_SCALE;           // ~2535

// Scroll never goes below this — the image's bottom rests on the frame's
// bottom and we stop.
const MAX_SCROLL = -(FILL_H - H);                   // ~-1455

// Initial close-up — tip filling the frame width, top of image at top of
// frame. Zooms out to FILL_SCALE.
const ZOOM_START_SCALE = 2.6;

const TIER_Y_NATIVE = [269, 539, 857, 1141, 1430, 1550];
const TIER_Y_FILL = TIER_Y_NATIVE.map((y) => y * FILL_SCALE);
// → [408, 818, 1301, 1732, 2171, 2353]

// Where each active suffix lands in the frame: the upper-line Y for tiers
// 0–3, then wherever the clamp drops it for tiers 4 & 5.
const PRIMARY_ACTIVE_Y = TIER_Y_FILL[0];            // 408

const rawScrollAtTier = (i: number) => PRIMARY_ACTIVE_Y - TIER_Y_FILL[i];
const scrollAtTier = (i: number) => Math.max(rawScrollAtTier(i), MAX_SCROLL);
// T0: 0, T1: -410, T2: -893, T3: -1324, T4: -1455 (clamped), T5: -1455 (clamped)

// Active row frame Y per tier — T0–T3: 408, T4: 716, T5: 898 — derived from
// TIER_Y_FILL[i] + scrollAtTier(i) at render time.

const SUFFIXES: { lines: string[] }[] = [
  { lines: ["strategy"] },
  { lines: ["fees"] },
  { lines: ["liquidation", "hunters"] },
  { lines: ["front", "runners"] },
  { lines: ["orderbook", "spoofers"] },
  { lines: ["insider", "traders"] },
];
const N = SUFFIXES.length;
const LAST = N - 1;

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

// Pacing.
const ZOOM_OUT = 26;
const TIER_ANIM = 11;
const TIER_HOLD = 14;
const FINAL_HOLD = 44;
const OUTRO = 14;

const tierAnimStart = (i: number) => ZOOM_OUT + i * (TIER_ANIM + TIER_HOLD);
const SCENE_FRAMES = tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO;
// 26 + 5*(11+14) + 11 + 44 + 14 = 26 + 125 + 69 = 220

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

// Heavy text shadow — buys readability on any iceberg shade without resorting
// to pills.
const HERO_SHADOW =
  "0 4px 28px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.9), 0 0 56px rgba(0,0,0,0.55)";

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const scale = computeScale(state);
  const scrollY = computeScrollY(state);

  const activeTier = state.phase === "tier" ? state.tier : -1;

  // Where the active row (prefix + suffix) sits in the frame.
  const activeFrameY =
    activeTier >= 0 ? TIER_Y_FILL[activeTier] + scrollY : PRIMARY_ACTIVE_Y;

  // Magnet pulse on the prefix during each tier transition.
  const prefixPulse =
    state.phase === "tier" && state.sub === "anim"
      ? Math.sin(state.t * Math.PI) * 0.04
      : 0;

  let prefixOpacity = 0;
  if (state.phase === "tier") {
    if (state.tier === 0 && state.sub === "anim") {
      prefixOpacity = interpolate(state.t, [0.25, 0.85], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_OUT,
      });
    } else {
      prefixOpacity = 1;
    }
  }

  const introOpacity = interpolate(frame, [0, ZOOM_OUT * 0.3], [0, 1], {
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
        fontFamily: font,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Iceberg — full-width, scrolling, top-centre origin. */}
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

      {/* Past tier suffixes — settled on the iceberg, scrolling with it. */}
      {SUFFIXES.map((s, i) =>
        state.phase === "tier" && i < state.tier ? (
          <PastSuffix key={i} lines={s.lines} index={i} scrollY={scrollY} />
        ) : null,
      )}

      {/* Active row — prefix above the suffix, centred. */}
      {activeTier >= 0 && (
        <ActiveRow
          state={state}
          tier={activeTier}
          activeFrameY={activeFrameY}
          prefixOpacity={prefixOpacity}
          prefixPulse={prefixPulse}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── Active row (prefix + suffix) ─────────────────────────────────────────────

const ActiveRow: React.FC<{
  state: State;
  tier: number;
  activeFrameY: number;
  prefixOpacity: number;
  prefixPulse: number;
}> = ({ state, tier, activeFrameY, prefixOpacity, prefixPulse }) => {
  const s = SUFFIXES[tier];
  const isAnim = state.phase === "tier" && state.sub === "anim";

  let suffixSlide = 0;
  let suffixOpacity = 1;
  let suffixScale = 1;
  if (isAnim) {
    const t = state.t;
    suffixSlide = interpolate(t, [0, 1], [70, 0], { easing: EASE_OUT });
    suffixOpacity = interpolate(t, [0.35, 0.85], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    suffixScale = interpolate(t, [0.55, 0.85, 1], [0.96, 1.05, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_DEFAULT,
    });
  }

  const sizes = suffixSizing(s.lines);

  return (
    <>
      {/* Prefix — small, centred, directly above the suffix. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: activeFrameY,
          transform: `translateY(calc(-100% - ${sizes.totalHeight / 2 + 12}px)) scale(${(1 + prefixPulse).toFixed(3)})`,
          transformOrigin: "center bottom",
          opacity: prefixOpacity,
          textAlign: "center",
          fontFamily: font,
          fontSize: 38,
          fontWeight: 500,
          color: "rgba(255,255,255,0.82)",
          letterSpacing: "-0.018em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          textShadow: HERO_SHADOW,
          pointerEvents: "none",
          willChange: "transform, top, opacity",
        }}
      >
        I lost because of
      </div>

      {/* Suffix — hero size, centred, slides in from below. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: activeFrameY + suffixSlide,
          transform: `translateY(-50%) scale(${suffixScale.toFixed(3)})`,
          transformOrigin: "center center",
          opacity: suffixOpacity,
          textAlign: "center",
          fontFamily: font,
          color: "#FFFFFF",
          letterSpacing: "-0.04em",
          lineHeight: 0.94,
          textShadow: HERO_SHADOW,
          pointerEvents: "none",
          willChange: "transform, top, opacity",
        }}
      >
        {s.lines.map((line, idx) => (
          <div
            key={idx}
            style={{
              fontSize: sizes.perLine[idx],
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </>
  );
};

// ─── Past suffix — sits on the iceberg, dim, no prefix ────────────────────────

const PastSuffix: React.FC<{
  lines: string[];
  index: number;
  scrollY: number;
}> = ({ lines, index, scrollY }) => {
  const y = TIER_Y_FILL[index] + scrollY;
  if (y < -160 || y > H + 160) return null;
  const sizes = suffixSizing(lines, 0.72); // smaller for past tiers

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        transform: "translateY(-50%)",
        textAlign: "center",
        fontFamily: font,
        color: "rgba(255,255,255,0.62)",
        letterSpacing: "-0.04em",
        lineHeight: 0.94,
        textShadow: HERO_SHADOW,
        pointerEvents: "none",
      }}
    >
      {lines.map((line, idx) => (
        <div
          key={idx}
          style={{
            fontSize: sizes.perLine[idx],
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

// ─── Sizing helpers ───────────────────────────────────────────────────────────

const lineSize = (line: string, mult: number): number => {
  if (line.length <= 5) return Math.round(150 * mult);
  if (line.length <= 8) return Math.round(130 * mult);
  return Math.round(110 * mult);
};

const suffixSizing = (
  lines: string[],
  mult = 1,
): { perLine: number[]; totalHeight: number } => {
  const perLine = lines.map((l) => lineSize(l, mult));
  // line-height 0.94 means each line takes ~0.94 * fontSize of vertical space.
  const totalHeight = perLine.reduce((sum, s) => sum + s * 0.94, 0);
  return { perLine, totalHeight };
};

export const antiCheatIcebergMeta = {
  id: "AntiCheatIceberg",
  component: AntiCheatIceberg,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
