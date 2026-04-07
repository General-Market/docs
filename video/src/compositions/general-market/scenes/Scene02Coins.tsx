import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
} from "remotion";
import { THEME } from "../theme";
import { SquareGrid } from "../components/SquareGrid";
import { TextTrailTitle } from "../components/TextTrailTitle";
import { SvgWipe } from "../components/SvgWipe";
import { CoinBracket } from "../components/CoinBracket";

const GRID_W = 620;
const GRID_H = 500;

export const Scene02Coins: React.FC = () => {
  const frame = useCurrentFrame();

  const gridOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bgDark }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          opacity: gridOpacity,
          paddingTop: 100,
        }}
      >
        <SquareGrid
          cols={10}
          rows={8}
          fillRatio={0.5}
          activeColor={THEME.grey}
          inactiveColor={THEME.divider}
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
          text="$1 covers every market."
          startFrame={5}
          fontSize={84}
        />
      </div>

      {/* CoinBrackets under each grid */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <CoinBracket
          startFrame={30}
          span={80}
          durationFrames={30}
          label="covers 1 market"
          color="#B8C4D1"
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 70,
          right: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <CoinBracket
          startFrame={45}
          span={800}
          durationFrames={45}
          label="covers every market"
          color={THEME.gmGreen}
        />
      </div>

      <SvgWipe startFrame={0} durationFrames={20} direction="down" />
    </AbsoluteFill>
  );
};
