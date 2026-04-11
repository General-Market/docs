import React from "react";
import { Img, OffthreadVideo, staticFile } from "remotion";
import { brollVideoPath, brollImagePath, hasBroll, isRendering } from "../brollAssets";

interface BrollCellProps {
  category: string;
  index: number;
}

export const BrollCell: React.FC<BrollCellProps> = ({ category, index }) => {
  if (!hasBroll(category, index)) return null;

  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  if (category === "movies") {
    return <Img src={staticFile(brollImagePath(category, index))} style={style} />;
  }

  if (isRendering()) {
    return (
      <OffthreadVideo
        src={staticFile(brollVideoPath(category, index))}
        style={style}
        muted
      />
    );
  }

  return <Img src={staticFile(brollImagePath(category, index))} style={style} />;
};
