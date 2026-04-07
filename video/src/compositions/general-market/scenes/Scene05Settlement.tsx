import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { THEME } from "../theme";
import { SquareGrid } from "../components/SquareGrid";
import { TextTrailTitle } from "../components/TextTrailTitle";
import { SvgWipe } from "../components/SvgWipe";
import { Counter } from "../components/Counter";

const { fontFamily } = loadFont();

const GRID_W = 620;
const GRID_H = 500;

export const Scene05Settlement: React.FC = () => {
  const frame = useCurrentFrame();

  const gridOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bgDark,
        color: THEME.textLight,
        fontFamily,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          opacity: gridOpacity,
          paddingTop: 100,
          paddingBottom: 160,
        }}
      >
        <SquareGrid
          cols={10}
          rows={8}
          fillRatio={1.0}
          activeColor={THEME.muted}
          inactiveColor={THEME.divider}
          pulseFreq={0.5}
          pulseAmplitude={0.25}
          width={GRID_W}
          height={GRID_H}
          seed={1}
          startFrame={10}
          fillDurationFrames={30}
        />
        <SquareGrid
          cols={10}
          rows={8}
          fillRatio={1.0}
          activeColor={THEME.gmGreen}
          inactiveColor={THEME.divider}
          pulseFreq={8}
          pulseAmplitude={0.22}
          width={GRID_W}
          height={GRID_H}
          seed={2}
          startFrame={10}
          fillDurationFrames={30}
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
          text="30x faster to settle."
          startFrame={5}
          fontSize={84}
        />
      </div>

      {/* LEFT counter — static "1 / week" */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Counter
          target={1}
          durationFrames={1}
          startFrame={20}
          label="/ week"
          color={THEME.muted}
          fontSize={72}
          formatWithCommas={false}
        />
      </div>

      {/* RIGHT counter — 0 → 144 / day */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          width: "50%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Counter
          target={144}
          durationFrames={100}
          startFrame={20}
          label="/ day"
          color={THEME.gmGreen}
          fontSize={72}
          formatWithCommas={false}
        />
      </div>

      <SvgWipe startFrame={0} durationFrames={20} direction="down" />
    </AbsoluteFill>
  );
};
