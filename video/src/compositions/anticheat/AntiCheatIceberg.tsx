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
// Iceberg fills the frame width edge to edge. Opens with a zoom-out from a
// close-up on the tip (scale 2.6 → 1.518) then scrolls down through six
// bands. The scroll clamps when the iceberg's bottom hits the frame's
// bottom — past that, the last two tiers descend toward the floor instead
// of pulling into a void.
//
// Tier 0 (strategy) now sits in the sky band above the upper pink line;
// every other tier has shifted up one slot.
//
// Each tier supports optional adornment: icon, stat, accent colour, pull
// quote, caption, or source citation. Defaults stay stripped.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

const FILL_SCALE = W / IMG_NATIVE_W;        // ~1.518
const FILL_H = IMG_NATIVE_H * FILL_SCALE;   // ~2535
const MAX_SCROLL = -(FILL_H - H);           // ~-1455 — image bottom on frame bottom

const ZOOM_START_SCALE = 2.6;

// Tier centres in NATIVE asset coordinates — band midpoints, never on the
// pink guide lines themselves. Sky band first (strategy), depths last.
const TIER_Y_NATIVE = [
  Math.round((0 + 269) / 2),       // 134  — sky / above line 1
  Math.round((269 + 539) / 2),     // 404  — tip
  Math.round((539 + 857) / 2),     // 698  — upper underwater
  Math.round((857 + 1141) / 2),    // 999  — mid underwater
  Math.round((1141 + 1430) / 2),   // 1285 — lower iceberg
  Math.round((1430 + 1670) / 2),   // 1550 — depths
];
const TIER_Y_FILL = TIER_Y_NATIVE.map((y) => y * FILL_SCALE);
// → [203, 613, 1060, 1516, 1951, 2353]

// Where T0 lands at scroll = 0. Each subsequent tier scrolls so its centre
// reaches this Y, until the floor clamp kicks in for T4 and T5.
const PRIMARY_ACTIVE_Y = TIER_Y_FILL[0];

const rawScrollAtTier = (i: number) => PRIMARY_ACTIVE_Y - TIER_Y_FILL[i];
const scrollAtTier = (i: number) => Math.max(rawScrollAtTier(i), MAX_SCROLL);

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

// Galaxy-brain trading-tier strip — emoji glyphs so every card renders
// without an external asset. Order goes from the smallest device to the
// most institutional setting; the active tier on the iceberg lights up
// the matching card on the right.
// Each tier has an imageSrc (path under /public, resolved via staticFile)
// and a glyph fallback that renders if the image is missing. Images are
// pulled from Wikimedia Commons (CC BY / CC BY-SA / CC0 / public domain)
// and Pexels (free-use). Credits live in CREDITS.md.
type TradingTier = { imageSrc: string; glyph: string; label: string };

const TRADING_TIERS: TradingTier[] = [
  // T0 — smartphone with stock chart, Pexels, by StockRadars Co.
  { imageSrc: "anticheat-imgs/trader-0.jpg", glyph: "📱", label: "you, on your phone" },
  // T1 — Bloomberg Terminal + keyboard, Wikimedia, CC0
  { imageSrc: "anticheat-imgs/trader-1.jpg", glyph: "💻", label: "prosumer at the desk" },
  // T2 — Satori Traders LLC trade desk, Wikimedia, CC BY-SA 4.0
  { imageSrc: "anticheat-imgs/trader-2.png", glyph: "🖥️", label: "prop firm" },
  // T3 — NYSE Advanced Trading Floor, Wikimedia, CC BY-SA 3.0
  { imageSrc: "anticheat-imgs/trader-3.jpg", glyph: "🏛️", label: "trading floor" },
  // T4 — A1 Houston Office oil traders, Wikimedia, public domain
  { imageSrc: "anticheat-imgs/trader-4.jpg", glyph: "🏦", label: "hedge fund" },
  // T5 — NYSE building exterior, Wikimedia, CC BY 3.0 (Jean-Christophe BENOIST)
  { imageSrc: "anticheat-imgs/trader-5.jpg", glyph: "🏢", label: "investment bank" },
];

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

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

      {/* Past tier suffixes — settled on the iceberg, scroll with it. */}
      {TIERS.map((tier, i) =>
        state.phase === "tier" && i < state.tier ? (
          <PastSuffix key={i} tier={tier} index={i} scrollY={scrollY} />
        ) : null,
      )}

      {/* Active row — prefix + suffix + optional adornments. */}
      {activeTier >= 0 && (
        <ActiveRow
          state={state}
          tier={activeTier}
          activeFrameY={activeFrameY}
          prefixOpacity={prefixOpacity}
          prefixPulse={prefixPulse}
        />
      )}

      {/* Per-tier image bands — one per tier, anchored to its band on
          the iceberg. All six render from the start in greyscale; the
          active band clears to full colour. Each card fills the full
          height of its band on the iceberg, scrolling with the camera —
          like annotations painted onto an iceberg meme. */}
      {TRADING_TIERS.map((tt, i) => (
        <TierImage
          key={i}
          tier={tt}
          index={i}
          scrollY={scrollY}
          isActive={state.phase === "tier" && i === state.tier}
        />
      ))}

      {/* Source citation — bottom-left, mono, only if the active tier has
          a `source`. */}
      {activeTier >= 0 && TIERS[activeTier].source && (
        <SourceCitation url={TIERS[activeTier].source!} state={state} />
      )}
    </AbsoluteFill>
  );
};

// ─── Per-tier image band ──────────────────────────────────────────────────────
//
// One photograph per tier, sitting on the right side of the iceberg and
// filling the full height of its band (the slice of iceberg between two
// pink guide lines). The cards scroll WITH the iceberg, so each photo
// stays glued to its band — like annotations painted onto an iceberg
// meme. All six render from the start in greyscale; the active band
// blooms to full colour as its tier becomes active.

const BAND_BOUNDS_NATIVE: { top: number; bottom: number }[] = [
  { top: 0,    bottom: 269 },   // T0 — sky / strategy
  { top: 269,  bottom: 539 },   // T1 — tip / fees
  { top: 539,  bottom: 857 },   // T2 — upper underwater / liquidation hunters
  { top: 857,  bottom: 1141 },  // T3 — mid / front runners
  { top: 1141, bottom: 1430 },  // T4 — lower / orderbook spoofers
  { top: 1430, bottom: 1670 },  // T5 — depths / insider traders
];

const BAND_BOUNDS = BAND_BOUNDS_NATIVE.map((b) => ({
  top: b.top * FILL_SCALE,
  bottom: b.bottom * FILL_SCALE,
  height: (b.bottom - b.top) * FILL_SCALE,
}));

const BAND_RIGHT_INSET = 0;
const BAND_WIDTH = 360;
const BAND_VERTICAL_PADDING = 0;

const TierImage: React.FC<{
  tier: TradingTier;
  index: number;
  scrollY: number;
  isActive: boolean;
}> = ({ tier, index, scrollY, isActive }) => {
  const band = BAND_BOUNDS[index];
  const top = band.top + scrollY + BAND_VERTICAL_PADDING;
  const height = band.height - BAND_VERTICAL_PADDING * 2;

  if (top + height < -120 || top > H + 120) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: BAND_RIGHT_INSET,
        top,
        width: BAND_WIDTH,
        height,
        overflow: "hidden",
        borderLeft: isActive
          ? "3px solid rgba(255,255,255,0.92)"
          : "1px solid rgba(255,255,255,0.14)",
        boxShadow: isActive
          ? "-12px 0 36px rgba(0,0,0,0.55), inset 0 0 36px rgba(255,255,255,0.18)"
          : "-6px 0 16px rgba(0,0,0,0.45)",
        background: "rgba(8, 12, 22, 0.82)",
        pointerEvents: "none",
        willChange: "top",
      }}
    >
      <Img
        src={staticFile(tier.imageSrc)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: isActive
            ? "saturate(1.08) brightness(1)"
            : "grayscale(1) brightness(0.6)",
          transition: "filter 220ms ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 360,
          bottom: 0,
          padding: "22px 16px 12px",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.88) 100%)",
          fontFamily: font,
          fontSize: 18,
          fontWeight: 600,
          color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.62)",
          letterSpacing: "-0.012em",
          textAlign: "left",
          lineHeight: 1.2,
          textShadow: "0 1px 6px rgba(0,0,0,0.95)",
        }}
      >
        {tier.label}
      </div>
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            fontFamily: monoFont,
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.92)",
            background: "rgba(0,0,0,0.55)",
            padding: "3px 8px",
            borderRadius: 4,
          }}
        >
          ↑ smarter
        </div>
      )}
    </div>
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
  const suffixColor = t.accent ?? "#FFFFFF";

  const HAS_ICON = !!t.icon;
  const HAS_STAT = !!t.stat;
  const HAS_QUOTE = !!t.pullQuote;
  const HAS_CAPTION = !!t.caption;

  let stackBelow = sizes.totalHeight / 2 + 14;
  const statY = stackBelow;
  if (HAS_STAT) stackBelow += 96;
  const quoteY = stackBelow;
  if (HAS_QUOTE) stackBelow += 56;
  const captionY = stackBelow;

  return (
    <>
      {/* Prefix above the icon (if any) or directly above the suffix. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 360,
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

      {/* Optional icon. */}
      {HAS_ICON && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(calc(-100% - ${sizes.totalHeight / 2 + 16}px))`,
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

      {/* Suffix — hero type, slides up with magnet snap. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 360,
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

      {/* Optional stat block. */}
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

      {/* Optional pull quote. */}
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

      {/* Optional caption. */}
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
    </>
  );
};

// ─── Past suffix ──────────────────────────────────────────────────────────────

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
        right: 360,
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
