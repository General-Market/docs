import React from "react";
import { Composition } from "remotion";
import { emptyProject } from "@/project/schema";
import { TimelineComposition } from "./TimelineComposition";

export const RemotionRoot: React.FC = () => {
  const fallback = emptyProject();
  return (
    <>
      <Composition
        id="MaxCutTimeline"
        component={TimelineComposition}
        defaultProps={fallback}
        durationInFrames={600}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};

export default RemotionRoot;
