/**
 * LogoOverlay — brand logo watermark (top-left)
 *
 * A small white silhouette of whatever logo you hand it,
 * positioned in the top-left corner. Fades in gently after
 * a configurable delay. If the image doesn't exist, it
 * renders nothing — a graceful absence, not a crash.
 */
import React, { useState } from "react";
import { Img, staticFile, useCurrentFrame, interpolate } from "remotion";

interface LogoOverlayProps {
  /** Path to logo relative to public/ */
  src: string;
  /** Logo width in px (default 60) */
  size?: number;
  /** Delay before appearing in frames (default 10) */
  delay?: number;
}

const FADE_DURATION = 15;
const TARGET_OPACITY = 0.7;

export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  src,
  size = 60,
  delay = 10,
}) => {
  const frame = useCurrentFrame();
  const [failed, setFailed] = useState(false);

  const opacity = interpolate(
    frame,
    [delay, delay + FADE_DURATION],
    [0, TARGET_OPACITY],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (failed || opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 40,
        opacity,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 900,
      }}
    >
      <Img
        src={staticFile(src)}
        width={size}
        style={{
          width: size,
          height: "auto",
          filter:
            "brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
};
