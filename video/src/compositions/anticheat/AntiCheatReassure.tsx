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
import { noise2D } from "@remotion/noise";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

const SCENE_SECONDS = 5.5;
const SECOND_LINE_AT = toFrames(1.6);
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

// UI panel geometry — asset is 2000×984 (logged-in homepage).
const UI_SRC_W = 2000;
const UI_SRC_H = 984;
const UI_W = 1340;
const UI_H = (UI_W * UI_SRC_H) / UI_SRC_W;
const UI_LEFT = (W - UI_W) / 2;
const UI_TOP = 360;

// "Open" button center on the source asset (Polymarket featured card).
const BTN_SRC_X = 460;
const BTN_SRC_Y = 565;
const BTN_X = (BTN_SRC_X / UI_SRC_W) * UI_W;
const BTN_Y = (BTN_SRC_Y / UI_SRC_H) * UI_H;

// Cursor flight path — enters from off-panel bottom-right.
const CURSOR_FROM_X = UI_W * 0.82;
const CURSOR_FROM_Y = UI_H * 1.05;
const CURSOR_MOVE_START = toFrames(0.45);
const CURSOR_MOVE_END = toFrames(1.40);
const CLICK_AT = toFrames(1.50);

// Panel exit — mirrors the GMBrand Scene04 phone flight: translate
// far left, slight rotation, fade. Begins ~1.0s before scene end.
const PANEL_EXIT_AT = SCENE_FRAMES - toFrames(1.0);
const PANEL_EXIT_END = SCENE_FRAMES - toFrames(0.1);

// Emoji burst — bursts from the click, the same vocabulary as
// GMBrand Scene04. Burst origin sits at the click point in screen
// coordinates so the emojis fan out from the moment the cursor
// hits "Open".
const BURST_AT = CLICK_AT;
const BURST_ORIGIN_X = UI_LEFT + BTN_X;
const BURST_ORIGIN_Y = UI_TOP + BTN_Y;

export const AntiCheatReassure: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.02}>
        <DotGrid />
      </IdleZoom>
      <Headline />
      <RotatingProductPanel />
      <EmojiBurst />
      <ClickFlash />
      <Subtitle />
      <DotGridVignette intensity={0.20} />
    </AbsoluteFill>
  );
};

// Panel exit progress 0 → 1 over the closing window. Used by the
// product panel and the emoji cloud so they leave together.
const usePanelExit = (): { tx: number; rot: number; opacity: number } => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [PANEL_EXIT_AT, PANEL_EXIT_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.55, 0, 0.78, 0.2),
  });
  return {
    tx: t * -900,
    rot: t * -14,
    opacity: 1 - t,
  };
};

// Camera dollies in close on entry, pulls out to fit, punches on click,
// drifts back out at the end. Returns scale + xy shake offsets.
const useCamera = (): { scale: number; shakeX: number; shakeY: number } => {
  const frame = useCurrentFrame();

  // Phase 1 — pull from 1.18 to 1.00 over the first ~1.0s. We start
  // pressed against the UI, then breathe out to fit the whole product.
  const phase1 = interpolate(
    frame,
    [0, toFrames(0.95)],
    [1.18, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Phase 2 — click punch. Quick spike from 1.00 to 1.045 over ~3f, then
  // settle back to 1.02 by t+0.6s. The image lands.
  const punchUp = interpolate(
    frame,
    [CLICK_AT - 1, CLICK_AT + 3],
    [1.0, 1.045],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const punchSettle = interpolate(
    frame,
    [CLICK_AT + 3, CLICK_AT + toFrames(0.55)],
    [1.045, 1.02],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const punch = frame < CLICK_AT + 3 ? punchUp : punchSettle;

  // Phase 3 — slow drift outward at the tail (1.02 → 0.97), implying
  // the next scene starts pulling the world back.
  const driftOut = interpolate(
    frame,
    [toFrames(2.4), SCENE_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tailScale = interpolate(driftOut, [0, 1], [1.02, 0.97]);

  let scale: number;
  if (frame < toFrames(0.95)) scale = phase1;
  else if (frame < CLICK_AT - 1) scale = 1.0;
  else if (frame < toFrames(2.4)) scale = punch;
  else scale = tailScale;

  // Click shake — 4 frames of jitter starting at click, decaying.
  const shakeFrames = frame - CLICK_AT;
  const shakeAmp = interpolate(
    shakeFrames,
    [0, 1, 6],
    [0, 14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Pseudo-random jitter from sine combinations.
  const shakeX = Math.sin(shakeFrames * 17.3) * shakeAmp;
  const shakeY = Math.cos(shakeFrames * 21.7) * shakeAmp * 0.6;

  return { scale, shakeX, shakeY };
};

const Headline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t2 = spring({
    frame: frame - SECOND_LINE_AT,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "0 96px",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          color: colors.fg,
          lineHeight: 1.0,
        }}
      >
        <RevealChars
          text="Trade all the same assets"
          startFrame={0}
          stagger={0.7}
          duration={9}
          y={16}
          blur={4}
        />
      </div>

      <div
        style={{
          marginTop: 18,
          fontFamily: font,
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          color: colors.fg,
          lineHeight: 1.0,
          opacity: interpolate(t2, [0, 1], [0, 1]),
        }}
      >
        <span style={{ color: colors.dim, opacity: 0.7 }}>
          <RevealChars
            text=". . ."
            startFrame={SECOND_LINE_AT}
            stagger={3.0}
            duration={10}
            y={0}
            blur={0}
            scale={0.96}
          />
        </span>
        <span>&nbsp;</span>
        <RevealChars
          text="but"
          startFrame={SECOND_LINE_AT + toFrames(0.18)}
          stagger={1.4}
          duration={10}
          y={14}
          blur={4}
        />
        <span>&nbsp;</span>
        <span style={{ color: colors.accent }}>
          <RevealChars
            text="shielded"
            startFrame={SECOND_LINE_AT + toFrames(0.34)}
            stagger={1.6}
            duration={12}
            y={16}
            blur={5}
          />
        </span>
      </div>
    </div>
  );
};

const RotatingProductPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale: cameraScale, shakeX, shakeY } = useCamera();
  const exit = usePanelExit();

  const entry = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 80, mass: 0.95 },
  });
  const opacity = interpolate(entry, [0, 1], [0, 1]) * exit.opacity;

  // Slow continuous 3D oscillation. Yaw period 12s, pitch period 16s.
  const t = frame / fps;
  const rotateY = Math.sin(t * ((2 * Math.PI) / 12)) * 8;
  const rotateX = Math.cos(t * ((2 * Math.PI) / 16)) * -2.5;

  // Pulse on shielded reveal — the click triggers a soft accent bloom.
  const pulse = interpolate(
    frame,
    [CLICK_AT - 4, CLICK_AT + 8, CLICK_AT + 26],
    [0, 1, 0.55],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: UI_LEFT + shakeX + exit.tx,
        top: UI_TOP + shakeY,
        width: UI_W,
        height: UI_H,
        perspective: 2400,
        perspectiveOrigin: "50% 50%",
        opacity,
        transform: `rotate(${exit.rot}deg)`,
        transformOrigin: "50% 60%",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -120,
          background: `radial-gradient(ellipse at center, rgba(0,82,255,${
            0.14 + pulse * 0.22
          }), transparent 62%)`,
          filter: "blur(60px)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `scale(${cameraScale}) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 60px 140px rgba(10,12,18,0.30), 0 0 0 1px rgba(10,12,18,0.10)",
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile("anticheat-imgs/home-loggedin-2000x984.png")}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
          }}
        />
        <Cursor />
        <ClickBurst />
        <ShieldStamp />
      </div>
    </div>
  );
};

// ─── Shield burst — fired from the click point, mirrors the GMBrand
// Scene04 launch+settle pattern. Cloud rides along with the panel
// exit so it leaves the frame as one body. Shields instead of
// emoticons — every cleared trade is a shield earned.

type ShieldVariant = "solid" | "soft" | "outline" | "ink";

type ShieldSeed = {
  variant: ShieldVariant;
  endX: number;
  endY: number;
  size: number;
  seed: number;
  arcHeight: number;
};

const FLOATING_SHIELDS: ShieldSeed[] = [
  { variant: "solid",   endX: -380, endY: -260, size: 108, seed: 1,  arcHeight: 180 },
  { variant: "soft",    endX: -320, endY: -110, size: 100, seed: 2,  arcHeight: 140 },
  { variant: "outline", endX: -340, endY:  240, size:  70, seed: 3,  arcHeight:  90 },
  { variant: "solid",   endX:  430, endY:   80, size:  96, seed: 4,  arcHeight: 200 },
  { variant: "ink",     endX:  480, endY:  220, size:  84, seed: 5,  arcHeight: 150 },
  { variant: "soft",    endX:  410, endY:  350, size:  72, seed: 6,  arcHeight: 120 },
  { variant: "outline", endX:  360, endY: -180, size:  64, seed: 7,  arcHeight: 230 },
  { variant: "solid",   endX:  340, endY: -320, size:  76, seed: 8,  arcHeight: 200 },
  { variant: "ink",     endX: -250, endY: -380, size:  56, seed: 9,  arcHeight: 170 },
  { variant: "soft",    endX: -440, endY:   90, size:  80, seed: 10, arcHeight: 150 },
];

const quadBezier = (t: number, p0: number, p1: number, p2: number) => {
  const m = 1 - t;
  return m * m * p0 + 2 * m * t * p1 + t * t * p2;
};

const EmojiBurst: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = usePanelExit();

  if (frame < BURST_AT - 1) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: BURST_ORIGIN_X + exit.tx,
        top: BURST_ORIGIN_Y,
        width: 0,
        height: 0,
        opacity: exit.opacity,
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      {FLOATING_SHIELDS.map((item, i) => (
        <FloatingShield
          key={i}
          {...item}
          frame={frame}
          fps={fps}
          startFrame={BURST_AT + i * 2}
        />
      ))}
    </div>
  );
};

const FloatingShield: React.FC<
  ShieldSeed & { frame: number; fps: number; startFrame: number }
> = ({ variant, endX, endY, size, seed, arcHeight, frame, fps, startFrame }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const pathT = interpolate(localFrame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const controlX = endX * 0.3 + (seed % 2 === 0 ? -1 : 1) * arcHeight * 0.4;
  const controlY = endY * 0.3 - arcHeight;
  const x = quadBezier(pathT, 0, controlX, endX);
  const y = quadBezier(pathT, 0, controlY, endY);

  const scaleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 6, stiffness: 120, mass: 0.4 },
  });
  const floatScale = 1 + Math.sin(localFrame * 0.08 + seed) * 0.06;
  const settled = pathT >= 0.99;
  const noiseX = settled ? noise2D("acrX" + seed, localFrame * 0.02, seed) * 8 : 0;
  const noiseY = settled ? noise2D("acrY" + seed, localFrame * 0.015, seed) * 5 : 0;

  const launchSpin =
    interpolate(pathT, [0, 1], [0, (seed % 2 === 0 ? 1 : -1) * (15 + seed * 3)], {
      extrapolateRight: "clamp",
    });
  const wobble = Math.sin(localFrame * 0.1 + seed * 2) * 4;
  const rotation = pathT < 0.95 ? launchSpin : wobble;

  return (
    <div
      style={{
        position: "absolute",
        left: -size / 2,
        top: -size / 2,
        width: size,
        height: size,
        transform: `translate(${x + noiseX}px, ${y + noiseY}px) scale(${
          scaleSpring * floatScale
        }) rotate(${rotation}deg)`,
        opacity: Math.min(scaleSpring * 1.5, 1),
        filter: "drop-shadow(2px 6px 12px rgba(0,82,255,0.22))",
        pointerEvents: "none",
      }}
    >
      <ShieldGlyph variant={variant} />
    </div>
  );
};

const ShieldGlyph: React.FC<{ variant: ShieldVariant }> = ({ variant }) => {
  const fill =
    variant === "solid"
      ? colors.accent
      : variant === "soft"
        ? colors.accentSoft
        : variant === "ink"
          ? colors.fg
          : "none";
  const stroke =
    variant === "outline" ? colors.accent : variant === "ink" ? colors.fg : "#FFFFFF";
  const strokeWidth = variant === "outline" ? 8 : 5;
  const checkColor =
    variant === "outline" ? colors.accent : "#FFFFFF";

  return (
    <svg viewBox="0 0 100 110" width="100%" height="100%">
      <path
        d="M50 4 L92 18 L92 56 C92 82 72 99 50 106 C28 99 8 82 8 56 L8 18 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M30 56 L46 72 L72 40"
        fill="none"
        stroke={checkColor}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const Cursor: React.FC = () => {
  const frame = useCurrentFrame();

  const tMove = interpolate(
    frame,
    [CURSOR_MOVE_START, CURSOR_MOVE_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const eased = 1 - Math.pow(1 - tMove, 3);

  const x = CURSOR_FROM_X + (BTN_X - CURSOR_FROM_X) * eased;
  const y = CURSOR_FROM_Y + (BTN_Y - CURSOR_FROM_Y) * eased;

  const clickSquish = interpolate(
    frame,
    [CLICK_AT - 2, CLICK_AT, CLICK_AT + 5],
    [1, 0.82, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const cursorOpacity = interpolate(
    frame,
    [CURSOR_MOVE_START - 6, CURSOR_MOVE_START],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 30,
        height: 30,
        opacity: cursorOpacity,
        transform: `scale(${clickSquish})`,
        transformOrigin: "0 0",
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.30))",
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <svg viewBox="0 0 24 24" width={30} height={30}>
        <path
          d="M4.5 3 L4.5 19 L8.5 15.5 L11 21 L13.4 20 L10.9 14.6 L16.5 14.6 Z"
          fill="#ffffff"
          stroke="#0a0a0a"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// Burst at click point — concentric ring, radial spikes, white core.
const ClickBurst: React.FC = () => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [CLICK_AT, CLICK_AT + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame < CLICK_AT - 1) return null;

  const ringScale = interpolate(t, [0, 1], [0.3, 3.4]);
  const ringOpacity = interpolate(t, [0, 0.15, 1], [0, 0.65, 0]);

  const ring2Scale = interpolate(t, [0, 1], [0.2, 2.4]);
  const ring2Opacity = interpolate(t, [0, 0.25, 1], [0, 0.45, 0]);

  const coreOpacity = interpolate(t, [0, 0.08, 0.4], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coreScale = interpolate(t, [0, 0.4], [0.4, 1.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const spikeT = interpolate(t, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spikeOpacity = interpolate(t, [0, 0.1, 0.6], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spikeLength = interpolate(spikeT, [0, 1], [0, 70]);
  const spikeOffset = interpolate(spikeT, [0, 1], [10, 30]);

  const spikes = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);

  return (
    <div
      style={{
        position: "absolute",
        left: BTN_X,
        top: BTN_Y,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {/* Outer ring */}
      <div
        style={{
          position: "absolute",
          left: -36,
          top: -36,
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: `3px solid ${colors.accent}`,
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />
      {/* Inner ring */}
      <div
        style={{
          position: "absolute",
          left: -28,
          top: -28,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: `2px solid ${colors.accent}`,
          transform: `scale(${ring2Scale})`,
          opacity: ring2Opacity,
        }}
      />
      {/* White core */}
      <div
        style={{
          position: "absolute",
          left: -18,
          top: -18,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, #ffffff 0%, rgba(0,82,255,0.6) 60%, transparent 100%)",
          transform: `scale(${coreScale})`,
          opacity: coreOpacity,
          filter: "blur(2px)",
        }}
      />
      {/* Radial spikes */}
      {spikes.map((angle, i) => {
        const ox = Math.cos(angle) * spikeOffset;
        const oy = Math.sin(angle) * spikeOffset;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ox - spikeLength / 2,
              top: oy - 1.5,
              width: spikeLength,
              height: 3,
              background: colors.accent,
              borderRadius: 2,
              transform: `rotate(${(angle * 180) / Math.PI}deg)`,
              transformOrigin: "50% 50%",
              opacity: spikeOpacity,
            }}
          />
        );
      })}
    </div>
  );
};

// Brief screen-tint pulse on click. Sits above the panel, below text.
const ClickFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const tint = interpolate(
    frame,
    [CLICK_AT - 1, CLICK_AT + 2, CLICK_AT + 14],
    [0, 0.22, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (tint <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background: `rgba(0, 82, 255, ${tint})`,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};

const ShieldStamp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stamps in just after the click — the badge that "but shielded" earned.
  const STAMP_AT = CLICK_AT + 4;
  const stamp = spring({
    frame: frame - STAMP_AT,
    fps,
    config: { damping: 18, stiffness: 220, mass: 0.6 },
  });
  const opacity = interpolate(stamp, [0, 1], [0, 1]);
  const scale = interpolate(stamp, [0, 1], [0.55, 1]);

  return (
    <div
      style={{
        position: "absolute",
        right: 32,
        top: 28,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px 10px 14px",
        background: colors.accent,
        color: "#ffffff",
        borderRadius: 999,
        fontFamily: monoFont,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "100% 50%",
        boxShadow: "0 18px 40px rgba(0,82,255,0.40)",
        zIndex: 5,
      }}
    >
      <svg width={20} height={22} viewBox="0 0 100 110">
        <path
          d="M50 4 L92 18 L92 56 C92 82 72 99 50 106 C28 99 8 82 8 56 L8 18 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path
          d="M30 56 L46 72 L72 40"
          fill="none"
          stroke="#ffffff"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Shielded</span>
    </div>
  );
};

const Subtitle: React.FC = () => {
  const frame = useCurrentFrame();
  const FADE_AT = SECOND_LINE_AT + toFrames(0.55);

  const opacity = interpolate(
    frame,
    [FADE_AT, FADE_AT + toFrames(0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: monoFont,
        fontSize: 28,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: colors.dim,
        opacity,
      }}
    >
      Same markets · same speed · cheaters removed
    </div>
  );
};

export const antiCheatReassureMeta = {
  id: "AntiCheatReassure",
  component: AntiCheatReassure,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
