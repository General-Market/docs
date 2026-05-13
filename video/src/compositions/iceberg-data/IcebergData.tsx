import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { colors } from "../anticheat/theme";

// IcebergData — cartoon iceberg, AntiCheatFull's *non-iceberg* visual
// language (Base-style cards on a light field) and AntiCheatIceberg's
// beat-locked rhythm.

const W = 1920;
const H = 1080;
const FPS = 30;

// ── Iceberg image (cartoon) ────────────────────────────────────────────────
const IMG_NATIVE_W = 1280;
const IMG_NATIVE_H = 720;
const IMG_AR = IMG_NATIVE_W / IMG_NATIVE_H; // 16:9
const IMG_WATERLINE_NORM = 305 / IMG_NATIVE_H; // ~0.424

// ── Beat rhythm — verbatim from AntiCheatIceberg ───────────────────────────
const TIERS_COUNT = 6;
const LAST = TIERS_COUNT - 1;
const TIER_STAMP_LOCAL = [36, 61, 87, 113, 139, 164] as const;
const STAMP_OFFSET = 5;
const TIER_ANIM = 6;
const FINAL_HOLD = 41;
const OUTRO = 14;
const ZOOM_OUT = TIER_STAMP_LOCAL[0] - STAMP_OFFSET; // 31

const tierAnimStart = (i: number) => TIER_STAMP_LOCAL[i] - STAMP_OFFSET;
const tierHoldEnd = (i: number) =>
  i === LAST
    ? tierAnimStart(i) + TIER_ANIM + FINAL_HOLD
    : tierAnimStart(i + 1);

const SCENE_FRAMES = tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO; // 220

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Camera phases ──────────────────────────────────────────────────────────
//   Phase 1 (0–31)         zoom out from 1.9× → 1.4×, fy=0.30   (tip)
//   Phase 2 (31–87)        hold tip                  (Strategies, Fees land)
//   Phase 3 (87–113)       pull out → full           (Liq hunters lands)
//   Phase 4 (113–164)      push down → lower mass    (the rest land)
//   Phase 5 (164–220)      hold lower + climax + outro
type Cam = { fy: number; scale: number };
const CAM_TIP_TIGHT: Cam = { fy: 0.30, scale: 1.9 };
const CAM_TIP: Cam = { fy: 0.30, scale: 1.4 };
const CAM_FULL: Cam = { fy: 0.5, scale: 1.04 };
const CAM_LOWER: Cam = { fy: 0.74, scale: 1.5 };

const PHASE_2_END = 87;
const PHASE_3_END = 113;
const PHASE_4_END = 164;

const resolveCam = (frame: number): Cam => {
  if (frame < ZOOM_OUT) {
    const t = easeInOut(frame / ZOOM_OUT);
    return {
      fy: CAM_TIP_TIGHT.fy,
      scale: lerp(CAM_TIP_TIGHT.scale, CAM_TIP.scale, t),
    };
  }
  if (frame < PHASE_2_END) return CAM_TIP;
  if (frame < PHASE_3_END) {
    const t = easeInOut((frame - PHASE_2_END) / (PHASE_3_END - PHASE_2_END));
    return { fy: lerp(CAM_TIP.fy, CAM_FULL.fy, t), scale: lerp(CAM_TIP.scale, CAM_FULL.scale, t) };
  }
  if (frame < PHASE_4_END) {
    const t = easeInOut((frame - PHASE_3_END) / (PHASE_4_END - PHASE_3_END));
    return { fy: lerp(CAM_FULL.fy, CAM_LOWER.fy, t), scale: lerp(CAM_FULL.scale, CAM_LOWER.scale, t) };
  }
  return CAM_LOWER;
};

type Geom = {
  imgLeft: number;
  imgTop: number;
  imgW: number;
  imgH: number;
  scale: number;
};

const resolveGeom = (frame: number): Geom => {
  const cam = resolveCam(frame);
  const swayX = Math.sin(frame * 0.05) * 3.5 + Math.sin(frame * 0.02) * 1.2;
  const swayY = Math.sin(frame * 0.038 + 1.1) * 2;
  const imgH = H * cam.scale;
  const imgW = imgH * IMG_AR;
  let imgLeft = W / 2 - 0.5 * imgW + swayX;
  let imgTop = H / 2 - cam.fy * imgH + swayY;
  imgLeft = Math.min(0, Math.max(W - imgW, imgLeft));
  imgTop = Math.min(0, Math.max(H - imgH, imgTop));
  return { imgLeft, imgTop, imgW, imgH, scale: cam.scale };
};

// ── Tier content + anchors (image-space, normalised) ───────────────────────
type Tier = {
  label: string;
  pctX: number;
  pctY: number;
  emphasis?: boolean;
};

const TIERS: ReadonlyArray<Tier> = [
  { label: "Strategies", pctX: 0.16, pctY: 0.15 },
  { label: "Fees", pctX: 0.84, pctY: 0.15 },
  { label: "Liquidation hunters", pctX: 0.14, pctY: 0.56 },
  { label: "Front runners", pctX: 0.86, pctY: 0.56 },
  { label: "Orderbook spoofers", pctX: 0.14, pctY: 0.86 },
  { label: "Insider traders", pctX: 0.86, pctY: 0.86, emphasis: true },
];

// ── Per-tier card — Base-style ─────────────────────────────────────────────
// Pinned to image space (rides the camera). Constant screen-pixel size.
const CARD_WIDTH = 380;
const CARD_HEIGHT = 124;

const TierCard: React.FC<{
  tier: Tier;
  index: number;
  geom: Geom;
  frame: number;
  fps: number;
}> = ({ tier, index, geom, frame, fps }) => {
  const animStart = tierAnimStart(index);

  // Image-space anchor → screen pixel (map-pin model).
  const cx = geom.imgLeft + tier.pctX * geom.imgW;
  const cy = geom.imgTop + tier.pctY * geom.imgH;
  const left = cx - CARD_WIDTH / 2;
  const top = cy - CARD_HEIGHT / 2;

  const enter = spring({
    frame: frame - animStart,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.85 },
  });

  const isRed = !!tier.emphasis;
  const breath =
    frame >= animStart + TIER_ANIM
      ? 1 + Math.sin(frame * 0.16) * (isRed ? 0.018 : 0.006)
      : 1;

  const borderColor = isRed ? "rgba(255,86,110,0.95)" : colors.rule;
  const accent = isRed ? "#FF566E" : colors.accent;
  const textColor = isRed ? "#B2243A" : colors.fg;

  // Hairline accent stripe on the left edge — Coinbase-style row marker.
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 18}px) scale(${breath.toFixed(4)})`,
        background: colors.surface,
        borderRadius: 22,
        border: `1px solid ${borderColor}`,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 56px rgba(8,16,28,0.28), 0 2px 8px rgba(8,16,28,0.10)",
        display: "flex",
        alignItems: "center",
        padding: "0 26px",
        fontFamily: font,
        willChange: "transform, opacity",
      }}
    >
      {/* Left accent stripe */}
      <div
        style={{
          position: "absolute",
          left: 10,
          top: 14,
          bottom: 14,
          width: 4,
          borderRadius: 3,
          background: accent,
        }}
      />
      <div style={{ marginLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: isRed ? "rgba(255,86,110,0.85)" : colors.dim,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {String(index + 1).padStart(2, "0")} {index < 2 ? "· Above" : "· Below"}
        </div>
        <div
          style={{
            fontSize: tier.label.length > 16 ? 28 : 34,
            fontWeight: 800,
            color: textColor,
            letterSpacing: "-0.018em",
            lineHeight: 1.05,
          }}
        >
          {tier.label}
        </div>
      </div>
    </div>
  );
};

// ── Headline (screen-fixed) ────────────────────────────────────────────────
const Headline: React.FC<{ frame: number }> = ({ frame }) => {
  const swapFrame = tierAnimStart(2); // when tier 2 (liq hunters) lands
  const firstO = interpolate(frame, [swapFrame - 6, swapFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const secondO = interpolate(frame, [swapFrame, swapFrame + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pill = (text: string, tone: "blue" | "red") => (
    <div
      style={{
        display: "inline-block",
        padding: "12px 28px",
        borderRadius: 999,
        background: colors.surface,
        color: tone === "red" ? "#B2243A" : colors.accent,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 28px rgba(8,16,28,0.22), 0 2px 6px rgba(8,16,28,0.10)",
        border: `1px solid ${tone === "red" ? "rgba(255,86,110,0.35)" : colors.rule}`,
      }}
    >
      {text}
    </div>
  );

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 60,
          textAlign: "center",
          fontFamily: font,
          opacity: firstO,
          pointerEvents: "none",
        }}
      >
        {pill("Why traders think they lost", "blue")}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 60,
          textAlign: "center",
          fontFamily: font,
          opacity: secondO,
          pointerEvents: "none",
        }}
      >
        {pill("Why traders really lost", "red")}
      </div>
    </>
  );
};

// ── Outer composition ─────────────────────────────────────────────────────
export const IcebergData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const geom = resolveGeom(frame);

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
        background: colors.bg,
        opacity: sceneOpacity,
        fontFamily: font,
      }}
    >
      {/* Iceberg image — camera scrolls/zooms */}
      <div
        style={{
          position: "absolute",
          left: geom.imgLeft,
          top: geom.imgTop,
          width: geom.imgW,
          height: geom.imgH,
          willChange: "left, top, width, height",
        }}
      >
        <Img
          src={staticFile("iceberg-data.webp")}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Soft top/bottom fade to colors.bg so the cartoon's hard edges blend */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${colors.bg} 0%, rgba(240,242,244,0) 12%, rgba(240,242,244,0) 88%, ${colors.bg} 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* 6 cards — pinned to image-space anchors, screen-pixel sized */}
      {TIERS.map((tier, i) => (
        <TierCard
          key={tier.label}
          tier={tier}
          index={i}
          geom={geom}
          frame={frame}
          fps={fps}
        />
      ))}

      <Headline frame={frame} />
    </AbsoluteFill>
  );
};

export const icebergDataMeta = {
  id: "IcebergData",
  component: IcebergData,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
