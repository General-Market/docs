/**
 * BackgroundLayer — real photograph or video, bright and recognizable.
 *
 * Light mode: higher brightness, minimal tint, desaturated but visible.
 * The media is the hero. A train station looks like a train station.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i;

interface BackgroundLayerProps {
  src: string;
  blur?: number;
  brightness?: number;
  tint?: string;
  zoom?: "in" | "out" | "none";
  zoomAmount?: number;
  saturation?: number;
  gradient?: boolean;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  src,
  blur = 0,
  brightness = 0.95,
  tint = "rgba(255,255,255,0.05)",
  zoom = "in",
  zoomAmount = 1.03,
  saturation = 0.75,
  gradient = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const isVideo = VIDEO_EXTENSIONS.test(src);

  const BASE_OVERSIZE = 1.08;
  let scale = BASE_OVERSIZE;

  if (zoom !== "none") {
    const from = zoom === "in" ? BASE_OVERSIZE : BASE_OVERSIZE * zoomAmount;
    const to = zoom === "in" ? BASE_OVERSIZE * zoomAmount : BASE_OVERSIZE;
    scale = interpolate(frame, [0, durationInFrames], [from, to], {
      extrapolateRight: "clamp",
    });
  }

  const filter = `blur(${blur}px) brightness(${brightness}) saturate(${saturation})`;

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter,
    transform: `scale(${scale})`,
    transformOrigin: "center center",
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {isVideo ? (
        <OffthreadVideo
          src={staticFile(src)}
          muted
          startFrom={0}
          style={mediaStyle}
        />
      ) : (
        <Img src={staticFile(src)} style={mediaStyle} />
      )}
      {/* Light tint overlay — barely visible */}
      <AbsoluteFill
        style={{
          backgroundColor: tint,
          pointerEvents: "none",
        }}
      />
      {/* Subtle bottom gradient for text contrast — light version */}
      {gradient && (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to top, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 20%, transparent 35%)",
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
