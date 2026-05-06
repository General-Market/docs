import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

const SCENE_SECONDS = 4.0;
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

export const AntiCheatReassure: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.03}>
        <DotGrid />
        <Headline />
        <RotatingProductPanel />
        <Subtitle />
        <DotGridVignette intensity={0.20} />
      </IdleZoom>
    </AbsoluteFill>
  );
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

  const entry = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 80, mass: 0.95 },
  });
  const opacity = interpolate(entry, [0, 1], [0, 1]);
  const entryScale = interpolate(entry, [0, 1], [0.94, 1]);

  // Slow continuous 3D oscillation. Yaw period 12s, pitch period 16s.
  const t = frame / fps;
  const rotateY = Math.sin(t * ((2 * Math.PI) / 12)) * 8;
  const rotateX = Math.cos(t * ((2 * Math.PI) / 16)) * -2.5;

  // Pulse on shielded reveal — the click triggers a soft accent bloom.
  const pulse = interpolate(
    frame,
    [CLICK_AT - 4, CLICK_AT + 8, CLICK_AT + 26],
    [0, 1, 0.45],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: UI_LEFT,
        top: UI_TOP,
        width: UI_W,
        height: UI_H,
        perspective: 2400,
        perspectiveOrigin: "50% 50%",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -90,
          background: `radial-gradient(ellipse at center, rgba(0,82,255,${
            0.14 + pulse * 0.18
          }), transparent 62%)`,
          filter: "blur(50px)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `scale(${entryScale}) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
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
        <ShieldStamp />
      </div>
    </div>
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

  // Click ripple — expanding ring at the button.
  const rippleT = interpolate(frame, [CLICK_AT, CLICK_AT + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleScale = interpolate(rippleT, [0, 1], [0.4, 2.8]);
  const rippleOpacity = interpolate(rippleT, [0, 0.15, 1], [0, 0.55, 0]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: BTN_X,
          top: BTN_Y,
          width: 60,
          height: 60,
          marginLeft: -30,
          marginTop: -30,
          borderRadius: "50%",
          border: `2px solid ${colors.accent}`,
          transform: `scale(${rippleScale})`,
          opacity: rippleOpacity,
          pointerEvents: "none",
        }}
      />
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
    </>
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
