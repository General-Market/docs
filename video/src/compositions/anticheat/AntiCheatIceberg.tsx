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

// The "I lost because of …" iceberg, Apple-styled.
//
// Layout: iceberg on the left, type panel on the right. The prefix is fixed
// to the right panel's centre. The active suffix sits below it. On each
// snap, the active suffix slides down toward the iceberg and settles onto
// its tier — staying there. The next suffix climbs into the prefix's slot
// with a soft magnet catch. Tiers never write in advance — a word doesn't
// exist on the iceberg until we've crossed it.

// Re-cropped asset: 1265 × 1670 (bottom two pink guides + dark void removed).
// Native pink lines at y = 269, 539, 857, 1141, 1430 in cropped coordinates.
// Six section centres → six tier anchor points.
const IMG_W = 1100;
const IMG_NATIVE_H = 1670;
const IMG_NATIVE_W = 1265;
const IMG_SCALE = IMG_W / IMG_NATIVE_W;                       // ~0.8696
const IMG_H = Math.round(IMG_NATIVE_H * IMG_SCALE);           // 1452
const IMG_LEFT = 0;
const SCROLL_RANGE = IMG_H - H;                               // 372

// Tier centres in displayed coordinates — geometric midpoint of each band
// between adjacent pink lines, scaled to the displayed image.
const TIER_Y = [
  Math.round(((0 + 269) / 2) * IMG_SCALE),       // 117 — sky / above tip
  Math.round(((269 + 539) / 2) * IMG_SCALE),     // 351 — tip + waterline
  Math.round(((539 + 857) / 2) * IMG_SCALE),     // 607 — upper underwater
  Math.round(((857 + 1141) / 2) * IMG_SCALE),    // 869 — mid underwater
  Math.round(((1141 + 1430) / 2) * IMG_SCALE),   // 1118 — lower iceberg
  Math.round(((1430 + 1670) / 2) * IMG_SCALE),   // 1348 — depths
];

// Where settled (past) labels rest on the iceberg — right-aligned to a fixed
// inset from the image's right edge, so type sits in the same column at every
// tier and doesn't fight the varying silhouette.
const SETTLED_RIGHT_INSET = 56;

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

// Apple type stack.
const SF_DISPLAY = `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif`;
const SF_TEXT = `"SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif`;

// Apple easing curves — these are the production values from apple.com CSS.
const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

// Pacing — much faster than the first cut. 220 frames ≈ 7.3 s.
const INTRO = 8;
const HOLD = 18;
const SNAP = 12;
const FINAL = 32;     // extra hold on the punchline
const OUTRO = 12;

const tierStart = (i: number) => INTRO + i * (HOLD + SNAP);
const SCENE_FRAMES = tierStart(LAST) + HOLD + FINAL + OUTRO;
// 8 + 5*(18+12) + 18 + 32 + 12 = 8 + 150 + 62 = 220

const scrollAtTier = (i: number) => -(SCROLL_RANGE / LAST) * i;

type Phase = "hold" | "snap";
type TierState = { index: number; phase: Phase; t: number };

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
  return a + (b - a) * EASE_OUT(state.t);
};

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = tierAt(frame);
  const scrollY = computeScroll(state);

  const introOpacity = interpolate(frame, [0, INTRO], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const outroOpacity = interpolate(
    frame,
    [SCENE_FRAMES - OUTRO, SCENE_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT },
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
      {/* Iceberg + past tier labels — one wrapper, one translate. */}
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
          style={{ width: IMG_W, height: IMG_H, display: "block" }}
        />

        {/* Past tiers settle here. Never rendered before they've been
            reached — the iceberg starts unlabelled below the surface. */}
        {SUFFIXES.map((word, i) => (
          <SettledLabel
            key={i}
            word={word}
            tierY={TIER_Y[i]}
            state={state}
            tierIndex={i}
          />
        ))}
      </div>

      {/* Soft right-edge falloff into the type panel. */}
      <div
        style={{
          position: "absolute",
          left: IMG_W - 220,
          top: 0,
          width: 280,
          height: H,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Right-side type panel — prefix is fixed, active suffix swaps. */}
      <TypePanel state={state} />

      {/* Subtle bottom-edge vignette so deep tiers don't sit on a hard line. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Settled labels ───────────────────────────────────────────────────────────
//
// A label exists on the iceberg only once its tier has been visited. While
// the tier is being snapped INTO, the label fades in at its anchor — the
// "depositing" moment after the active card slides off the type panel.

const SettledLabel: React.FC<{
  word: string;
  tierY: number;
  state: TierState;
  tierIndex: number;
}> = ({ word, tierY, state, tierIndex }) => {
  // Render decision:
  //   tierIndex < state.index            → fully settled
  //   tierIndex === state.index, snap    → still settling (fade in)
  //   otherwise                          → does not exist yet
  if (tierIndex > state.index) return null;
  if (tierIndex === state.index && state.phase === "hold") return null;

  let appear = 1;
  if (tierIndex === state.index && state.phase === "snap") {
    appear = interpolate(state.t, [0.5, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    });
  }

  // Apple-style settle: a small upward arrival + opacity climb.
  const rise = (1 - appear) * 14;

  return (
    <div
      style={{
        position: "absolute",
        right: SETTLED_RIGHT_INSET,
        top: tierY,
        transform: `translateY(calc(-50% + ${rise.toFixed(2)}px))`,
        opacity: appear,
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: SF_DISPLAY,
          fontSize: 34,
          fontWeight: 500,
          color: "rgba(245, 245, 247, 0.95)",
          letterSpacing: "-0.022em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          padding: "10px 22px",
          borderRadius: 980,
          background: "rgba(12, 18, 30, 0.62)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        {word}
      </div>
    </div>
  );
};

// ─── Type panel ───────────────────────────────────────────────────────────────
//
// Fixed to the right side of the frame. Prefix is permanent; suffix swaps
// with each snap.

const TypePanel: React.FC<{ state: TierState }> = ({ state }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: IMG_W,
        top: 0,
        width: W - IMG_W,
        height: H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: 80,
        paddingRight: 56,
      }}
    >
      <div
        style={{
          fontFamily: SF_TEXT,
          fontSize: 24,
          fontWeight: 400,
          color: "rgba(245, 245, 247, 0.55)",
          letterSpacing: "-0.016em",
          lineHeight: 1.2,
          marginBottom: 28,
          whiteSpace: "nowrap",
        }}
      >
        I lost because of
      </div>

      <ActiveSuffix state={state} />
    </div>
  );
};

// ─── Active suffix ────────────────────────────────────────────────────────────
//
// Hold: a single suffix sits in place.
// Snap: outgoing slides down out of the panel (heading for the iceberg).
//       Incoming climbs up from below with a small magnet overshoot.

const ActiveSuffix: React.FC<{ state: TierState }> = ({ state }) => {
  const current = SUFFIXES[state.index];
  const next = state.index < LAST ? SUFFIXES[state.index + 1] : null;

  if (state.phase === "hold") {
    return (
      <div style={{ position: "relative", height: 230, width: "100%" }}>
        <SuffixWord word={current} y={0} opacity={1} scale={1} absolute />
      </div>
    );
  }

  const t = state.t;
  // Outgoing — slides DOWN (toward the iceberg below the panel), fades.
  const outY = interpolate(t, [0, 1], [0, 72], { easing: EASE_DEFAULT });
  const outOpacity = interpolate(t, [0, 0.55], [1, 0], {
    extrapolateRight: "clamp",
  });
  // Incoming — climbs up, slight overshoot for the magnet catch.
  const inY = interpolate(t, [0, 1], [92, 0], { easing: EASE_OUT });
  const inOpacity = interpolate(t, [0.4, 0.85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const inScale = interpolate(t, [0.55, 0.88, 1], [0.97, 1.035, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_DEFAULT,
  });

  return (
    <div style={{ position: "relative", height: 230, width: "100%" }}>
      <SuffixWord word={current} y={outY} opacity={outOpacity} scale={1} absolute />
      {next && (
        <SuffixWord word={next} y={inY} opacity={inOpacity} scale={inScale} absolute />
      )}
    </div>
  );
};

// ─── Suffix word ──────────────────────────────────────────────────────────────
//
// Two-word phrases split onto two lines, San-Francisco display-style. One-
// word phrases stay big and single-line. Apple weight 600 (semibold) — not
// the extra-bold the meme convention reaches for.

const SuffixWord: React.FC<{
  word: string;
  y: number;
  opacity: number;
  scale: number;
  absolute?: boolean;
}> = ({ word, y, opacity, scale, absolute }) => {
  const parts = word.split(" ");
  const twoLines = parts.length === 2;

  const oneLineSize = (() => {
    if (word.length <= 5) return 156;
    if (word.length <= 9) return 128;
    return 100;
  })();
  const lineSize = (line: string) => {
    if (line.length <= 5) return 124;
    if (line.length <= 8) return 116;
    return 100;
  };

  return (
    <div
      style={{
        position: absolute ? "absolute" : "relative",
        top: 0,
        left: 0,
        transform: `translateY(${y.toFixed(2)}px) scale(${scale.toFixed(3)})`,
        transformOrigin: "left center",
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {twoLines ? (
        parts.map((line, idx) => (
          <div
            key={idx}
            style={{
              fontFamily: SF_DISPLAY,
              fontSize: lineSize(line),
              fontWeight: 600,
              color: "#F5F5F7",
              letterSpacing: "-0.028em",
              lineHeight: 0.94,
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        ))
      ) : (
        <div
          style={{
            fontFamily: SF_DISPLAY,
            fontSize: oneLineSize,
            fontWeight: 600,
            color: "#F5F5F7",
            letterSpacing: "-0.028em",
            lineHeight: 0.94,
            whiteSpace: "nowrap",
          }}
        >
          {word}
        </div>
      )}
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
