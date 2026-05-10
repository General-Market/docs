import React from "react";
import { Series } from "remotion";
import { FPS, W, H, SLIDE_FRAMES } from "./tokens";
import { Slide01Title } from "./slides/Slide01Title";
import { Slide02Problem } from "./slides/Slide02Problem";
import { Slide03Solution } from "./slides/Slide03Solution";
import { Slide04Insight } from "./slides/Slide04Insight";
import { Slide05WhyNow } from "./slides/Slide05WhyNow";
import { Slide06Market } from "./slides/Slide06Market";
import { Slide07Traction } from "./slides/Slide07Traction";
import { Slide08Product } from "./slides/Slide08Product";
import { Slide09Business } from "./slides/Slide09Business";
import { Slide10Competition } from "./slides/Slide10Competition";
import { Slide11Team } from "./slides/Slide11Team";
import { Slide12Ask } from "./slides/Slide12Ask";
import { Slide13Vision } from "./slides/Slide13Vision";

type SlideEntry = { id: string; component: React.FC; frames?: number };

const SLIDES: SlideEntry[] = [
  { id: "01-Title", component: Slide01Title },
  { id: "02-Problem", component: Slide02Problem },
  { id: "03-Solution", component: Slide03Solution },
  { id: "04-Insight", component: Slide04Insight },
  { id: "05-WhyNow", component: Slide05WhyNow },
  { id: "06-Market", component: Slide06Market },
  { id: "07-Traction", component: Slide07Traction },
  { id: "08-Product", component: Slide08Product },
  { id: "09-Business", component: Slide09Business },
  { id: "10-Competition", component: Slide10Competition },
  { id: "11-Team", component: Slide11Team },
  { id: "12-Ask", component: Slide12Ask },
  { id: "13-Vision", component: Slide13Vision },
];

const slideFrames = (s: SlideEntry) => s.frames ?? SLIDE_FRAMES;

export const YCPitchComposition: React.FC = () => {
  return (
    <Series>
      {SLIDES.map((slide) => (
        <Series.Sequence
          key={slide.id}
          durationInFrames={slideFrames(slide)}
          name={slide.id}
        >
          <slide.component />
        </Series.Sequence>
      ))}
    </Series>
  );
};

export const ycPitchMeta = {
  id: "YCPitch",
  component: YCPitchComposition,
  durationInFrames: SLIDES.reduce((sum, s) => sum + slideFrames(s), 0),
  fps: FPS,
  width: W,
  height: H,
};

export const ycPitchSceneMetas = SLIDES.map((slide) => ({
  id: `YCPitch-${slide.id}`,
  component: slide.component,
  durationInFrames: slideFrames(slide),
  fps: FPS,
  width: W,
  height: H,
}));
