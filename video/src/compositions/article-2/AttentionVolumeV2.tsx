import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ArticlePage } from "./ArticlePage";
import { ImpressionsVolumeChart } from "./ImpressionsVolumeChart";
import { FPS, H, W, articleZoom } from "./theme";

const V2_TOTAL = 240;

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
    [0, 88, 110, 146, 164, 210, 240],
    [0, 80, 80, 300, 300, 490, 490],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  // one continuous push-in on the backdrop — confident, never pulling back
  const bgZoom = articleZoom(frame, V2_TOTAL);

  // whole-page blur lifts as the graph leaves
  const fullBlur = interpolate(frame, [0, 85, 112], [26, 26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // graph (and its numbers + scrim) dissolves away
  const graphOp = interpolate(frame, [0, 85, 112], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // enters already settling (frame 0 reads as motion), then scales up on exit
  const graphEntryScale = interpolate(frame, [0, 16], [1.04, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const graphExitScale = interpolate(frame, [85, 112], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const graphScale = graphEntryScale * graphExitScale;

  const articleOp = interpolate(frame, [232, 240], [1, 0], {
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
          markTimes={{ precedes: 122, driver: 176, onePct: 216, third: 226 }}
          bottomBlur
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
