// Composition-level asset gate.
//
// Font/image readiness must be resolved OUTSIDE the shared ThreeCanvas: a
// state flip inside the R3F tree does not reliably repaint the GL frame in
// a still/worker-chunk render (the canvas paints on remotion's frame
// invalidation, not on internal setState). So the one-world composition
// holds the whole canvas until this hook reports ready, and the scene
// worlds consume the already-loaded assets synchronously.

import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";

// Union of every weight the scenes use (300 = AdvDis lines).
const { waitUntilDone } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "600", "700"],
});

let titleImg: HTMLImageElement | null = null;
const imgLoaded: Promise<void> =
  typeof Image === "undefined"
    ? Promise.resolve()
    : new Promise((resolve) => {
        const im = new Image();
        im.onload = () => {
          titleImg = im;
          resolve();
        };
        im.onerror = () => resolve();
        im.src = staticFile("irswap-assets/title-inner.png");
      });

// Synchronous accessor — non-null once useIrswapAssets() returned true.
export const getTitleImg = (): HTMLImageElement | null => titleImg;

export const useIrswapAssets = (): boolean => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("irswap-assets"));
  useEffect(() => {
    Promise.all([Promise.resolve(waitUntilDone()), imgLoaded]).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready;
};
