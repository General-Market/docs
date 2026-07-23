// Slim entry — registers ONLY the crx-social comps so renders/stills don't drag
// in every other composition's module-scope font/FBX/GLB preloads (the full
// src/index.ts pulls ~75 comps + 48× Google-font network loads). Same pattern
// as src/index-replicas.ts. The comps are also registered in src/Root.tsx.
import React from "react";
import { Composition, registerRoot } from "remotion";
import {
  fxHedgingSquareMeta,
  macbookHeroStillMeta,
} from "./compositions/crx-social/FxHedgingSquare";
import { fxScreenSequenceMeta } from "./compositions/crx-social/FxScreenSequence";

const Root: React.FC = () =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, {
      id: fxHedgingSquareMeta.id,
      component: fxHedgingSquareMeta.component,
      durationInFrames: fxHedgingSquareMeta.durationInFrames,
      fps: fxHedgingSquareMeta.fps,
      width: fxHedgingSquareMeta.width,
      height: fxHedgingSquareMeta.height,
    }),
    React.createElement(Composition, {
      id: macbookHeroStillMeta.id,
      component: macbookHeroStillMeta.component,
      durationInFrames: macbookHeroStillMeta.durationInFrames,
      fps: macbookHeroStillMeta.fps,
      width: macbookHeroStillMeta.width,
      height: macbookHeroStillMeta.height,
    }),
    React.createElement(Composition, {
      id: fxScreenSequenceMeta.id,
      component: fxScreenSequenceMeta.component,
      durationInFrames: fxScreenSequenceMeta.durationInFrames,
      fps: fxScreenSequenceMeta.fps,
      width: fxScreenSequenceMeta.width,
      height: fxScreenSequenceMeta.height,
    }),
  );

registerRoot(Root);
