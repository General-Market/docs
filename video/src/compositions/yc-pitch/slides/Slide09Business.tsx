import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide08Business: React.FC = () => {
  return (
    <SlideFrame eyebrow="Business Model" pageNumber={8} pageTotal={SLIDE_COUNT}>
      <SlideTitle>How we make money.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Price point. Unit economics. Specific, not aspirational.
      </SlideSubtitle>
      <Placeholder>[ pricing tiers / margins / LTV-CAC ]</Placeholder>
    </SlideFrame>
  );
};
