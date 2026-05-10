import React from "react";
import { Series } from "remotion";
import { FPS, W, H, SLIDE_FRAMES } from "./tokens";
import { Slide01Title } from "./slides/Slide01Title";
import { Slide02Problem } from "./slides/Slide02Problem";
import { Slide03Solution } from "./slides/Slide03Solution";
import { Slide04WhyNow } from "./slides/Slide04WhyNow";
import { Slide05Market } from "./slides/Slide05Market";
import { Slide06Traction } from "./slides/Slide06Traction";
import { Slide07Product } from "./slides/Slide07Product";
import { Slide08Business } from "./slides/Slide08Business";
import { Slide09Competition } from "./slides/Slide09Competition";
import { Slide10Team } from "./slides/Slide10Team";
import { Slide11Ask } from "./slides/Slide11Ask";
import { Slide12Vision } from "./slides/Slide12Vision";

type SlideEntry = { id: string; component: React.FC; frames?: number };

const SLIDES: SlideEntry[] = [
  { id: "01-Title", component: Slide01Title },
  { id: "02-Problem", component: Slide02Problem },
  { id: "03-Solution", component: Slide03Solution },
  { id: "04-WhyNow", component: Slide04WhyNow },
  { id: "05-Market", component: Slide05Market },
  { id: "06-Traction", component: Slide06Traction },
  { id: "07-Product", component: Slide07Product },
  { id: "08-Business", component: Slide08Business },
  { id: "09-Competition", component: Slide09Competition },
  { id: "10-Team", component: Slide10Team },
  { id: "11-Ask", component: Slide11Ask },
  { id: "12-Vision", component: Slide12Vision },
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
