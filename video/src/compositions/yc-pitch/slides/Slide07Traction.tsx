import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide07Traction: React.FC = () => {
  return (
    <SlideFrame eyebrow="Traction" pageNumber={7} pageTotal={SLIDE_COUNT}>
      <SlideTitle>Numbers.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Revenue, users, growth, retention. One chart that points up and right.
      </SlideSubtitle>
      <Placeholder height={360}>[ growth chart / KPIs / LOIs ]</Placeholder>
    </SlideFrame>
  );
};
