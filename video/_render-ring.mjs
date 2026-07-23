import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const root = "/Users/maxguillabert/Downloads/index/video";
const entry = path.join(root, "src/index.ts");
const outDir = "/tmp/ring-bundle";
const env = { REMOTION_SHOW_SCENES: "1" };

fs.rmSync(outDir, { recursive: true, force: true });
const serveUrl = await bundle({ entryPoint: entry, publicDir: "/tmp/empty-public", outDir });
const comp = await selectComposition({ serveUrl, id: "WP-RingCarousel", envVariables: env });
for (const frame of [0, 100, 150, 250, 300]) {
  await renderStill({ serveUrl, composition: comp, output: `/tmp/scene-checks/fix-RingCarousel-${frame}.png`, frame, envVariables: env });
  console.log("rendered frame", frame);
}
console.log("DONE");
