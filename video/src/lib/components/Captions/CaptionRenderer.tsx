import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import type { CaptionPage } from "../../types";
import type { CaptionStylePreset } from "../../types";
import { PhraseGroup } from "./PhraseGroup";
import { captionPresets } from "./captionStyles";

interface Props {
  pages: CaptionPage[];
  keywords: string[];
  stylePreset?: CaptionStylePreset;
  yPosition?: number;
}

export const CaptionRenderer: React.FC<Props> = ({
  pages,
  keywords,
  stylePreset = "bold-stroke",
  yPosition = 850,
}) => {
  const frame = useCurrentFrame();
  const style = captionPresets[stylePreset];

  return (
    <div
      style={{
        position: "absolute",
        top: yPosition,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 8,
      }}
    >
      {pages.map((page, i) => {
        if (frame < page.startFrame || frame >= page.endFrame) return null;
        return (
          <Sequence
            key={i}
            from={page.startFrame}
            durationInFrames={page.endFrame - page.startFrame}
            layout="none"
          >
            <PhraseGroup
              words={page.words}
              keywords={keywords}
              style={style}
            />
          </Sequence>
        );
      })}
    </div>
  );
};
