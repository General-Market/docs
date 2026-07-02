// One-shot verification stills for the CRX-Anoma composition.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";

const FRAMES = [30, 58, 95, 180, 240, 290, 345, 395, 440, 520, 620, 700, 750, 820, 940];
const outDir = process.argv[2] ?? "/tmp/crx-stills";

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  onProgress: () => {},
});

const composition = await selectComposition({
  serveUrl,
  id: "CRX-Anoma",
});

for (const frame of FRAMES) {
  await renderStill({
    composition,
    serveUrl,
    frame,
    output: path.join(outDir, `f${String(frame).padStart(3, "0")}.png`),
  });
  console.log(`f${frame} done`);
}
