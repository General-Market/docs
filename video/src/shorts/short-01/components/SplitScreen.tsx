import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, staticFile } from "remotion";
import { useShortContext } from "../ShortContext";

interface Props {
  leftSrc: string;
  rightSrc: string;
  leftTint?: string;
  rightTint?: string;
  leftBrightness?: number;
  rightBrightness?: number;
}

const resolveAsset = (src: string, bgDir: string) => {
  if (src.startsWith("shorts/")) return staticFile(src);
  return staticFile(`${bgDir}/${src}`);
};

export const SplitScreen: React.FC<Props> = ({
  leftSrc,
  rightSrc,
  leftTint,
  rightTint,
  leftBrightness = 0.7,
  rightBrightness = 0.7,
}) => {
  const { assetDir } = useShortContext();
  const bgDir = `${assetDir}/backgrounds`;
  const frame = useCurrentFrame();

  // Slide in from edges
  const slideIn = interpolate(frame, [0, 9], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Divider glow pulse
  const dividerOpacity = 0.6 + Math.sin(frame * 0.1) * 0.2;

  return (
    <AbsoluteFill>
      {/* Left side */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
          transform: `translateX(${(1 - slideIn) * -50}%)`,
          opacity: slideIn,
        }}
      >
        <Img
          src={resolveAsset(leftSrc, bgDir)}
          style={{
            width: "200%",
            height: "100%",
            objectFit: "cover",
            filter: `blur(8px) brightness(${leftBrightness})`,
          }}
        />
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
      {/* Right side */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
          transform: `translateX(${(1 - slideIn) * 50}%)`,
          opacity: slideIn,
        }}
      >
        <Img
          src={resolveAsset(rightSrc, bgDir)}
          style={{
            width: "200%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "right",
            filter: `blur(8px) brightness(${rightBrightness})`,
          }}
        />
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
      {/* Center divider */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: "100%",
          backgroundColor: "#FFFFFF",
          opacity: dividerOpacity * slideIn,
          transform: "translateX(-50%)",
          boxShadow: "0 0 10px rgba(255,255,255,0.3)",
          zIndex: 2,
        }}
      />
    </AbsoluteFill>
  );
};
