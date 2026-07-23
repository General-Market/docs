import React from "react";
import { Composition, registerRoot } from "remotion";
import { crxAnomaMeta } from "./compositions/replicates/anoma/CrxAnomaComposition";

// Slim entry for the 16:9 CRX-Anoma landing film (the /crx-film/crx-anoma-16x9
// cut on crxfx.com). Mirrors src/index-crxwave.ts: imports ONLY this one
// composition so the studio/render stays small and never module-preloads the
// other comps' GLB/FBX (which OOMs Chrome). Launch: remotion studio src/index-crx16x9.tsx
const RootCrx16x9: React.FC = () => (
  <>
    <Composition key={crxAnomaMeta.id} {...crxAnomaMeta} />
  </>
);

registerRoot(RootCrx16x9);
