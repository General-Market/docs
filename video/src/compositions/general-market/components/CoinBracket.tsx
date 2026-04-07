import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();

export interface CoinBracketProps {
  startFrame: number;
  coinLabel?: string;
  span: number;
  durationFrames: number;
  label?: string;
  color?: string;
}

const COIN_SIZE = 60;
const BRACE_HEIGHT = 24;
const GAP = 18;

const buildBracePath = (W: number): string => {
  if (W <= 20) return "";
  const mid = W / 2;
  return [
    `M 0 ${BRACE_HEIGHT}`,
    `Q 0 4, 12 4`,
    `L ${mid - 12} 4`,
    `Q ${mid} 4, ${mid} -8`,
    `Q ${mid} 4, ${mid + 12} 4`,
    `L ${W - 12} 4`,
    `Q ${W} 4, ${W} ${BRACE_HEIGHT}`,
  ].join(" ");
};

export const CoinBracket: React.FC<CoinBracketProps> = ({
  startFrame,
  coinLabel = "$1",
  span,
  durationFrames,
  label,
  color = "#00C853",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;

  // Coin springs in first
  const coinSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.5 },
    durationInFrames: 18,
  });
  const coinScale = 0.4 + coinSpring * 0.6;
  const coinOpacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Brace grows after coin lands (~frame 12)
  const braceStart = 12;
  const braceWidth = interpolate(
    localFrame,
    [braceStart, braceStart + durationFrames],
    [0, span],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Label fades in once brace is mostly drawn
  const labelStart = braceStart + durationFrames * 0.5;
  const labelOpacity = interpolate(
    localFrame,
    [labelStart, labelStart + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const path = buildBracePath(braceWidth);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: GAP,
        fontFamily,
      }}
    >
      {/* Gold coin */}
      <div
        style={{
          width: COIN_SIZE,
          height: COIN_SIZE,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, #FFE17A 0%, #F5C443 35%, #C99318 75%, #8B6112 100%)",
          boxShadow:
            "inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.4)",
          border: "2px solid #B8881A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 700,
          color: "#3A2A06",
          letterSpacing: -0.5,
          transform: `scale(${coinScale})`,
          opacity: coinOpacity,
          flexShrink: 0,
        }}
      >
        {coinLabel}
      </div>

      {/* Bracket + label column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: span,
        }}
      >
        {label ? (
          <div
            style={{
              fontSize: 30,
              color,
              textTransform: "uppercase",
              letterSpacing: 3,
              marginBottom: 12,
              opacity: labelOpacity,
              fontWeight: 700,
              textShadow: "0 2px 8px rgba(0,0,0,0.65)",
            }}
          >
            {label}
          </div>
        ) : null}
        <svg
          width={span}
          height={BRACE_HEIGHT + 12}
          viewBox={`0 -12 ${Math.max(span, 1)} ${BRACE_HEIGHT + 12}`}
          style={{ overflow: "visible" }}
        >
          {path ? (
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>
    </div>
  );
};
