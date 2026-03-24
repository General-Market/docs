import React from "react";
import {
  AbsoluteFill,
  Img,
  Video,
  interpolate,
  useCurrentFrame,
  staticFile,
} from "remotion";
import type { BackgroundDef } from "../types";
import { useShortContext } from "../ShortContext";

interface Props {
  bg: BackgroundDef;
  durationFrames: number;
}

const resolveAsset = (src: string | undefined, bgDir: string) => {
  if (!src) return "";
  if (src.startsWith("shorts/")) return staticFile(src);
  return staticFile(`${bgDir}/${src}`);
};

const SolidBg: React.FC<{ color: string }> = ({ color }) => (
  <AbsoluteFill style={{ backgroundColor: color }} />
);

const GradientBg: React.FC<{
  colors: [string, string];
  angle?: number;
}> = ({ colors, angle = 180 }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`,
    }}
  />
);

const ImageBg: React.FC<{
  src: string;
  blur?: number;
  brightness?: number;
  tint?: string;
  tintOpacity?: number;
  kenBurns?: boolean;
  durationFrames: number;
  objectFit?: "cover" | "contain" | "fill";
  imageScale?: number;
  scrollDown?: boolean;
  scrollSpeed?: number;
  bgDir: string;
}> = ({
  src,
  blur = 0,
  brightness = 0.7,
  tint,
  tintOpacity = 0.15,
  kenBurns = false,
  durationFrames,
  objectFit = "cover",
  imageScale,
  scrollDown = false,
  scrollSpeed = 0.6,
  bgDir,
}) => {
  const frame = useCurrentFrame();
  const kbScale = kenBurns
    ? interpolate(frame, [0, durationFrames], [1.0, 1.03], {
        extrapolateRight: "clamp",
      })
    : 1;
  const totalScale = imageScale ? kbScale * imageScale : kbScale;

  // Scroll animation: smoothly pan from top to scrollSpeed% of the image
  const scrollProgress = scrollDown
    ? interpolate(frame, [0, durationFrames], [0, scrollSpeed * 100], {
        extrapolateRight: "clamp",
        easing: (t: number) => t * t * (3 - 2 * t), // smoothstep easing
      })
    : 0;

  if (scrollDown) {
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={resolveAsset(src, bgDir)}
          style={{
            position: "absolute",
            width: "100%",
            height: "auto",
            top: 0,
            left: 0,
            filter: `blur(${blur}px) brightness(${brightness})`,
            transform: `translateY(-${scrollProgress}%) scale(${totalScale})`,
            transformOrigin: "top center",
          }}
        />
        {tint && (
          <AbsoluteFill
            style={{ backgroundColor: tint, opacity: tintOpacity }}
          />
        )}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Img
        src={resolveAsset(src, bgDir)}
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          filter: `blur(${blur}px) brightness(${brightness})`,
          transform: `scale(${totalScale})`,
        }}
      />
      {tint && (
        <AbsoluteFill
          style={{ backgroundColor: tint, opacity: tintOpacity }}
        />
      )}
    </AbsoluteFill>
  );
};

const VideoBg: React.FC<{
  src: string;
  brightness?: number;
  tint?: string;
  tintOpacity?: number;
  bgDir: string;
}> = ({ src, brightness = 1.0, tint, tintOpacity = 0.15, bgDir }) => (
  <AbsoluteFill>
    <Video
      src={resolveAsset(src, bgDir)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: `brightness(${brightness})`,
      }}
      volume={0}
      muted
    />
    {tint && (
      <AbsoluteFill style={{ backgroundColor: tint, opacity: tintOpacity }} />
    )}
  </AbsoluteFill>
);

const SplitBg: React.FC<{
  leftSrc?: string;
  rightSrc?: string;
  leftTint?: string;
  rightTint?: string;
  dividerColor?: string;
  brightness?: number;
  blur?: number;
  bgDir: string;
}> = ({
  leftSrc,
  rightSrc,
  leftTint,
  rightTint,
  dividerColor = "#FFFFFF",
  brightness = 0.7,
  blur = 0,
  bgDir,
}) => {
  return (
    <AbsoluteFill>
      {/* Left half */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {leftSrc && (
          <Img
            src={resolveAsset(leftSrc, bgDir)}
            style={{
              width: "200%",
              height: "100%",
              objectFit: "cover",
              filter: `blur(${blur}px) brightness(${brightness})`,
            }}
          />
        )}
        {leftTint && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: leftTint,
              opacity: 0.2,
            }}
          />
        )}
      </div>
      {/* Right half */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {rightSrc && (
          <Img
            src={resolveAsset(rightSrc, bgDir)}
            style={{
              width: "200%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "right",
              filter: `blur(${blur}px) brightness(${brightness})`,
            }}
          />
        )}
        {rightTint && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: rightTint,
              opacity: 0.2,
            }}
          />
        )}
      </div>
      {/* Divider — glowing animated line */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 3,
          height: "100%",
          backgroundColor: dividerColor,
          transform: "translateX(-50%)",
          zIndex: 2,
          boxShadow: `0 0 12px ${dividerColor}80, 0 0 24px ${dividerColor}40`,
        }}
      />
    </AbsoluteFill>
  );
};

export const ShotBackground: React.FC<Props> = ({ bg, durationFrames }) => {
  const { assetDir } = useShortContext();
  const bgDir = `${assetDir}/backgrounds`;

  switch (bg.type) {
    case "solid":
      return <SolidBg color={bg.color ?? "#0A0A0A"} />;
    case "gradient":
      return (
        <GradientBg
          colors={bg.gradientColors ?? ["#0A0A0A", "#1a1a2e"]}
          angle={bg.gradientAngle}
        />
      );
    case "image":
      return (
        <ImageBg
          src={bg.src ?? ""}
          blur={bg.blur}
          brightness={bg.brightness}
          tint={bg.tint}
          tintOpacity={bg.tintOpacity}
          kenBurns={bg.kenBurns}
          durationFrames={durationFrames}
          objectFit={bg.objectFit}
          imageScale={bg.imageScale}
          scrollDown={bg.scrollDown}
          scrollSpeed={bg.scrollSpeed}
          bgDir={bgDir}
        />
      );
    case "video":
      return (
        <VideoBg
          src={bg.src ?? ""}
          brightness={bg.brightness}
          tint={bg.tint}
          tintOpacity={bg.tintOpacity}
          bgDir={bgDir}
        />
      );
    case "split":
      return (
        <SplitBg
          leftSrc={bg.leftSrc}
          rightSrc={bg.rightSrc}
          leftTint={bg.leftTint}
          rightTint={bg.rightTint}
          dividerColor={bg.dividerColor}
          brightness={bg.brightness}
          blur={bg.blur}
          bgDir={bgDir}
        />
      );
    default:
      return <SolidBg color="#0A0A0A" />;
  }
};
