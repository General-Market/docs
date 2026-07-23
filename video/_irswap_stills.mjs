import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";

const OUT = process.argv[2];
const TAG = process.argv[3];
const frames = process.argv.slice(4).map(Number);

const root = "/Users/maxguillabert/Downloads/index/video";
const entry = path.join(root, "src/index.ts");
const PUBLIC = "/tmp/irswap-r4-public";

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: entry, publicDir: PUBLIC });
const chromiumOptions = { gl: "angle" };
console.log("bundled in", ((Date.now() - t0) / 1000).toFixed(1), "s");

const comp = await selectComposition({ serveUrl, id: "IRSwap-Replicate" });

for (const f of frames) {
  const out = path.join(OUT, `${TAG}_${f}.png`);
  const ts = Date.now();
  await renderStill({
    composition: comp,
    serveUrl,
    output: out,
    frame: f,
    imageFormat: "png",
    overwrite: true,
    chromiumOptions,
  });
  console.log("frame", f, "->", out, ((Date.now() - ts) / 1000).toFixed(1), "s");
}
console.log("DONE");
process.exit(0);
