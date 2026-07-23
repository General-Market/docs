import React from "react";
import { Composition } from "remotion";
import { crxAnomaSilkMeta } from "./compositions/replicates/anoma/CrxAnomaComposition";

// Slim entry for the CRX-Anoma wide/halftone cut (src/index-crxwave.ts).
// The main src/index.ts bundles every composition — it copies the multi-GB
// public/ per render, module-preloads other comps' GLB/FBX (OOMs the browser),
// and drags in whatever else is mid-refactor in the tree (a syntax error in
// any comp breaks the shared esbuild bundle). This entry imports ONLY this
// cut, so renders are small, stable and independent. Render with a slim
// crx-assets public dir + a capped video cache:
//   npx remotion render src/index-crxwave.ts CRX-Anoma-Silk-Wide out.mp4 \
//     --public-dir <crx-assets-only-dir> --concurrency 1 \
//     --offthreadvideo-cache-size-in-bytes 314572800
export const RootCrxWave: React.FC = () => (
  <>
    <Composition key={crxAnomaSilkMeta.id} {...crxAnomaSilkMeta} />
  </>
);
