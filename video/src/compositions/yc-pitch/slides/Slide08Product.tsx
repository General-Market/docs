import React from "react";
import { SlideFrame, SlideTitle, SlideSubtitle, Placeholder } from "../SlideFrame";
import { SLIDE_COUNT } from "../tokens";

export const Slide07Product: React.FC = () => {
  return (
    <SlideFrame eyebrow="Product" pageNumber={7} pageTotal={SLIDE_COUNT}>
      <SlideTitle>How it works.</SlideTitle>
      <SlideSubtitle maxWidth={1200}>
        Three screenshots. The magic moment, not the settings page.
      </SlideSubtitle>
      <div style={{ display: "flex", gap: 24, marginTop: 32, width: "100%" }}>
        <Placeholder height={300}>[ step 01 ]</Placeholder>
        <Placeholder height={300}>[ step 02 ]</Placeholder>
        <Placeholder height={300}>[ step 03 ]</Placeholder>
      </div>
    </SlideFrame>
  );
};
