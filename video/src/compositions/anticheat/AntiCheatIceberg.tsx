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

// The "I lost because of …" iceberg, side-by-side with a "smarter and
// smarter" trading-tier strip on the right.
//
// Opens with a zoom-out from a tight shot on the iceberg's tip (scale 1.0,
// image overflowing the bottom of the frame) to FIT_SCALE (~0.647) — full
// iceberg visible, left-aligned. The right strip fades in once the iceberg
// has settled.
//
// No scrolling. All six tier slots sit on the iceberg simultaneously; the
// prefix is the only element that magnets between them. Past suffixes stay
// dim; the active suffix lands with a magnet-snap.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

// FIT_SCALE puts the iceberg's full height across the frame. Image becomes
// IMG_NATIVE_W × FIT_SCALE wide — leaves room for the right strip.
const FIT_SCALE = H / IMG_NATIVE_H;                 // ~0.647
const ICEBERG_DISPLAY_W = IMG_NATIVE_W * FIT_SCALE; // ~819
const ICEBERG_LEFT = 0;                              // flush with the left edge

// Opening close-up — image at native size, overflowing the frame bottom.
const ZOOM_START_SCALE = 1.0;

// Tier centres in NATIVE asset coordinates. Strategy now sits in the sky
// band (above the upper line); every other tier shifts up one slot.
const TIER_Y_NATIVE = [
  Math.round((0 + 269) / 2),       // 134  — sky / above line 1
  Math.round((269 + 539) / 2),     // 404  — tip
  Math.round((539 + 857) / 2),     // 698  — upper underwater
  Math.round((857 + 1141) / 2),    // 999  — mid underwater
  Math.round((1141 + 1430) / 2),   // 1285 — lower iceberg
  Math.round((1430 + 1670) / 2),   // 1550 — depths
];
// Tier centres in FRAME coordinates at FIT_SCALE.
const TIER_Y = TIER_Y_NATIVE.map((y) => Math.round(y * FIT_SCALE));
// → [87, 262, 452, 647, 832, 1003]

// ─── Iceberg tiers ────────────────────────────────────────────────────────────

type Tier = {
  word: string[];
  icon?: string;
  stat?: string;
  statUnit?: string;
  accent?: string;
  pullQuote?: string;
  caption?: string;
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

// ─── Trading tier strip ───────────────────────────────────────────────────────
//
// Galaxy-brain-style progression on the right: who's on the other side of
// each trade. Smallest at top (retail), biggest at bottom (institution).
// `imageSrc` is a path under /public — drop your CC-licensed photos there
// or paste a remote URL into `remoteUrl` instead.
//
// Suggested sources (all Wikimedia Commons, CC BY or CC BY-SA):
//   • retail / phone trader   — search "smartphone trader" or "Robinhood app"
//   • dual-monitor / prosumer — search "stock trader desk"
//   • prop firm / day traders — search "day trading office"
//   • trading floor           — "Chicago Board of Trade" or "NYSE floor"
//   • hedge fund / pit        — "trading floor hedge fund"
//   • investment bank tower   — "Goldman Sachs Tower" or "JPMorgan Chase Tower"
//
// Save them to /public/anticheat-imgs/trader-{0..5}.jpg and the paths below
// will resolve. Until they exist, the renderer falls back to a labelled
// dark card so the layout still makes sense.

type TradingTier = {
  label: string;
  imageSrc?: string;
};

const TRADING_TIERS: TradingTier[] = [
  { label: "you, on your phone", imageSrc: "anticheat-imgs/trader-0.jpg" },
  { label: "prosumer at the desk", imageSrc: "anticheat-imgs/trader-1.jpg" },
  { label: "prop firm", imageSrc: "anticheat-imgs/trader-2.jpg" },
  { label: "trading floor", imageSrc: "anticheat-imgs/trader-3.jpg" },
  { label: "hedge fund", imageSrc: "anticheat-imgs/trader-4.jpg" },
  { label: "investment bank", imageSrc: "anticheat-imgs/trader-5.jpg" },
];

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

const ZOOM_OUT = 26;
const PANEL_FADE_IN = 12;
const TIER_ANIM = 11;
const TIER_HOLD = 14;
const FINAL_HOLD = 44;
const OUTRO = 14;

const PRE_TIERS = ZOOM_OUT + PANEL_FADE_IN;
const tierAnimStart = (i: number) => PRE_TIERS + i * (TIER_ANIM + TIER_HOLD);
const SCENE_FRAMES = tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO;
// 26 + 12 + 5*(11+14) + 11 + 44 + 14 = 38 + 125 + 69 = 232

type State =
  | { phase: "zoom"; t: number }
  | { phase: "panel"; t: number }
  | { phase: "tier"; tier: number; sub: "anim" | "hold"; t: number };

const stateAt = (frame: number): State => {
  if (frame < ZOOM_OUT) return { phase: "zoom", t: frame / ZOOM_OUT };
  if (frame < PRE_TIERS)
    return { phase: "panel", t: (frame - ZOOM_OUT) / PANEL_FADE_IN };
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

const computeIcebergScale = (state: State): number => {
  if (state.phase === "zoom")
    return interpolate(state.t, [0, 1], [ZOOM_START_SCALE, FIT_SCALE], {
      easing: EASE_OUT,
    });
  return FIT_SCALE;
};

const HERO_SHADOW =
  "0 4px 28px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.9), 0 0 56px rgba(0,0,0,0.55)";

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const icebergScale = computeIcebergScale(state);

  const activeTier = state.phase === "tier" ? state.tier : -1;

  // Prefix Y — magnets between active tier centres in iceberg-display coords.
  let prefixYTarget = activeTier >= 0 ? TIER_Y[activeTier] : TIER_Y[0];
  let prefixYStart = activeTier > 0 ? TIER_Y[activeTier - 1] : prefixYTarget;
  let prefixY = prefixYTarget;
  if (state.phase === "tier" && state.sub === "anim" && state.tier > 0) {
    prefixY = prefixYStart + (prefixYTarget - prefixYStart) * EASE_OUT(state.t);
  }

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

  // Panel opacity — fades in after zoom-out completes.
  let panelOpacity = 0;
  if (state.phase === "panel")
    panelOpacity = interpolate(state.t, [0, 1], [0, 1], { easing: EASE_OUT });
  if (state.phase === "tier") panelOpacity = 1;

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
      {/* Iceberg — left-aligned, fits frame height after zoom-out. */}
      <div
        style={{
          position: "absolute",
          left: ICEBERG_LEFT,
          top: 0,
          width: IMG_NATIVE_W,
          height: IMG_NATIVE_H,
          transform: `scale(${icebergScale.toFixed(4)})`,
          transformOrigin: "top left",
          willChange: "transform",
        }}
      >
        <Img
          src={staticFile("iceberg-tiers.webp")}
          style={{ width: IMG_NATIVE_W, height: IMG_NATIVE_H, display: "block" }}
        />
      </div>

      {/* Vignette deepens with descent. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 25% 50%, rgba(0,0,0,0) 35%, rgba(0,0,0,${vignetteAlpha.toFixed(3)}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Past tier suffixes — all six are placed on the iceberg, but only
          those whose tier has been reached actually render. */}
      {TIERS.map((tier, i) =>
        state.phase === "tier" && i < state.tier ? (
          <PastSuffix key={i} tier={tier} index={i} />
        ) : null,
      )}

      {/* Active row — prefix + suffix on the iceberg. */}
      {activeTier >= 0 && (
        <ActiveRow
          state={state}
          tier={activeTier}
          activeY={TIER_Y[activeTier]}
          prefixY={prefixY}
          prefixOpacity={prefixOpacity}
          prefixPulse={prefixPulse}
        />
      )}

      {/* Right strip — galaxy-brain progression of trading entities. */}
      <TradingTierStrip activeTier={activeTier} opacity={panelOpacity} />

      {/* Optional source citation from the active tier. */}
      {activeTier >= 0 && TIERS[activeTier].source && (
        <SourceCitation url={TIERS[activeTier].source!} state={state} />
      )}
    </AbsoluteFill>
  );
};

// ─── Active row ───────────────────────────────────────────────────────────────
//
// Prefix + suffix, anchored to the iceberg's left side (centred within the
// iceberg's displayed width, not the frame's).

const ActiveRow: React.FC<{
  state: State;
  tier: number;
  activeY: number;
  prefixY: number;
  prefixOpacity: number;
  prefixPulse: number;
}> = ({ state, tier, activeY, prefixY, prefixOpacity, prefixPulse }) => {
  const t = TIERS[tier];
  const isAnim = state.phase === "tier" && state.sub === "anim";

  let suffixSlide = 0;
  let suffixOpacity = 1;
  let suffixScale = 1;
  if (isAnim) {
    const at = state.t;
    suffixSlide = interpolate(at, [0, 1], [56, 0], { easing: EASE_OUT });
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
  const suffixColor = t.accent ?? "#FFFFFF";

  return (
    <>
      {/* Prefix above the suffix. */}
      <div
        style={{
          position: "absolute",
          left: ICEBERG_LEFT,
          top: prefixY,
          width: ICEBERG_DISPLAY_W,
          textAlign: "center",
          transform: `translateY(calc(-100% - ${sizes.totalHeight / 2 + 8}px)) scale(${(1 + prefixPulse).toFixed(3)})`,
          transformOrigin: "center bottom",
          opacity: prefixOpacity,
          fontFamily: font,
          fontSize: 28,
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

      {/* Optional icon above the prefix. */}
      {t.icon && (
        <div
          style={{
            position: "absolute",
            left: ICEBERG_LEFT,
            top: prefixY,
            width: ICEBERG_DISPLAY_W,
            textAlign: "center",
            transform: `translateY(calc(-100% - ${sizes.totalHeight / 2 + 72}px))`,
            opacity: suffixOpacity,
            fontSize: 56,
            lineHeight: 1,
            textShadow: HERO_SHADOW,
            pointerEvents: "none",
          }}
        >
          {t.icon}
        </div>
      )}

      {/* Suffix. */}
      <div
        style={{
          position: "absolute",
          left: ICEBERG_LEFT,
          top: activeY + suffixSlide,
          width: ICEBERG_DISPLAY_W,
          textAlign: "center",
          transform: `translateY(-50%) scale(${suffixScale.toFixed(3)})`,
          transformOrigin: "center center",
          opacity: suffixOpacity,
          fontFamily: font,
          color: suffixColor,
          letterSpacing: "-0.04em",
          lineHeight: 0.94,
          textShadow: t.accent
            ? `${HERO_SHADOW}, 0 0 36px ${t.accent}55`
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

      {/* Optional stat + unit beneath the suffix. */}
      {t.stat && (
        <div
          style={{
            position: "absolute",
            left: ICEBERG_LEFT,
            top: activeY,
            width: ICEBERG_DISPLAY_W,
            textAlign: "center",
            transform: `translateY(${sizes.totalHeight / 2 + 14}px)`,
            opacity: suffixOpacity,
            fontFamily: font,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: 52,
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
                fontSize: 18,
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

      {/* Optional pull quote. */}
      {t.pullQuote && (
        <div
          style={{
            position: "absolute",
            left: ICEBERG_LEFT,
            top: activeY,
            width: ICEBERG_DISPLAY_W,
            textAlign: "center",
            transform: `translateY(${sizes.totalHeight / 2 + (t.stat ? 110 : 14)}px)`,
            opacity: suffixOpacity,
            fontFamily: font,
            fontSize: 24,
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

      {/* Optional caption. */}
      {t.caption && (
        <div
          style={{
            position: "absolute",
            left: ICEBERG_LEFT,
            top: activeY,
            width: ICEBERG_DISPLAY_W,
            textAlign: "center",
            transform: `translateY(${
              sizes.totalHeight / 2 + (t.stat ? 110 : 14) + (t.pullQuote ? 44 : 0)
            }px)`,
            opacity: suffixOpacity,
            fontFamily: font,
            fontSize: 22,
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
    </>
  );
};

// ─── Past suffix ──────────────────────────────────────────────────────────────

const PastSuffix: React.FC<{ tier: Tier; index: number }> = ({
  tier,
  index,
}) => {
  const sizes = suffixSizing(tier.word, 0.72);
  return (
    <div
      style={{
        position: "absolute",
        left: ICEBERG_LEFT,
        top: TIER_Y[index],
        width: ICEBERG_DISPLAY_W,
        textAlign: "center",
        transform: "translateY(-50%)",
        fontFamily: font,
        color: "rgba(255,255,255,0.55)",
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

// ─── Trading-tier strip ───────────────────────────────────────────────────────
//
// Six small image cards stacked on the right side of the frame, in the
// space the iceberg doesn't claim. Active card scales up, brightens, and
// glows. Inactive cards stay small and muted.

const STRIP_LEFT = 920;
const STRIP_RIGHT = 1880;
const STRIP_WIDTH = STRIP_RIGHT - STRIP_LEFT;            // 960
const STRIP_TOP = 40;
const STRIP_BOTTOM = 1040;
const STRIP_HEIGHT = STRIP_BOTTOM - STRIP_TOP;           // 1000

const CARD_HEIGHT = (STRIP_HEIGHT - 5 * 12) / N;         // ~157
const CARD_WIDTH = Math.min(STRIP_WIDTH, 360);

const TradingTierStrip: React.FC<{
  activeTier: number;
  opacity: number;
}> = ({ activeTier, opacity }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: STRIP_LEFT,
        top: STRIP_TOP,
        width: STRIP_WIDTH,
        height: STRIP_HEIGHT,
        opacity,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        pointerEvents: "none",
        willChange: "opacity",
      }}
    >
      {TRADING_TIERS.map((tt, i) => {
        const isActive = i === activeTier;
        const cardScale = isActive ? 1.04 : 0.9;
        const cardOpacity = activeTier < 0 ? 0.5 : isActive ? 1 : 0.42;
        return (
          <div
            key={i}
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              transform: `scale(${cardScale})`,
              opacity: cardOpacity,
              transition: "transform 120ms ease, opacity 120ms ease",
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              border: isActive
                ? "2px solid rgba(255,255,255,0.85)"
                : "1px solid rgba(255,255,255,0.18)",
              boxShadow: isActive
                ? "0 12px 40px rgba(0,0,0,0.6), 0 0 32px rgba(255,255,255,0.18)"
                : "0 6px 18px rgba(0,0,0,0.45)",
              background: "rgba(8, 12, 22, 0.78)",
            }}
          >
            {tt.imageSrc ? (
              <Img
                src={staticFile(tt.imageSrc)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  opacity: isActive ? 1 : 0.85,
                }}
              />
            ) : (
              <PlaceholderCard label={tt.label} />
            )}

            {/* Caption strip across the bottom of the card. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "8px 14px",
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)",
                fontFamily: font,
                fontSize: 18,
                fontWeight: 600,
                color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.78)",
                letterSpacing: "-0.012em",
                textShadow: "0 2px 6px rgba(0,0,0,0.9)",
                textAlign: "left",
              }}
            >
              {tt.label}
            </div>

            {/* "Smarter →" arrow on the active card. */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  fontFamily: monoFont,
                  fontSize: 14,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.86)",
                  textShadow: "0 1px 4px rgba(0,0,0,0.85)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.45)",
                }}
              >
                ↑ smarter
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const PlaceholderCard: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, rgba(20,28,48,0.92) 0%, rgba(8,12,22,0.96) 100%)",
        fontFamily: monoFont,
        fontSize: 13,
        color: "rgba(255,255,255,0.42)",
        textAlign: "center",
        padding: "0 12px",
      }}
    >
      drop image at /public/anticheat-imgs/trader-…
      <br />— {label} —
    </div>
  );
};

// ─── Source citation ──────────────────────────────────────────────────────────

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
        maxWidth: 700,
        fontFamily: monoFont,
        fontSize: 18,
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

// ─── Sizing helpers ───────────────────────────────────────────────────────────
//
// Smaller hero sizes than the full-width version — the iceberg only owns
// ~819px of horizontal real estate now.

const lineSize = (line: string, mult: number): number => {
  if (line.length <= 5) return Math.round(96 * mult);
  if (line.length <= 8) return Math.round(86 * mult);
  return Math.round(70 * mult);
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
