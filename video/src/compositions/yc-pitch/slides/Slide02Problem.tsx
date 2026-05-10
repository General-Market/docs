import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide02Problem: React.FC = () => {
  return (
    <SlideFrame eyebrow="Problem" pageNumber={2} pageTotal={SLIDE_COUNT}>
      <SlideTitle>The pain.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Who hurts, how often, how much.
      </SlideSubtitle>
      <Placeholder>[ concrete user / frequency / cost ]</Placeholder>
    </SlideFrame>
  );
};
