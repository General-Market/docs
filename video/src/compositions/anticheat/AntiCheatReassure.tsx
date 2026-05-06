import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

const SCENE_SECONDS = 3.5;
const SECOND_LINE_AT = toFrames(1.4);
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

export const AntiCheatReassure: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t2 = spring({
    frame: frame - SECOND_LINE_AT,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });

  const liftFirst = interpolate(
    frame,
    [SECOND_LINE_AT - toFrames(0.3), SECOND_LINE_AT + toFrames(0.5)],
    [0, -64],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const shield = spring({
    frame: frame - SECOND_LINE_AT,
    fps,
    config: { damping: 26, stiffness: 100, mass: 1 },
  });
  const shieldOpacity = interpolate(shield, [0, 1], [0, 0.10]);
  const shieldScale = interpolate(shield, [0, 1], [0.85, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.04}>
        <DotGrid />

        {/* Faint shield in the back */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: shieldOpacity,
            transform: `scale(${shieldScale})`,
          }}
        >
          <ShieldGlyph />
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 96px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 124,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: colors.fg,
              lineHeight: 0.95,
              transform: `translateY(${liftFirst}px)`,
            }}
          >
            <RevealChars
              text="Trade all the same assets"
              startFrame={0}
              stagger={1.4}
              duration={11}
              y={20}
              blur={5}
            />
          </div>

          <div
            style={{
              marginTop: 36,
              fontFamily: font,
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: colors.fg,
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
              y={16}
              blur={4}
            />
            <span>&nbsp;</span>
            <span style={{ color: colors.accent }}>
              <RevealChars
                text="shielded"
                startFrame={SECOND_LINE_AT + toFrames(0.34)}
                stagger={1.6}
                duration={12}
                y={18}
                blur={5}
              />
            </span>
          </div>

          <div
            style={{
              marginTop: 44,
              fontFamily: monoFont,
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: colors.dim,
              opacity:
                interpolate(t2, [0, 1], [0, 1]) *
                interpolate(
                  frame,
                  [SECOND_LINE_AT + toFrames(0.4), SECOND_LINE_AT + toFrames(1.0)],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                ),
            }}
          >
            Same markets · same speed · cheaters removed
          </div>
        </div>

        <DotGridVignette intensity={0.18} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

const ShieldGlyph: React.FC = () => {
  return (
    <svg
      width={900}
      height={1000}
      viewBox="0 0 100 110"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d="M50 4 L92 18 L92 56 C92 82 72 99 50 106 C28 99 8 82 8 56 L8 18 Z"
        fill="none"
        stroke={colors.accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M30 56 L46 72 L72 40"
        fill="none"
        stroke={colors.accent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
