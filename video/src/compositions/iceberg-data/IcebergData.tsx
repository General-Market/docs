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
import { DotGrid } from "../anticheat/DotGrid";

// IcebergData — cartoon iceberg on top of the AntiCheat DotGrid backdrop.
// Card aesthetic, camera plan, and beat rhythm all borrowed from the rest
// of AntiCheatFull.

const W = 1920;
const H = 1080;
const FPS = 30;

const IMG_NATIVE_W = 1280;
const IMG_NATIVE_H = 720;
const IMG_AR = IMG_NATIVE_W / IMG_NATIVE_H;

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
const SCENE_FRAMES = tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO; // 220

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Camera ─────────────────────────────────────────────────────────────────
type Cam = { fy: number; scale: number };
const CAM_INTRO_START: Cam = { fy: 0.42, scale: 1.18 };
const CAM_FULL: Cam = { fy: 0.50, scale: 1.05 };
const CAM_LOWER: Cam = { fy: 0.68, scale: 1.24 };

const PHASE_2_END = 113;
const PHASE_3_END = 164;

const resolveCam = (frame: number): Cam => {
  if (frame < ZOOM_OUT) {
    const t = easeInOut(frame / ZOOM_OUT);
    return {
      fy: lerp(CAM_INTRO_START.fy, CAM_FULL.fy, t),
      scale: lerp(CAM_INTRO_START.scale, CAM_FULL.scale, t),
    };
  }
  if (frame < PHASE_2_END) return CAM_FULL;
  if (frame < PHASE_3_END) {
    const t = easeInOut((frame - PHASE_2_END) / (PHASE_3_END - PHASE_2_END));
    return {
      fy: lerp(CAM_FULL.fy, CAM_LOWER.fy, t),
      scale: lerp(CAM_FULL.scale, CAM_LOWER.scale, t),
    };
  }
  return CAM_LOWER;
};

type Geom = {
  imgLeft: number;
  imgTop: number;
  imgW: number;
  imgH: number;
};

const resolveGeom = (frame: number): Geom => {
  const cam = resolveCam(frame);
  const swayX = Math.sin(frame * 0.05) * 2.5;
  const swayY = Math.sin(frame * 0.038 + 1.1) * 1.5;
  const imgH = H * cam.scale;
  const imgW = imgH * IMG_AR;
  let imgLeft = W / 2 - 0.5 * imgW + swayX;
  let imgTop = H / 2 - cam.fy * imgH + swayY;
  imgLeft = Math.min(0, Math.max(W - imgW, imgLeft));
  imgTop = Math.min(0, Math.max(H - imgH, imgTop));
  return { imgLeft, imgTop, imgW, imgH };
};

// ── Iceberg image — sits on top of the dot grid, mix-blends with it so the
// dots breathe through the blue ocean and sky.
const IcebergImage: React.FC<{ geom: Geom }> = ({ geom }) => (
  <div
    style={{
      position: "absolute",
      left: geom.imgLeft,
      top: geom.imgTop,
      width: geom.imgW,
      height: geom.imgH,
      mixBlendMode: "multiply",
    }}
  >
    <Img
      src={staticFile("iceberg-data.webp")}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        filter: "saturate(0.85) contrast(1.05)",
      }}
    />
  </div>
);

// ── Dot stipple on top of the iceberg ──────────────────────────────────────
// A uniform Base-blue dot pattern, image-anchored, masked by the iceberg's
// own luminance — dots only land on the bright parts (the iceberg body and
// the sky). The watercolour breathes through where the mask is dark.
const DOT_SPACING = 14;
const DOT_RADIUS = 2.6;

const IcebergStipple: React.FC<{ geom: Geom }> = ({ geom }) => {
  const maskUrl = `url(${staticFile("iceberg-data.webp")})`;
  const maskStyle: React.CSSProperties = {
    position: "absolute",
    left: geom.imgLeft,
    top: geom.imgTop,
    width: geom.imgW,
    height: geom.imgH,
    pointerEvents: "none",
    maskImage: maskUrl,
    maskMode: "luminance",
    maskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskImage: maskUrl,
    WebkitMaskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
  };
  // mask-mode prefix isn't in React's CSS types — set via plain object below.
  (maskStyle as Record<string, string>)["WebkitMaskMode"] = "luminance";
  return (
    <div style={maskStyle}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${IMG_NATIVE_W} ${IMG_NATIVE_H}`}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="iceberg-dots"
            width={DOT_SPACING}
            height={DOT_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={DOT_SPACING / 2}
              cy={DOT_SPACING / 2}
              r={DOT_RADIUS}
              fill={colors.accent}
              opacity={0.72}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#iceberg-dots)" />
      </svg>
    </div>
  );
};

// ── Tiers + anchors ────────────────────────────────────────────────────────
type Tier = {
  label: string;
  pctX: number;
  pctY: number;
  emphasis?: boolean;
};

const TIERS: ReadonlyArray<Tier> = [
  { label: "Strategies", pctX: 0.22, pctY: 0.18 },
  { label: "Fees", pctX: 0.78, pctY: 0.18 },
  { label: "Liquidation hunters", pctX: 0.20, pctY: 0.58 },
  { label: "Front runners", pctX: 0.80, pctY: 0.58 },
  { label: "Orderbook spoofers", pctX: 0.20, pctY: 0.85 },
  { label: "Insider traders", pctX: 0.80, pctY: 0.85, emphasis: true },
];

const CARD_WIDTH = 360;
const CARD_HEIGHT = 116;

const TierCard: React.FC<{
  tier: Tier;
  index: number;
  geom: Geom;
  frame: number;
  fps: number;
}> = ({ tier, index, geom, frame, fps }) => {
  const animStart = tierAnimStart(index);
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
      ? 1 + Math.sin(frame * 0.16) * (isRed ? 0.016 : 0.005)
      : 1;

  const accent = isRed ? "#FF566E" : colors.accent;
  const textColor = isRed ? "#B2243A" : colors.fg;
  const borderColor = isRed ? "rgba(255,86,110,0.55)" : colors.rule;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px) scale(${breath.toFixed(4)})`,
        background: colors.surface,
        borderRadius: 20,
        border: `1px solid ${borderColor}`,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 22px 50px rgba(8,16,28,0.32), 0 2px 8px rgba(8,16,28,0.12)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        fontFamily: font,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 10,
          top: 12,
          bottom: 12,
          width: 4,
          borderRadius: 3,
          background: accent,
        }}
      />
      <div style={{ marginLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: isRed ? "rgba(255,86,110,0.85)" : colors.dim,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {String(index + 1).padStart(2, "0")} {index < 2 ? "· Above" : "· Below"}
        </div>
        <div
          style={{
            fontSize: tier.label.length > 16 ? 26 : 32,
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

const Headline: React.FC<{ frame: number }> = ({ frame }) => {
  const swapFrame = tierAnimStart(2);
  const firstO = interpolate(frame, [swapFrame - 6, swapFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const secondO = interpolate(frame, [swapFrame, swapFrame + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pill = (text: string, red: boolean) => (
    <div
      style={{
        display: "inline-block",
        padding: "12px 28px",
        borderRadius: 999,
        background: colors.surface,
        color: red ? "#B2243A" : colors.accent,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        border: `1px solid ${red ? "rgba(255,86,110,0.35)" : colors.rule}`,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 28px rgba(8,16,28,0.22), 0 2px 6px rgba(8,16,28,0.10)",
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
          top: 56,
          textAlign: "center",
          opacity: firstO,
          fontFamily: font,
          pointerEvents: "none",
        }}
      >
        {pill("Why traders think they lost", false)}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 56,
          textAlign: "center",
          opacity: secondO,
          fontFamily: font,
          pointerEvents: "none",
        }}
      >
        {pill("Why traders really lost", true)}
      </div>
    </>
  );
};

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
      {/* AntiCheat DotGrid backdrop — Base-blue dots on light field. */}
      <DotGrid intensity={1} speed={0.6} />

      {/* The cartoon iceberg. Mix-blend-multiply lets the dot grid show
          through, so the iceberg feels native to the pattern instead of
          pasted on top. */}
      <IcebergImage geom={geom} />

      {/* Dot stipple on the iceberg — luminance-masked by the image itself,
          so the dot field clings to the bright parts. */}
      <IcebergStipple geom={geom} />

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
