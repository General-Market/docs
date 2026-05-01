import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide08Product: React.FC = () => {
  return (
    <SlideFrame eyebrow="Product" pageNumber={9} pageTotal={SLIDE_COUNT}>
      <div
        style={{
          width: 1280,
          aspectRatio: "16 / 9",
          background: "rgba(15, 15, 15, 0.04)",
          border: `2px dashed ${COLOR.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT.sans,
          fontSize: 32,
          color: COLOR.muted,
        }}
      >
        Product video
      </div>
    </SlideFrame>
  );
};
