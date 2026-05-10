import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide01Title: React.FC = () => {
  return (
    <SlideFrame
      pageNumber={1}
      pageTotal={SLIDE_COUNT}
      hideChrome
      align="center"
    >
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 168,
          fontWeight: 600,
          color: COLOR.ink,
          lineHeight: 1,
          letterSpacing: "-0.035em",
          margin: 0,
          marginBottom: 48,
        }}
      >
        Company
      </h1>
      <p
        style={{
          fontFamily: FONT.display,
          fontSize: 40,
          fontWeight: 400,
          color: COLOR.muted,
          lineHeight: 1.25,
          letterSpacing: "-0.02em",
          margin: 0,
          maxWidth: 1200,
        }}
      >
        One sentence. What you do, for whom.
      </p>
    </SlideFrame>
  );
};
