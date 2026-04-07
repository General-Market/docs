import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { THEME } from "../theme";
import { SquareGrid } from "../components/SquareGrid";
import { TextTrailTitle } from "../components/TextTrailTitle";
import { SvgWipe } from "../components/SvgWipe";
import { Counter } from "../components/Counter";

const { fontFamily } = loadFont();

const SUBTITLE_TEXT = "Because it's parimutuel.";

const LEFT_GRID_W = 520;
const LEFT_GRID_H = 420;
const RIGHT_GRID_W = 820;
const RIGHT_GRID_H = 580;

export const Scene03GridExpands: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  const gridOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Right grid expands from 10x8 to 28x20 over frames 20-80. Integer steps
  // keep the layout from recomputing every frame.
  const expandT = interpolate(frame, [20, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const colsRaw = 10 + expandT * 18;
  const rowsRaw = 8 + expandT * 12;
  const rightCols = Math.round(colsRaw / 2) * 2;
  const rightRows = Math.round(rowsRaw / 2) * 2;

  // Typewriter subtitle
  const subtitleStart = 30;
  const charsPerFrame = 0.6;
  const visibleChars = Math.max(
    0,
    Math.floor((frame - subtitleStart) * charsPerFrame),
  );
  const subtitleText = SUBTITLE_TEXT.slice(0, visibleChars);

  // Rainbow ray-marched-ish background — simplified to a moving multi-stop
  // radial gradient behind the counter. Matches the spirit of MouseLight
  // without the shader budget.
  const cx = 70 + Math.sin(time * 0.7 + 0.3) * 12;
  const cy = 70 + Math.cos(time * 1.1 + 1.7) * 12;
  const hueA = Math.round((time * 30) % 360);
  const hueB = (hueA + 60) % 360;
  const hueC = (hueA + 180) % 360;
  const rainbowOpacity = interpolate(frame, [30, 60, 130, 150], [0, 0.6, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bgDark }}>
      {/* Rainbow ray-marched-inspired background — sits behind the right grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: rainbowOpacity,
          background: `radial-gradient(circle at ${cx}% ${cy}%, hsla(${hueA}, 85%, 55%, 0.35) 0%, hsla(${hueB}, 85%, 50%, 0.22) 22%, hsla(${hueC}, 85%, 45%, 0.1) 45%, rgba(11,20,38,0) 70%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Grids */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          opacity: gridOpacity,
          paddingTop: 100,
          paddingBottom: 140,
        }}
      >
        <SquareGrid
          cols={10}
          rows={8}
          fillRatio={0.5}
          activeColor={THEME.grey}
          inactiveColor={THEME.divider}
          width={LEFT_GRID_W}
          height={LEFT_GRID_H}
          seed={1}
          startFrame={10}
          fillDurationFrames={30}
        />
        <SquareGrid
          cols={rightCols}
          rows={rightRows}
          fillRatio={1.0}
          activeColor={THEME.gmGreen}
          inactiveColor={THEME.divider}
          width={RIGHT_GRID_W}
          height={RIGHT_GRID_H}
          seed={2}
          startFrame={10}
          fillDurationFrames={40}
        />
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 0,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <TextTrailTitle
          text="Infinite markets."
          startFrame={5}
          fontSize={84}
        />
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 400,
            fontSize: 30,
            color: THEME.muted,
            minHeight: 40,
          }}
        >
          {subtitleText}
          <span
            style={{
              opacity: visibleChars < SUBTITLE_TEXT.length ? 1 : 0,
              color: THEME.gmGreen,
            }}
          >
            _
          </span>
        </div>
      </div>

      {/* Counter under right grid */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          right: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          textShadow: `0 0 28px ${THEME.gmGreen}cc, 0 2px 6px rgba(0,0,0,0.7)`,
        }}
      >
        <Counter
          target={300000}
          durationFrames={60}
          startFrame={40}
          label="markets"
          color={THEME.textLight}
          fontSize={80}
        />
      </div>

      <SvgWipe startFrame={0} durationFrames={20} direction="down" />
    </AbsoluteFill>
  );
};
