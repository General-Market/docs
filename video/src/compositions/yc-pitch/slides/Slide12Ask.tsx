import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide12Ask: React.FC = () => {
  return (
    <SlideFrame eyebrow="The Ask" pageNumber={12} pageTotal={SLIDE_COUNT}>
      <SlideTitle>What we're raising.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Amount. Terms. What 18 months of runway buys.
      </SlideSubtitle>
      <Placeholder>[ round size / use of funds / milestones ]</Placeholder>
    </SlideFrame>
  );
};
