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

// The "I lost because of …" iceberg. Camera descends through six tiers of
// the meme. The prefix is anchored to screen center; the suffix snaps to
// each tier as we cross it. Pink tier guides on the source asset give the
// camera something to magnet onto.

// Asset: public/iceberg-tiers.webp (1265 × 2238 native, chibi column stripped).
// Display at 1100w × 1946h on the left half so width is a clean ~0.87x — no
// upscaling, no softness. Right 820px is the text panel.
const IMG_W = 1100;
const IMG_NATIVE_RATIO = 2238 / 1265; // ~1.769
const IMG_H = Math.round(IMG_W * IMG_NATIVE_RATIO); // 1946
const SCROLL_RANGE = IMG_H - H; // 866

type TierContent = {
  prefix: string;
  lines: string[];           // suffix, optionally split onto two lines
  emphasis?: boolean;        // last tier hits in red
};

const PREFIX = "I lost because of";

const TIERS: TierContent[] = [
  { prefix: PREFIX, lines: ["strategy"] },
  { prefix: PREFIX, lines: ["fees"] },
  { prefix: PREFIX, lines: ["liquidation", "hunters"] },
  { prefix: PREFIX, lines: ["front", "runners"] },
  { prefix: PREFIX, lines: ["orderbook", "spoofers"] },
  { prefix: PREFIX, lines: ["insider", "traders"], emphasis: true },
];

// Timing in frames @ 30fps.
//   INTRO    fade in + first tier settle
//   HOLD     each tier holds before the next snap
//   SNAP     scroll + suffix swap between tiers
//   FINAL    extra hold on tier 6 — the punchline lands
//   OUTRO    fade out
const INTRO = 18;
const HOLD = 50;
const SNAP = 16;
const FINAL = 60;
const OUTRO = 22;

const N = TIERS.length;
const tierStartFrame = (i: number) => INTRO + i * (HOLD + SNAP);
const SCENE_FRAMES =
  tierStartFrame(N - 1) + HOLD + FINAL + OUTRO;
// 18 + 5*(50+16) + 50 + 60 + 22 = 18 + 330 + 132 = 480

const scrollAtTier = (i: number) =>
  -(SCROLL_RANGE / (N - 1)) * i;

// Two-phase ease per snap: accelerate out, decelerate in. Cubic in-out gives
// the "magnetic catch" feel — slow at the tier, fast between.
const snapEase = Easing.bezier(0.55, 0, 0.25, 1);

const computeScroll = (frame: number): number => {
  // Before first tier: snap-zoom in from the same scroll the first tier sits
  // at — gives the entry a hair of motion, not a static reveal.
  if (frame < INTRO) {
    const t = interpolate(frame, [0, INTRO], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    return scrollAtTier(0) - 24 * (1 - t);
  }
  for (let i = 0; i < N - 1; i++) {
    const holdStart = tierStartFrame(i);
    const snapStart = holdStart + HOLD;
    const snapEnd = snapStart + SNAP;
    if (frame < snapStart) return scrollAtTier(i);
    if (frame < snapEnd) {
      const t = (frame - snapStart) / SNAP;
      const eased = snapEase(t);
      return scrollAtTier(i) + (scrollAtTier(i + 1) - scrollAtTier(i)) * eased;
    }
  }
  return scrollAtTier(N - 1);
};

const activeTierAt = (frame: number): { index: number; phase: "hold" | "snap"; t: number } => {
  if (frame < INTRO) return { index: 0, phase: "hold", t: 0 };
  for (let i = 0; i < N - 1; i++) {
    const holdStart = tierStartFrame(i);
    const snapStart = holdStart + HOLD;
    const snapEnd = snapStart + SNAP;
    if (frame < snapStart) return { index: i, phase: "hold", t: 0 };
    if (frame < snapEnd)
      return { index: i, phase: "snap", t: (frame - snapStart) / SNAP };
  }
  return { index: N - 1, phase: "hold", t: 0 };
};

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const scrollY = computeScroll(frame);
  const tier = activeTierAt(frame);

  const introOpacity = interpolate(frame, [0, INTRO * 0.7], [0, 1], {
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

  // Sub-perceptual horizontal sway — the camera isn't on a tripod.
  const sway = Math.sin((frame / 84) * Math.PI * 2) * 4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#04060C",
        fontFamily: font,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Iceberg, scrolling. Anchored left, slight x sway. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: IMG_W,
          height: IMG_H,
          transform: `translate3d(${sway.toFixed(2)}px, ${scrollY.toFixed(2)}px, 0)`,
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
      </div>

      {/* Caustic shimmer on the underwater section — drifts independently of
          the scroll so the ice never feels frozen on long holds. */}
      <CausticShimmer scrollY={scrollY} />

      {/* Soft right-edge falloff into the text panel. Keeps the iceberg from
          competing with type. */}
      <div
        style={{
          position: "absolute",
          left: IMG_W - 200,
          top: 0,
          width: 280,
          height: H,
          background:
            "linear-gradient(90deg, rgba(4,6,12,0) 0%, rgba(4,6,12,0.55) 55%, rgba(4,6,12,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Active-tier indicator: a thin horizontal accent line on the right
          edge of the iceberg, pinned to screen center. Reads as the head of
          the magnet. */}
      <TierMarker tierIndex={tier.index} snapT={tier.phase === "snap" ? tier.t : 0} />

      {/* Text panel — anchored to the screen, never moves vertically.
          Prefix is constant; suffix swaps with a magnet snap each tier. */}
      <TextPanel tier={tier} />

      {/* Tier counter — small mono ticker in the bottom-right. */}
      <TierCounter tierIndex={tier.index} />

      {/* Edge vignette — pulls focus to the centre band on long holds. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 35% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 95%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Text panel ───────────────────────────────────────────────────────────────

const TextPanel: React.FC<{ tier: ReturnType<typeof activeTierAt> }> = ({
  tier,
}) => {
  const current = TIERS[tier.index];
  const next = TIERS[Math.min(tier.index + 1, N - 1)];

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
        paddingLeft: 64,
        paddingRight: 56,
      }}
    >
      {/* Prefix — sticky. Sits a hair above true centre so the suffix sits
          on the centerline. */}
      <div
        style={{
          fontSize: 46,
          color: "rgba(255,255,255,0.62)",
          fontWeight: 500,
          letterSpacing: "-0.018em",
          lineHeight: 1.1,
          marginBottom: 22,
          whiteSpace: "nowrap",
        }}
      >
        {current.prefix}
      </div>

      {/* Suffix — magnet snap. Old word leaves up; new word arrives from
          below with an overshoot landing. */}
      <Suffix tier={tier} current={current} next={next} />
    </div>
  );
};

// ─── Suffix renderer ──────────────────────────────────────────────────────────
//
// The suffix can be one or two lines (e.g. "insider" / "traders"). The two
// lines move as a unit during the snap so the silhouette stays cohesive.

const suffixFontSize = (lines: string[]): number => {
  // Two-line suffixes get a hair more room per line; one-line stays huge.
  if (lines.length === 1) {
    const w = lines[0].length;
    if (w <= 5) return 168;
    if (w <= 9) return 140;
    return 116;
  }
  // Two-line: each line gets its own size based on its own length.
  return 0; // computed per line
};

const lineSize = (line: string): number => {
  if (line.length <= 5) return 144;
  if (line.length <= 8) return 132;
  return 116;
};

const Suffix: React.FC<{
  tier: ReturnType<typeof activeTierAt>;
  current: TierContent;
  next: TierContent;
}> = ({ tier, current, next }) => {
  if (tier.phase === "hold") {
    return <SuffixStack tier={current} y={0} opacity={1} scale={1} />;
  }
  // Snap phase — old leaves up, new arrives from below with overshoot.
  const t = tier.t;
  const oldY = interpolate(t, [0, 1], [0, -64]);
  const oldOpacity = interpolate(t, [0, 0.45], [1, 0], {
    extrapolateRight: "clamp",
  });
  const newY = interpolate(t, [0, 1], [88, 0]);
  const newOpacity = interpolate(t, [0.35, 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Magnet overshoot — slight squash-stretch on arrival so the word "lands"
  // instead of "stops".
  const newScale = interpolate(t, [0.5, 0.82, 1], [0.96, 1.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "relative", height: 320, width: "100%" }}>
      <SuffixStack tier={current} y={oldY} opacity={oldOpacity} scale={1} absolute />
      <SuffixStack tier={next} y={newY} opacity={newOpacity} scale={newScale} absolute />
    </div>
  );
};

const SuffixStack: React.FC<{
  tier: TierContent;
  y: number;
  opacity: number;
  scale: number;
  absolute?: boolean;
}> = ({ tier, y, opacity, scale, absolute }) => {
  const color = tier.emphasis ? "#FF3A4F" : "#FFFFFF";
  const shadow = tier.emphasis
    ? "0 0 24px rgba(255, 58, 79, 0.45)"
    : "0 4px 18px rgba(0, 0, 0, 0.55)";
  const oneLineSize = suffixFontSize(tier.lines);

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
      {tier.lines.map((line, idx) => {
        const size = tier.lines.length === 1 ? oneLineSize : lineSize(line);
        return (
          <div
            key={idx}
            style={{
              fontSize: size,
              fontWeight: 800,
              color,
              letterSpacing: "-0.045em",
              lineHeight: 0.94,
              textShadow: shadow,
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

// ─── Tier marker ──────────────────────────────────────────────────────────────
//
// A small accent line on the right edge of the iceberg image, pinned to the
// screen center. Reads as "the magnet": it's where the current tier label
// snaps to. Drops a tick during the snap to sell the catch.

const TierMarker: React.FC<{ tierIndex: number; snapT: number }> = ({
  tierIndex,
  snapT,
}) => {
  // Pulse during snap.
  const pulse = snapT > 0 ? Math.sin(snapT * Math.PI) : 0;
  const width = 56 + pulse * 36;
  const tickOpacity = 0.55 + pulse * 0.35;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: IMG_W - 28,
          top: H / 2 - 1,
          width,
          height: 2,
          background: colors.accent,
          boxShadow: `0 0 ${10 + pulse * 18}px ${colors.accent}`,
          opacity: tickOpacity,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: IMG_W - 30,
          top: H / 2 - 4,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: colors.accent,
          boxShadow: `0 0 16px ${colors.accent}`,
          opacity: 0.9,
          pointerEvents: "none",
        }}
      />
      {/* Tiny tier count on the marker — 1 of 6, etc. */}
      <div
        style={{
          position: "absolute",
          left: IMG_W + 36,
          top: H / 2 - 32,
          fontFamily: font,
          fontSize: 18,
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.42)",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        Tier {tierIndex + 1} / {N}
      </div>
    </>
  );
};

// ─── Tier counter ─────────────────────────────────────────────────────────────

const TierCounter: React.FC<{ tierIndex: number }> = ({ tierIndex }) => {
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
      {TIERS.map((_, i) => (
        <div
          key={i}
          style={{
            width: i === tierIndex ? 36 : 16,
            height: 4,
            borderRadius: 2,
            background:
              i === tierIndex
                ? colors.accent
                : i < tierIndex
                ? "rgba(255,255,255,0.42)"
                : "rgba(255,255,255,0.16)",
            boxShadow:
              i === tierIndex ? `0 0 12px ${colors.accent}` : "none",
            transition: "all 120ms ease",
          }}
        />
      ))}
    </div>
  );
};

// ─── Caustic shimmer ──────────────────────────────────────────────────────────
//
// Two soft, slowly-drifting radial highlights on the underwater section.
// Keeps the ice "alive" during the long holds on each tier.

const CausticShimmer: React.FC<{ scrollY: number }> = ({ scrollY }) => {
  const frame = useCurrentFrame();
  const drift1 = (Math.sin(frame / 60) + 1) / 2;
  const drift2 = (Math.cos(frame / 84) + 1) / 2;
  const opacity1 = 0.06 + 0.04 * drift1;
  const opacity2 = 0.05 + 0.03 * drift2;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: IMG_W,
        height: IMG_H,
        transform: `translateY(${scrollY.toFixed(2)}px)`,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${20 + drift1 * 30}%`,
          top: "38%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(120,210,255,0.5) 0%, rgba(120,210,255,0) 70%)",
          opacity: opacity1,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${55 + drift2 * 18}%`,
          top: "58%",
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(180,230,255,0.5) 0%, rgba(180,230,255,0) 70%)",
          opacity: opacity2,
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
