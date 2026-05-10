import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide13Vision: React.FC = () => {
  return (
    <SlideFrame
      pageNumber={13}
      pageTotal={SLIDE_COUNT}
      hideChrome
      align="center"
    >
      <div
        style={{
          fontFamily: FONT.text,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: COLOR.blue,
          marginBottom: 56,
        }}
      >
        Vision
      </div>
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 112,
          fontWeight: 600,
          color: COLOR.ink,
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          margin: 0,
          maxWidth: 1500,
        }}
      >
        One sentence about what the world looks like if we win.
      </h1>
    </SlideFrame>
  );
};
