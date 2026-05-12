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
import { FPS, H, W, colors } from "./theme";

// The "I lost because of …" iceberg. Camera descends through six tiers.
// Suffix words are painted onto the iceberg at each tier's natural Y and
// scroll with it — they stay anchored. The prefix is a single element
// that magnets onto each active tier, moving down the frame as we descend.

const IMG_W = 1100;
const IMG_NATIVE_RATIO = 2238 / 1265;
const IMG_H = Math.round(IMG_W * IMG_NATIVE_RATIO); // 1946
const IMG_LEFT = Math.round((W - IMG_W) / 2);       // 410 — centered
const SCROLL_RANGE = IMG_H - H;                     // 866

// Natural tier centres in displayed image coordinates, derived from the
// pink guide lines on the source asset (scaled 1265/1265). One Y per tier.
const TIER_Y = [82, 286, 600, 928, 1248, 1672];

// Horizontal anchor for tier labels — sits in the dark right margin of the
// iceberg silhouette, off the ice itself, so type stays legible against a
// uniform dark backdrop.
const LABEL_X = 760;

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

// Timing — tight. Every tier crosses screen quickly; the punchline holds.
//   INTRO    open on the top of the iceberg, brief settle
//   HOLD     read the active tier
//   SNAP     scroll + prefix magnet to the next tier
//   FINAL    extra hold on "insider traders"
//   OUTRO    fade out
const INTRO = 6;
const HOLD = 14;
const SNAP = 8;
const FINAL = 28;
const OUTRO = 12;

const tierStart = (i: number) => INTRO + i * (HOLD + SNAP);
const SCENE_FRAMES = tierStart(LAST) + HOLD + FINAL + OUTRO;
// 6 + 5*(14+8) + 14 + 28 + 12 = 6 + 110 + 54 = 170

// Iceberg scroll per tier — linear across full image range.
const scrollAtTier = (i: number) => -(SCROLL_RANGE / LAST) * i;

const snapEase = Easing.bezier(0.45, 0, 0.2, 1);

type TierState = { index: number; phase: "hold" | "snap"; t: number };

const tierAt = (frame: number): TierState => {
  if (frame < INTRO) return { index: 0, phase: "hold", t: 0 };
  for (let i = 0; i < LAST; i++) {
    const holdStart = tierStart(i);
    const snapStart = holdStart + HOLD;
    const snapEnd = snapStart + SNAP;
    if (frame < snapStart) return { index: i, phase: "hold", t: 0 };
    if (frame < snapEnd)
      return { index: i, phase: "snap", t: (frame - snapStart) / SNAP };
  }
  return { index: LAST, phase: "hold", t: 0 };
};

const computeScroll = (state: TierState): number => {
  if (state.phase === "hold") return scrollAtTier(state.index);
  const a = scrollAtTier(state.index);
  const b = scrollAtTier(state.index + 1);
  return a + (b - a) * snapEase(state.t);
};

// Prefix content-Y — magnets between active tiers. Sits the suffix label
// at the prefix's right hand, both at the same Y on the iceberg.
const computePrefixY = (state: TierState): number => {
  if (state.phase === "hold") return TIER_Y[state.index];
  const a = TIER_Y[state.index];
  const b = TIER_Y[state.index + 1];
  return a + (b - a) * snapEase(state.t);
};

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = tierAt(frame);
  const scrollY = computeScroll(state);
  const prefixY = computePrefixY(state);

  const introOpacity = interpolate(frame, [0, INTRO * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(
    frame,
    [SCENE_FRAMES - OUTRO, SCENE_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneOpacity = Math.min(introOpacity, outroOpacity);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#04060C",
        fontFamily: font,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Scrolling wrapper — iceberg + suffix labels + prefix all live here.
          One translateY moves the whole world. */}
      <div
        style={{
          position: "absolute",
          left: IMG_LEFT,
          top: 0,
          width: IMG_W,
          height: IMG_H,
          transform: `translate3d(0, ${scrollY.toFixed(2)}px, 0)`,
          willChange: "transform",
        }}
      >
        <Img
          src={staticFile("iceberg-tiers.webp")}
          style={{
            width: IMG_W,
            height: IMG_H,
            display: "block",
          }}
        />

        {/* Caustic shimmer over the underwater section. */}
        <CausticShimmer />

        {/* Six suffix labels, anchored to natural tier Y. They stay. */}
        {SUFFIXES.map((word, i) => (
          <SuffixLabel
            key={i}
            word={word}
            y={TIER_Y[i]}
            active={state.index === i}
            passed={state.index > i}
            emphasis={i === LAST}
          />
        ))}

        {/* Prefix — magnets to active tier inside the wrapper, so it scrolls
            with the iceberg between snaps. */}
        <PrefixLabel y={prefixY} state={state} />
      </div>

      {/* Tier counter — pinned to the frame, not the scroll. */}
      <TierCounter index={state.index} />

      {/* Edge vignette — pulls focus to the band where the prefix is. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Prefix label ─────────────────────────────────────────────────────────────
//
// One element, content-Y animates between tier rows. During snap it briefly
// scales — the "catch" frame — so the magnet reads as a physical jolt.

const PrefixLabel: React.FC<{ y: number; state: TierState }> = ({ y, state }) => {
  const pulse =
    state.phase === "snap" ? Math.sin(state.t * Math.PI) : 0;
  const scale = 1 + pulse * 0.04;

  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        top: y,
        transform: `translateY(-50%) scale(${scale.toFixed(3)})`,
        transformOrigin: "left center",
        fontSize: 44,
        color: "rgba(255,255,255,0.78)",
        fontWeight: 500,
        letterSpacing: "-0.018em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        textShadow:
          "0 2px 12px rgba(0,0,0,0.85), 0 0 32px rgba(0,0,0,0.6)",
        willChange: "transform, top",
        pointerEvents: "none",
      }}
    >
      I lost because of
    </div>
  );
};

// ─── Suffix label ─────────────────────────────────────────────────────────────
//
// Anchored to its tier on the iceberg. Three visual states:
//   passed  — already crossed; muted but present (it stays)
//   active  — current tier; full opacity, accent colour
//   pending — not yet reached; dim, smaller
//
// "Insider traders" runs red regardless of state — the punchline is loaded.

const SuffixLabel: React.FC<{
  word: string;
  y: number;
  active: boolean;
  passed: boolean;
  emphasis: boolean;
}> = ({ word, y, active, passed, emphasis }) => {
  const baseSize =
    word.length <= 5 ? 116 : word.length <= 9 ? 96 : word.length <= 14 ? 82 : 72;
  const size = active ? baseSize : baseSize * 0.92;
  const opacity = active ? 1 : passed ? 0.55 : 0.42;
  const color = emphasis ? "#FF3A4F" : "#FFFFFF";
  const shadow = emphasis
    ? "0 0 28px rgba(255,58,79,0.5), 0 2px 12px rgba(0,0,0,0.85)"
    : "0 2px 14px rgba(0,0,0,0.85), 0 0 38px rgba(0,0,0,0.65)";

  return (
    <div
      style={{
        position: "absolute",
        left: LABEL_X,
        top: y,
        transform: `translateY(-50%)`,
        fontSize: size,
        fontWeight: 800,
        color,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        textShadow: shadow,
        opacity,
        transition: "opacity 80ms ease, font-size 80ms ease",
        pointerEvents: "none",
      }}
    >
      {word}
    </div>
  );
};

// ─── Tier counter ─────────────────────────────────────────────────────────────

const TierCounter: React.FC<{ index: number }> = ({ index }) => {
  return (
    <div
      style={{
        position: "absolute",
        right: 56,
        bottom: 48,
        display: "flex",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {SUFFIXES.map((_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? 36 : 16,
            height: 4,
            borderRadius: 2,
            background:
              i === index
                ? colors.accent
                : i < index
                ? "rgba(255,255,255,0.42)"
                : "rgba(255,255,255,0.16)",
            boxShadow:
              i === index ? `0 0 12px ${colors.accent}` : "none",
            transition: "all 90ms ease",
          }}
        />
      ))}
    </div>
  );
};

// ─── Caustic shimmer ──────────────────────────────────────────────────────────

const CausticShimmer: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = (Math.sin(frame / 50) + 1) / 2;
  const d2 = (Math.cos(frame / 72) + 1) / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: IMG_W,
        height: IMG_H,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${20 + d1 * 30}%`,
          top: "38%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(120,210,255,0.5) 0%, rgba(120,210,255,0) 70%)",
          opacity: 0.06 + 0.04 * d1,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${55 + d2 * 18}%`,
          top: "62%",
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(180,230,255,0.5) 0%, rgba(180,230,255,0) 70%)",
          opacity: 0.05 + 0.03 * d2,
        }}
      />
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
