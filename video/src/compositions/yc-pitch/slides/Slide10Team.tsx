import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide10Team: React.FC = () => {
  return (
    <SlideFrame eyebrow="Team" pageNumber={10} pageTotal={SLIDE_COUNT}>
      <SlideTitle>The humans.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Why these specific people solve this specific problem.
      </SlideSubtitle>
      <div style={{ display: "flex", gap: 32, marginTop: 32, width: "100%" }}>
        <Placeholder height={320}>[ founder 01 ]</Placeholder>
        <Placeholder height={320}>[ founder 02 ]</Placeholder>
        <Placeholder height={320}>[ founder 03 ]</Placeholder>
      </div>
    </SlideFrame>
  );
};
