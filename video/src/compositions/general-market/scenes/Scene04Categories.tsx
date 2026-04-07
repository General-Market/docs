import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { THEME, CATEGORIES } from "../theme";
import { SquareGrid } from "../components/SquareGrid";
import { TextTrailTitle } from "../components/TextTrailTitle";
import { SvgWipe } from "../components/SvgWipe";

const { fontFamily } = loadFont();

const LEFT_GRID_W = 520;
const LEFT_GRID_H = 420;
const RIGHT_GRID_W = 820;
const RIGHT_GRID_H = 620;

export const Scene04Categories: React.FC = () => {
  const frame = useCurrentFrame();

  const gridOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const accentOpacity = interpolate(frame, [110, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Cycle category index 0..13 across the body of the scene.
  const categoryIndex = Math.floor(
    interpolate(frame, [20, 130], [0, CATEGORIES.length - 0.01], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const categoryHue = (categoryIndex * 360) / 14;
  const categoryColor = `hsl(${Math.round(categoryHue)}, 70%, 55%)`;

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
          justifyContent: "space-around",
          opacity: gridOpacity,
          paddingTop: 110,
          paddingBottom: 170,
        }}
      >
        <SquareGrid
          cols={10}
          rows={8}
          fillRatio={0.3}
          activeColor={THEME.muted}
          inactiveColor={THEME.divider}
          width={LEFT_GRID_W}
          height={LEFT_GRID_H}
          seed={1}
          startFrame={10}
          fillDurationFrames={30}
        />
        <SquareGrid
          cols={20}
          rows={14}
          fillRatio={1.0}
          activeColor={THEME.gmGreen}
          inactiveColor={THEME.divider}
          pulseFreq={0.6}
          pulseAmplitude={0.18}
          categoryIndex={categoryIndex}
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
          text="Most venues can't list these."
          startFrame={5}
          fontSize={72}
        />
      </div>

      {/* Floating category label */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: "50%",
          width: "50%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: categoryColor,
            textTransform: "uppercase",
            letterSpacing: 6,
            textShadow: "0 0 20px rgba(0,0,0,0.6)",
          }}
        >
          {CATEGORIES[categoryIndex]}
        </div>
      </div>

      {/* Accent strapline */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          width: "100%",
          textAlign: "center",
          opacity: accentOpacity,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: THEME.muted,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Because it&apos;s batched parimutuel.
        </div>
      </div>

      <SvgWipe startFrame={0} durationFrames={20} direction="down" />
    </AbsoluteFill>
  );
};
