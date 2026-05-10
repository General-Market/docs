import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide05WhyNow: React.FC = () => {
  return (
    <SlideFrame eyebrow="Why Now" pageNumber={5} pageTotal={SLIDE_COUNT}>
      <SlideTitle>What changed.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Regulation. Technology. Behavior. The shift that makes this inevitable.
      </SlideSubtitle>
      <Placeholder>[ timeline / inflection chart / catalyst ]</Placeholder>
    </SlideFrame>
  );
};
