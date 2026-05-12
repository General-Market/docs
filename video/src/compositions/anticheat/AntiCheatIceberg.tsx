import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W } from "./theme";

// The "I lost because of …" iceberg.
//
// Six tiers, each riding the geometric middle of an iceberg band — never on
// a pink guide line. Opens with a zoom-out from a tight shot of the tip
// (scale 2.6 → 1.518) then scrolls down through the bands. The scroll
// clamps when the iceberg's bottom hits the frame's bottom; the last two
// tiers descend toward the floor instead of scrolling into a void.
//
// Typography matches the rest of AntiCheat — project font, weight 800,
// hero size, centred, heavy shadow.
//
// Each tier supports optional adornment: emoji `icon`, small `caption`,
// or an `imageSrc` for a thumbnail. Slots are off by default — populate
// only where a tier needs the extra emotional beat.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

const FILL_SCALE = W / IMG_NATIVE_W;        // ~1.518
const FILL_H = IMG_NATIVE_H * FILL_SCALE;   // ~2535
const MAX_SCROLL = -(FILL_H - H);           // ~-1455 — image bottom on frame bottom

const ZOOM_START_SCALE = 2.6;

// Pink-line positions in native asset coords (detected): 269, 539, 857,
// 1141, 1430. Tier centres ride the midpoint between adjacent lines, with
// the depths band below line 5 split into two for the last two tiers.
const TIER_Y_NATIVE = [
  Math.round((269 + 539) / 2),     // 404  — between line 1 & 2 (tip)
  Math.round((539 + 857) / 2),     // 698  — between line 2 & 3
  Math.round((857 + 1141) / 2),    // 999  — between line 3 & 4
  Math.round((1141 + 1430) / 2),   // 1285 — between line 4 & 5
  Math.round((1430 + 1550) / 2),   // 1490 — depths, upper
  Math.round((1550 + 1670) / 2),   // 1610 — depths, lower
];
const TIER_Y_FILL = TIER_Y_NATIVE.map((y) => y * FILL_SCALE);

// Where T0 lands in the frame at scroll = 0. Every subsequent tier scrolls
// so its centre aligns here too, until the floor clamp kicks in.
const PRIMARY_ACTIVE_Y = TIER_Y_FILL[0]; // ~613

const rawScrollAtTier = (i: number) => PRIMARY_ACTIVE_Y - TIER_Y_FILL[i];
const scrollAtTier = (i: number) => Math.max(rawScrollAtTier(i), MAX_SCROLL);
// T0: 0, T1: -447, T2: -903, T3: -1338, T4: -1455 (clamped), T5: -1455

// ─── Tier content ─────────────────────────────────────────────────────────────
//
// Each tier can lean on any combination of these adornments. Pick the one
// that does the most work for the tier's emotional beat — leave the rest
// off so the slide stays clean.
//
//   icon      — emoji or single glyph, sits above the prefix
//   stat      — large secondary number underneath the suffix, e.g. "$2.4B"
//   statUnit  — small unit beside the stat, e.g. "annual MEV"
//   accent    — hex colour for the suffix; default is #FFFFFF (warm-tints
//               the punchline tier or any tier you want to load up)
//   pullQuote — italic single-line quote underneath, like a footnote that
//               speaks ("the house always knows first")
//   caption   — neutral subtitle underneath the suffix (no italics, no
//               quotes); use for plain qualifiers
//   imageSrc  — optional thumbnail asset under /public, scaled to fit
//   source    — small mono citation pinned bottom-left of the frame,
//               same treatment as AntiCheatRigged's source line
//
// Examples (paste any onto a tier to see it in action):
//
//   { word: ["fees"], stat: "−$2.4B", statUnit: "annual MEV (Flashbots)" }
//   { word: ["liquidation", "hunters"], pullQuote: "stop-hunted at 3am" }
//   { word: ["insider", "traders"], accent: "#FF3A4F",
//     source: "sec.gov/news/press-release/2022-127" }
//   { word: ["front", "runners"], icon: "⚡",
//     imageSrc: "anticheat-imgs/hft-racks.png" }

type Tier = {
  word: string[];
  icon?: string;
  stat?: string;
  statUnit?: string;
  accent?: string;
  pullQuote?: string;
  caption?: string;
  imageSrc?: string;
  source?: string;
};

export const TIERS: Tier[] = [
  { word: ["strategy"] },
  { word: ["fees"] },
  { word: ["liquidation", "hunters"] },
  { word: ["front", "runners"] },
  { word: ["orderbook", "spoofers"] },
  { word: ["insider", "traders"] },
];
const N = TIERS.length;
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
// 26 + 5*(11+14) + 11 + 44 + 14 = 220

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
  // Subtle hold-pulse so the camera isn't dead between snaps. ±0.8 %.
  if (state.sub === "hold") {
    const pulse = Math.sin(state.t * Math.PI) * 0.008;
    return FILL_SCALE * (1 + pulse);
  }
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

// Heavy multi-layer shadow — buys legibility on any iceberg shade without
// glass pills.
const HERO_SHADOW =
  "0 4px 28px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.9), 0 0 56px rgba(0,0,0,0.55)";

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const scale = computeScale(state);
  const scrollY = computeScrollY(state);

  const activeTier = state.phase === "tier" ? state.tier : -1;
  const activeFrameY =
    activeTier >= 0 ? TIER_Y_FILL[activeTier] + scrollY : PRIMARY_ACTIVE_Y;

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

  // Vignette intensifies as we descend — emotion through atmosphere, not
  // chrome. Scale [0..1] from the first tier to the last.
  const descentProgress =
    state.phase === "tier" ? state.tier / LAST : 0;
  const vignetteAlpha = 0.18 + 0.32 * descentProgress;

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

      {/* Atmospheric vignette that deepens as we descend. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(0,0,0,${vignetteAlpha.toFixed(3)}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Past tier suffixes — settled on the iceberg, scrolling with it. */}
      {TIERS.map((tier, i) =>
        state.phase === "tier" && i < state.tier ? (
          <PastSuffix key={i} tier={tier} index={i} scrollY={scrollY} />
        ) : null,
      )}

      {/* Active row — prefix + suffix + any optional adornments. */}
      {activeTier >= 0 && (
        <ActiveRow
          state={state}
          tier={activeTier}
          activeFrameY={activeFrameY}
          prefixOpacity={prefixOpacity}
          prefixPulse={prefixPulse}
        />
      )}

      {/* Source citation — bottom-left, mono, pinned to the frame. Same
          treatment as AntiCheatRigged's source line. Only renders if the
          active tier has a `source`. */}
      {activeTier >= 0 && TIERS[activeTier].source && (
        <SourceCitation url={TIERS[activeTier].source!} state={state} />
      )}
    </AbsoluteFill>
  );
};

// ─── Active row ───────────────────────────────────────────────────────────────

const ActiveRow: React.FC<{
  state: State;
  tier: number;
  activeFrameY: number;
  prefixOpacity: number;
  prefixPulse: number;
}> = ({ state, tier, activeFrameY, prefixOpacity, prefixPulse }) => {
  const t = TIERS[tier];
  const isAnim = state.phase === "tier" && state.sub === "anim";

  let suffixSlide = 0;
  let suffixOpacity = 1;
  let suffixScale = 1;
  if (isAnim) {
    const at = state.t;
    suffixSlide = interpolate(at, [0, 1], [70, 0], { easing: EASE_OUT });
    suffixOpacity = interpolate(at, [0.35, 0.85], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    suffixScale = interpolate(at, [0.55, 0.85, 1], [0.96, 1.05, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_DEFAULT,
    });
  }

  const sizes = suffixSizing(t.word);

  // Adornment presence flags. The renderer stacks them around the suffix;
  // each is independent and can be combined or left empty.
  const HAS_ICON = !!t.icon;
  const HAS_STAT = !!t.stat;
  const HAS_QUOTE = !!t.pullQuote;
  const HAS_CAPTION = !!t.caption;
  const HAS_IMAGE = !!t.imageSrc;

  // Suffix colour — defaults to white, can be tinted per tier.
  const suffixColor = t.accent ?? "#FFFFFF";

  // Stacking below the suffix: stat first (closest to suffix), then quote,
  // then caption, then image. Each block adds its height to the running
  // offset so successive blocks land below the previous one.
  let stackBelow = sizes.totalHeight / 2 + 14;
  const statY = stackBelow;
  if (HAS_STAT) stackBelow += 96; // stat ~64px + gap
  const quoteY = stackBelow;
  if (HAS_QUOTE) stackBelow += 56;
  const captionY = stackBelow;
  if (HAS_CAPTION) stackBelow += 48;
  const imageY = stackBelow + 8;

  return (
    <>
      {/* Prefix above the icon (or the suffix if no icon). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: activeFrameY,
          transform: `translateY(calc(-100% - ${
            sizes.totalHeight / 2 + (HAS_ICON ? 84 : 12)
          }px)) scale(${(1 + prefixPulse).toFixed(3)})`,
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

      {/* Optional icon — emoji or glyph above the suffix. */}
      {HAS_ICON && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(calc(-100% - ${sizes.totalHeight / 2 + 16}px))`,
            transformOrigin: "center bottom",
            opacity: suffixOpacity,
            textAlign: "center",
            fontSize: 72,
            lineHeight: 1,
            textShadow: HERO_SHADOW,
            pointerEvents: "none",
          }}
        >
          {t.icon}
        </div>
      )}

      {/* Suffix — hero type, slides in from below. Accent colour optional. */}
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
          color: suffixColor,
          letterSpacing: "-0.04em",
          lineHeight: 0.94,
          textShadow: t.accent
            ? `${HERO_SHADOW}, 0 0 48px ${t.accent}55`
            : HERO_SHADOW,
          pointerEvents: "none",
          willChange: "transform, top, opacity",
        }}
      >
        {t.word.map((line, idx) => (
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

      {/* Optional stat block — large number + small unit, below the suffix. */}
      {HAS_STAT && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(${statY}px)`,
            opacity: suffixOpacity,
            textAlign: "center",
            fontFamily: font,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: t.accent ?? "rgba(255,255,255,0.95)",
              letterSpacing: "-0.03em",
              textShadow: HERO_SHADOW,
              whiteSpace: "nowrap",
            }}
          >
            {t.stat}
          </div>
          {t.statUnit && (
            <div
              style={{
                marginTop: 6,
                fontSize: 22,
                fontWeight: 500,
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                textShadow: HERO_SHADOW,
              }}
            >
              {t.statUnit}
            </div>
          )}
        </div>
      )}

      {/* Optional pull quote — italic, narrow, smaller than the suffix. */}
      {HAS_QUOTE && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(${quoteY}px)`,
            opacity: suffixOpacity,
            textAlign: "center",
            fontFamily: font,
            fontSize: 30,
            fontStyle: "italic",
            fontWeight: 400,
            color: "rgba(255,255,255,0.78)",
            letterSpacing: "-0.012em",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            textShadow: HERO_SHADOW,
            pointerEvents: "none",
          }}
        >
          &ldquo;{t.pullQuote}&rdquo;
        </div>
      )}

      {/* Optional caption — neutral subtitle. */}
      {HAS_CAPTION && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(${captionY}px)`,
            opacity: suffixOpacity,
            textAlign: "center",
            fontFamily: font,
            fontSize: 26,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "-0.012em",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            textShadow: HERO_SHADOW,
            pointerEvents: "none",
          }}
        >
          {t.caption}
        </div>
      )}

      {/* Optional image — thumbnail, sits below everything else. */}
      {HAS_IMAGE && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(${imageY}px)`,
            opacity: suffixOpacity,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Img
            src={staticFile(t.imageSrc!)}
            style={{
              maxWidth: 360,
              maxHeight: 180,
              borderRadius: 12,
              filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
            }}
          />
        </div>
      )}
    </>
  );
};

// ─── Source citation ──────────────────────────────────────────────────────────
//
// Pinned to the bottom-left of the frame in mono, matching AntiCheatRigged's
// treatment. Fades in once a tier carrying a `source` becomes active.

const SourceCitation: React.FC<{ url: string; state: State }> = ({
  url,
  state,
}) => {
  const opacity =
    state.phase === "tier" && state.sub === "anim"
      ? interpolate(state.t, [0.35, 0.85], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE_OUT,
        })
      : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        bottom: 48,
        maxWidth: 960,
        fontFamily: monoFont,
        fontSize: 22,
        lineHeight: 1.35,
        color: "rgba(255,255,255,0.78)",
        letterSpacing: "0.01em",
        wordBreak: "break-all",
        opacity,
        textShadow: "0 1px 2px rgba(0,0,0,0.85)",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.5)", marginRight: 8 }}>
        source —
      </span>
      {url}
    </div>
  );
};

// ─── Past suffix ──────────────────────────────────────────────────────────────
//
// Sits on the iceberg at its tier centre, scrolls with it, no prefix.

const PastSuffix: React.FC<{
  tier: Tier;
  index: number;
  scrollY: number;
}> = ({ tier, index, scrollY }) => {
  const y = TIER_Y_FILL[index] + scrollY;
  if (y < -200 || y > H + 200) return null;
  const sizes = suffixSizing(tier.word, 0.72);

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
        color: "rgba(255,255,255,0.58)",
        letterSpacing: "-0.04em",
        lineHeight: 0.94,
        textShadow: HERO_SHADOW,
        pointerEvents: "none",
      }}
    >
      {tier.word.map((line, idx) => (
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
