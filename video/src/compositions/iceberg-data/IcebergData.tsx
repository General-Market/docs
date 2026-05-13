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

// IcebergData — matches the Vercel reference's camera arc and cluster
// swap. Three zoom states: TIP (close on the above-water tip), FULL (whole
// iceberg, pulled back), DEEP (zoomed into the underwater section). Two
// pill clusters, A exits before B enters.

const W = 1920;
const H = 1080;
const FPS = 30;

// Iceberg viewport — left-anchored, portrait window. The cartoon asset is
// landscape (1280×720); we render it with object-fit:cover so the centred
// iceberg + sky + waterline fits the portrait window cleanly.
const VP_W = 820;
const VP_H = H;
const VP_X = 40;
const VP_Y = 0;

// ── Beat sheet ────────────────────────────────────────────────────────────
const F_HEADER_A = 10;
const F_STRATEGIES = 32;
const F_FEES = 56;
const F_A_EXIT = 82;
const F_A_GONE = 102;

const F_CAM_PULL = 78;
const F_CAM_AT_FULL = 108;
const F_CAM_DIVE = 116;
const F_CAM_AT_DEEP = 146;

const F_HEADER_B = 104;
const F_LIQ = 128;
const F_FRONT = 148;
const F_ORDER = 168;
const F_INSIDER = 188;

const OUTRO = 14;
const SCENE_FRAMES = 220;
const F_OUTRO_START = SCENE_FRAMES - OUTRO;

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Camera ────────────────────────────────────────────────────────────────
// focusY is the fractional y of the source image kept at viewport centre.
type Cam = { scale: number; focusY: number };
// focusY = fraction of viewport the zoom anchors on. TIP zooms in on the
// tip + sky; FULL pulls back below 1.0 so the iceberg shrinks against the
// backdrop; DEEP zooms into the underwater section.
const CAM_TIP: Cam  = { scale: 2.2, focusY: 0.30 };
const CAM_FULL: Cam = { scale: 0.90, focusY: 0.50 };
const CAM_DEEP: Cam = { scale: 1.85, focusY: 0.74 };

const resolveCam = (frame: number): Cam => {
  if (frame < F_CAM_PULL) return CAM_TIP;
  if (frame < F_CAM_AT_FULL) {
    const t = easeInOut((frame - F_CAM_PULL) / (F_CAM_AT_FULL - F_CAM_PULL));
    return {
      scale: lerp(CAM_TIP.scale, CAM_FULL.scale, t),
      focusY: lerp(CAM_TIP.focusY, CAM_FULL.focusY, t),
    };
  }
  if (frame < F_CAM_DIVE) return CAM_FULL;
  if (frame < F_CAM_AT_DEEP) {
    const t = easeInOut((frame - F_CAM_DIVE) / (F_CAM_AT_DEEP - F_CAM_DIVE));
    return {
      scale: lerp(CAM_FULL.scale, CAM_DEEP.scale, t),
      focusY: lerp(CAM_FULL.focusY, CAM_DEEP.focusY, t),
    };
  }
  return CAM_DEEP;
};

// ── Iceberg image — cartoon, sized + positioned manually so the camera
// scale and pan apply predictably. Object-fit:cover does not compose
// cleanly with transform: scale on the same element.
const SRC_W = 1280;
const SRC_H = 720;
const COVER_SCALE = Math.max(VP_W / SRC_W, VP_H / SRC_H); // 1.5
const COVER_W = SRC_W * COVER_SCALE; // 1920
const COVER_H = SRC_H * COVER_SCALE; // 1080
const COVER_LEFT = (VP_W - COVER_W) / 2;
const COVER_TOP = (VP_H - COVER_H) / 2;

const IcebergViewport: React.FC<{ cam: Cam }> = ({ cam }) => {
  // Anchor the camera zoom on the iceberg's horizontal centre. focusY
  // sweeps from the tip (0.28) to deep underwater (0.72) over the scene.
  const originX = VP_W / 2 - COVER_LEFT;
  const originY = cam.focusY * VP_H - COVER_TOP;
  return (
    <div
      style={{
        position: "absolute",
        left: VP_X,
        top: VP_Y,
        width: VP_W,
        height: VP_H,
        overflow: "hidden",
        filter: "drop-shadow(0 24px 60px rgba(0, 18, 48, 0.4))",
      }}
    >
      <Img
        src={staticFile("iceberg-data.webp")}
        style={{
          position: "absolute",
          left: COVER_LEFT,
          top: COVER_TOP,
          width: COVER_W,
          height: COVER_H,
          transformOrigin: `${originX}px ${originY}px`,
          transform: `scale(${cam.scale})`,
          willChange: "transform",
        }}
      />
    </div>
  );
};

// ── Sky → waterline → ocean backdrop — matches cartoon's flat palette ────
const Backdrop: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `linear-gradient(
        to bottom,
        #8FD0EE 0%,
        #8FD0EE 40%,
        #5BB3DE 40.5%,
        #3D9FD8 49%,
        #2B86C2 60%,
        #1F6FA8 78%,
        #16578A 100%
      )`,
    }}
  />
);

// ── Pill styling ──────────────────────────────────────────────────────────
type PillKind = "header" | "leaf" | "leafRed";
const pillStyle = (kind: PillKind): React.CSSProperties => {
  const isHeader = kind === "header";
  const isRed = kind === "leafRed";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    padding: isHeader ? "14px 26px" : "11px 22px",
    borderRadius: 999,
    background: isRed
      ? "rgba(120, 24, 40, 0.46)"
      : isHeader
        ? "rgba(18, 34, 58, 0.46)"
        : "rgba(24, 44, 72, 0.40)",
    backdropFilter: "saturate(180%) blur(22px)",
    WebkitBackdropFilter: "saturate(180%) blur(22px)",
    border: isRed
      ? "1px solid rgba(255, 120, 140, 0.46)"
      : "1px solid rgba(255, 255, 255, 0.22)",
    boxShadow: [
      "0 1px 0 rgba(255, 255, 255, 0.22) inset",
      isHeader
        ? "0 24px 60px rgba(0, 18, 48, 0.40)"
        : "0 14px 32px rgba(0, 18, 48, 0.32)",
      "0 2px 8px rgba(0, 12, 36, 0.24)",
    ].join(", "),
    color: isRed ? "#FFD6DD" : "#FFFFFF",
    fontFamily: font,
    fontWeight: isHeader ? 700 : 600,
    fontSize: isHeader ? 24 : 22,
    letterSpacing: isHeader ? "-0.015em" : "-0.012em",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
};

// ── Entry / exit motion ───────────────────────────────────────────────────
type Motion = { opacity: number; translateY: number; scale: number };

const computeMotion = (
  frame: number,
  fps: number,
  entryFrame: number,
  exitFrame: number | null,
): Motion => {
  const enter = spring({
    frame: frame - entryFrame,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.85 },
  });
  let exit = 0;
  if (exitFrame !== null && frame >= exitFrame) {
    exit = spring({
      frame: frame - exitFrame,
      fps,
      config: { damping: 22, stiffness: 200, mass: 0.7 },
    });
  }
  return {
    opacity: Math.max(0, enter * (1 - exit)),
    translateY: (1 - enter) * 18 - exit * 26,
    scale: 0.94 + 0.06 * enter - exit * 0.04,
  };
};

const applyMotion = (m: Motion): React.CSSProperties => ({
  opacity: m.opacity,
  transform: `translateY(${m.translateY.toFixed(2)}px) scale(${m.scale.toFixed(4)})`,
  willChange: "transform, opacity",
});

// ── Right column ──────────────────────────────────────────────────────────
const COL_X = 1000;
const COL_W = W - COL_X - 80;

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      width: 10,
      height: 10,
      borderRadius: 999,
      background: color,
      boxShadow: `0 0 14px ${color}`,
      flexShrink: 0,
    }}
  />
);

const Pill: React.FC<{
  kind: PillKind;
  motion: Motion;
  children: React.ReactNode;
}> = ({ kind, motion, children }) => (
  <div style={applyMotion(motion)}>
    <div style={pillStyle(kind)}>{children}</div>
  </div>
);

// ── Cluster A — "Why they think they lost" ────────────────────────────────
const ClusterA: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const headerM = computeMotion(frame, fps, F_HEADER_A, F_A_EXIT);
  const stratM = computeMotion(frame, fps, F_STRATEGIES, F_A_EXIT + 4);
  const feesM = computeMotion(frame, fps, F_FEES, F_A_EXIT + 8);

  if (frame > F_A_GONE) return null;

  return (
    <div style={{ position: "absolute", left: COL_X, top: 230, width: COL_W }}>
      <Pill kind="header" motion={headerM}>
        <Dot color="#7AB8FF" />
        Why they think they lost
      </Pill>
      <div style={{ marginTop: 24, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Pill kind="leaf" motion={stratM}>Strategies</Pill>
        <Pill kind="leaf" motion={feesM}>Fees</Pill>
      </div>
    </div>
  );
};

// ── Cluster B — "Why they actually lost" ──────────────────────────────────
const ClusterB: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  if (frame < F_HEADER_B - 4) return null;

  const headerM = computeMotion(frame, fps, F_HEADER_B, null);
  const liqM = computeMotion(frame, fps, F_LIQ, null);
  const frontM = computeMotion(frame, fps, F_FRONT, null);
  const orderM = computeMotion(frame, fps, F_ORDER, null);
  const insiderM = computeMotion(frame, fps, F_INSIDER, null);

  return (
    <div style={{ position: "absolute", left: COL_X, top: 470, width: COL_W }}>
      <Pill kind="header" motion={headerM}>
        <Dot color="#FF6B82" />
        Why they actually lost
      </Pill>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          maxWidth: COL_W,
        }}
      >
        <Pill kind="leaf" motion={liqM}>Liquidation hunters</Pill>
        <Pill kind="leaf" motion={frontM}>Front runners</Pill>
        <Pill kind="leaf" motion={orderM}>Orderbook spoofers</Pill>
        <Pill kind="leafRed" motion={insiderM}>Insider traders</Pill>
      </div>
    </div>
  );
};

// ── Composition ───────────────────────────────────────────────────────────
export const IcebergData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = resolveCam(frame);

  const introOpacity = interpolate(frame, [0, 12], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(
    frame,
    [F_OUTRO_START, SCENE_FRAMES],
    [1, 0],
    { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneOpacity = Math.min(introOpacity, outroOpacity);

  return (
    <AbsoluteFill
      style={{
        background: "#03102A",
        opacity: sceneOpacity,
        fontFamily: font,
      }}
    >
      <Backdrop />
      <IcebergViewport cam={cam} />
      <ClusterA frame={frame} fps={fps} />
      <ClusterB frame={frame} fps={fps} />
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
