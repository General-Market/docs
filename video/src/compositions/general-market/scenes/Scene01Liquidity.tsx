import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { THEME } from "../theme";
import { SquareGrid } from "../components/SquareGrid";
import { TextTrailTitle } from "../components/TextTrailTitle";
import { SvgWipe } from "../components/SvgWipe";

const { fontFamily } = loadFont();

const SUBTITLE_TEXT = "Because it's parimutuel.";

const GRID_W = 620;
const GRID_H = 500;

export const Scene01Liquidity: React.FC = () => {
  const frame = useCurrentFrame();

  const gridOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const subtitleStart = 55;
  const charsPerFrame = 0.6;
  const visibleChars = Math.max(
    0,
    Math.floor((frame - subtitleStart) * charsPerFrame),
  );
  const subtitleText = SUBTITLE_TEXT.slice(0, visibleChars);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bgDark }}>
      {/* Two grids, side-by-side */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          opacity: gridOpacity,
          paddingTop: 120,
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
          fillDurationFrames={40}
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
          fillDurationFrames={40}
        />
      </div>

      {/* Title — TextTrail wave */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <TextTrailTitle
          text="Always liquid."
          startFrame={10}
          fontSize={96}
        />
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 400,
            fontSize: 32,
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

      {/* Labels under each grid */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          opacity: gridOpacity,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 22,
            color: THEME.muted,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontWeight: 500,
          }}
        >
          OTHERS
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          opacity: gridOpacity,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 22,
            color: THEME.gmGreen,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontWeight: 500,
          }}
        >
          GENERAL MARKET
        </div>
      </div>

      {/* Incoming wipe — dome retracts downward to reveal the scene */}
      <SvgWipe startFrame={0} durationFrames={20} direction="down" />
    </AbsoluteFill>
  );
};
