import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide09Competition: React.FC = () => {
  return (
    <SlideFrame eyebrow="Competition" pageNumber={9} pageTotal={SLIDE_COUNT}>
      <SlideTitle>The landscape.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Name the incumbents. Show the gap you fill.
      </SlideSubtitle>
      <Placeholder height={360}>[ 2×2 matrix / feature grid ]</Placeholder>
    </SlideFrame>
  );
};
