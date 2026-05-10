import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide06Market: React.FC = () => {
  return (
    <SlideFrame eyebrow="Market" pageNumber={6} pageTotal={SLIDE_COUNT}>
      <SlideTitle>Bottom-up TAM.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Customers × revenue per customer. Built from the seat, not the report.
      </SlideSubtitle>
      <Placeholder>[ TAM / SAM / SOM breakdown ]</Placeholder>
    </SlideFrame>
  );
};
