import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ArticleReview } from "./ArticleReview";
import { ImpressionsVolumeChart } from "./ImpressionsVolumeChart";
import {
  ARTICLE_DUR,
  FPS,
  GRAPH_DUR,
  GRAPH_START,
  H,
  TOTAL,
  W,
} from "./theme";

export const AttentionVolume: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Sequence durationInFrames={ARTICLE_DUR}>
      <ArticleReview />
    </Sequence>
    <Sequence from={GRAPH_START} durationInFrames={GRAPH_DUR}>
      <ImpressionsVolumeChart />
    </Sequence>
  </AbsoluteFill>
);

export const attentionVolumeMeta = {
  id: "AttentionVolume",
  component: AttentionVolume,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};
