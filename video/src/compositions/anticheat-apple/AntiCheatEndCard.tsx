import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, easeOut, toFrames } from "./theme";

// 7.2s scene — reveals land in the first ~80 frames, the remaining ~136 frames
// hold in stillness. Apple end-cards sit. URL stillness lands at 120 frames.
const SCENE_SECONDS = 7.2;
const SUBLINE_AT = toFrames(1.0);
const TERTIARY_AT = toFrames(1.5);
const URL_AT = toFrames(2.0);

export const AntiCheatEndCard: React.FC = () => {
  const frame = useCurrentFrame();

  // Beat 1 (0s): wordmark + eyebrow fade up together. No scale punch.
  const beat1Opacity = interpolate(frame, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const beat1Y = interpolate(frame, [0, 36], [32, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underline draws once, immediately under wordmark.
  const underlineT = interpolate(
    frame,
    [toFrames(0.4), toFrames(1.1)],
    [0, 1],
    {
      easing: easeOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Beat 2 (1.5s): subline.
  const sublineLocal = frame - SUBLINE_AT;
  const sublineOpacity = interpolate(sublineLocal, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sublineY = interpolate(sublineLocal, [0, 36], [32, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Beat 3 (2.2s): tertiary uppercase.
  const tertiaryLocal = frame - TERTIARY_AT;
  const tertiaryOpacity = interpolate(tertiaryLocal, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tertiaryY = interpolate(tertiaryLocal, [0, 36], [32, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Beat 4 (2.9s): URL line, fades up last.
  const urlLocal = frame - URL_AT;
  const urlOpacity = interpolate(urlLocal, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlY = interpolate(urlLocal, [0, 36], [32, 0], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 40,
            fontWeight: 500,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: colors.dim,
            marginBottom: 32,
            opacity: beat1Opacity,
            transform: `translateY(${beat1Y}px)`,
          }}
        >
          Anti-Cheat · Trading
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 180,
            fontWeight: 400,
            letterSpacing: "-0.045em",
            color: "#f2f2f2",
            lineHeight: 0.95,
            opacity: beat1Opacity,
            transform: `translateY(${beat1Y}px)`,
            transformOrigin: "center",
          }}
        >
          General
        </div>

        <div
          style={{
            position: "relative",
            width: 480,
            height: 2,
            marginTop: 28,
            marginBottom: 36,
            background: colors.rule,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${underlineT * 100}%`,
              background:
                "linear-gradient(90deg, rgba(245,245,245,0) 0%, #f5f5f5 50%, rgba(245,245,245,0) 100%)",
            }}
          />
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 56,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            color: colors.fg,
            opacity: sublineOpacity,
            transform: `translateY(${sublineY}px)`,
          }}
        >
          Trading is easy with an Anti-Cheat
        </div>

        <div
          style={{
            marginTop: 32,
            fontFamily: monoFont,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: colors.dim,
            opacity: tertiaryOpacity,
            transform: `translateY(${tertiaryY}px)`,
          }}
        >
          Available only via trading bots
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: monoFont,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "0.12em",
            color: colors.fg,
            opacity: urlOpacity,
            transform: `translateY(${urlY}px)`,
          }}
        >
          general.market/anti-cheat
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const antiCheatAppleEndCardMeta = {
  id: "AntiCheatAppleEndCard",
  component: AntiCheatEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
