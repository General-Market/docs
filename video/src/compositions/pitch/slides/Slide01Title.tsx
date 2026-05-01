import React from "react";
import { Img, staticFile } from "remotion";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide01Title: React.FC = () => {
  return (
    <SlideFrame pageNumber={1} pageTotal={SLIDE_COUNT} hideBrand>
      <Img
        src={staticFile("gm-logo-black.svg")}
        style={{
          width: 168,
          height: 168,
          marginLeft: -16,
          marginBottom: 48,
          display: "block",
        }}
      />
      <h1
        style={{
          fontFamily: FONT.serif,
          fontSize: 156,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.02,
          letterSpacing: "-0.025em",
          margin: 0,
          marginBottom: 36,
        }}
      >
        General Market
      </h1>
      <div
        style={{
          fontFamily: FONT.serif,
          fontSize: 48,
          fontWeight: 300,
          fontStyle: "italic",
          color: COLOR.muted,
          lineHeight: 1.3,
          maxWidth: 1100,
        }}
      >
        Scaling prediction markets to 1B liquid markets
      </div>
    </SlideFrame>
  );
};
