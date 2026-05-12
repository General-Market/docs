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

      {/* Trading-tier strip — galaxy-brain progression of who's on the
          other side of each trade. Floats on the right of the frame and
          fades in once the zoom-out completes. */}
      <TradingTierStrip activeTier={activeTier} state={state} />

      {/* Source citation — bottom-left, mono, only if the active tier has
          a `source`. */}
      {activeTier >= 0 && TIERS[activeTier].source && (
        <SourceCitation url={TIERS[activeTier].source!} state={state} />
      )}
    </AbsoluteFill>
  );
};

// ─── Trading-tier strip ───────────────────────────────────────────────────────
//
// Six emoji-glyph cards stacked vertically on the right edge of the frame,
// overlaying the iceberg's dark water/sky margin. Active card scales up,
// brightens, and gains a white border + glow.

const STRIP_RIGHT_INSET = 40;
const STRIP_WIDTH = 240;
const STRIP_TOP = 40;
const STRIP_BOTTOM = 1040;
const STRIP_HEIGHT = STRIP_BOTTOM - STRIP_TOP;
const CARD_GAP = 8;
const CARD_HEIGHT = (STRIP_HEIGHT - (N - 1) * CARD_GAP) / N;

const TradingTierStrip: React.FC<{
  activeTier: number;
  state: State;
}> = ({ activeTier, state }) => {
  // Strip fades in over the first half of T0's anim window so it doesn't
  // compete with the zoom-out.
  let stripOpacity = 0;
  if (state.phase === "tier") {
    if (state.tier === 0 && state.sub === "anim") {
      stripOpacity = interpolate(state.t, [0, 1], [0, 1], {
        easing: EASE_OUT,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    } else {
      stripOpacity = 1;
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        right: STRIP_RIGHT_INSET,
        top: STRIP_TOP,
        width: STRIP_WIDTH,
        height: STRIP_HEIGHT,
        opacity: stripOpacity,
        display: "flex",
        flexDirection: "column",
        gap: CARD_GAP,
        pointerEvents: "none",
        willChange: "opacity",
      }}
    >
      {TRADING_TIERS.map((tt, i) => {
        const isActive = i === activeTier;
        const isPassed = activeTier > i;
        const cardScale = isActive ? 1.04 : 0.94;
        const cardOpacity = isActive ? 1 : isPassed ? 0.62 : 0.42;
        return (
          <div
            key={i}
            style={{
              width: "100%",
              height: CARD_HEIGHT,
              transform: `scale(${cardScale})`,
              transformOrigin: "right center",
              opacity: cardOpacity,
              transition: "transform 120ms ease, opacity 120ms ease",
              borderRadius: 14,
              border: isActive
                ? "2px solid rgba(255,255,255,0.85)"
                : "1px solid rgba(255,255,255,0.18)",
              boxShadow: isActive
                ? "0 12px 36px rgba(0,0,0,0.6), 0 0 28px rgba(255,255,255,0.18)"
                : "0 6px 16px rgba(0,0,0,0.45)",
              background: "rgba(8, 12, 22, 0.82)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Photograph fills the card; label rides on a gradient strip
                across the bottom so it stays readable. Glyph is kept in
                the data as a fallback but isn't rendered when the image
                loads — Remotion's <Img> errors loudly if the file is
                missing, so an absent asset is visible immediately. */}
            <Img
              src={staticFile(tt.imageSrc)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: isActive
                  ? "saturate(1.05)"
                  : "saturate(0.75) brightness(0.8)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "16px 12px 8px",
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.86) 100%)",
                fontFamily: font,
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.82)",
                letterSpacing: "-0.01em",
                textAlign: "center",
                lineHeight: 1.2,
                textShadow: "0 1px 4px rgba(0,0,0,0.95)",
              }}
            >
              {tt.label}
            </div>
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  fontFamily: monoFont,
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.86)",
                  background: "rgba(0,0,0,0.5)",
                  padding: "2px 6px",
                  borderRadius: 3,
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
