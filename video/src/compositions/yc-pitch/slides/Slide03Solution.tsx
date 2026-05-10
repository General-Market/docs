import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide03Solution: React.FC = () => {
  return (
    <SlideFrame eyebrow="Solution" pageNumber={3} pageTotal={SLIDE_COUNT}>
      <SlideTitle>What we built.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        One sentence. One screenshot. The thing that exists today.
      </SlideSubtitle>
      <Placeholder height={320}>[ product screenshot / hero shot ]</Placeholder>
    </SlideFrame>
  );
};
