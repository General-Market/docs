import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ArticlePage } from "./ArticlePage";
import { ImpressionsVolumeChart } from "./ImpressionsVolumeChart";
import { FPS, H, W } from "./theme";

const V2_TOTAL = 360;

/**
 * V2 — graph-first. Open big on the chart over a blurred, dimmed article;
 * dissolve the chart and its numbers as the blur lifts; then the article
 * comes into focus and the proofs underline themselves.
 */
export const AttentionVolumeV2: React.FC = () => {
  const frame = useCurrentFrame();

  // article scroll: a slow drift behind the chart, then steps through the proofs
  const scroll = interpolate(
    frame,
    [0, 150, 178, 212, 250, 286, 360],
    [0, 80, 80, 300, 300, 490, 490],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  // slow Ken Burns on the backdrop so the frame keeps moving behind the chart
  const bgZoom = interpolate(frame, [0, 150], [1.06, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // whole-page blur lifts as the graph leaves
  const fullBlur = interpolate(frame, [0, 105, 150], [26, 26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // graph (and its numbers + scrim) dissolves away
  const graphOp = interpolate(frame, [0, 105, 150], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const graphScale = interpolate(frame, [105, 150], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const articleOp = interpolate(frame, [342, 360], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${bgZoom})`, transformOrigin: "center" }}>
        <ArticlePage
          scroll={scroll}
          opacity={articleOp}
          fullBlurPx={fullBlur}
          markTimes={{ precedes: 158, driver: 220, onePct: 294, third: 314 }}
          bottomBlur
          showChrome
        />
      </AbsoluteFill>
      {graphOp > 0.001 && (
        <AbsoluteFill
          style={{
            opacity: graphOp,
            transform: `scale(${graphScale})`,
            background: "rgba(9,11,16,0.70)",
          }}
        >
          <ImpressionsVolumeChart background="transparent" />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const attentionVolumeV2Meta = {
  id: "AttentionVolumeV2",
  component: AttentionVolumeV2,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: V2_TOTAL,
};
