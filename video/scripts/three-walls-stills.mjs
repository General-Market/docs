import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const OUT = "/tmp/3walls";
fs.mkdirSync(OUT, { recursive: true });

const shots = {
  TechnicalOverload: [80, 250, 350, 480, 560, 600, 640],
  FiniteLiquidity: [90, 250, 430, 600, 760, 870, 1080, 1180, 1260],
  AsphyxiationByWinners: [40, 150, 270, 380, 480, 600, 720, 840],
};

const entry = path.resolve("src/index.ts");
// These comps reference no public/ assets, so bundle against an empty publicDir
// instead of copying the 7.6G public/ folder (which fills the disk).
const emptyPublic = path.join(OUT, "empty-public");
fs.mkdirSync(emptyPublic, { recursive: true });
console.log("bundling…");
const serveUrl = await bundle({ entryPoint: entry, publicDir: emptyPublic });
console.log("bundled.");

for (const [id, frames] of Object.entries(shots)) {
  let composition;
  try {
    composition = await selectComposition({ serveUrl, id });
  } catch (e) {
    console.log("SELECT FAIL", id, String(e).slice(0, 300));
    continue;
  }
  for (const frame of frames) {
    const output = path.join(OUT, `${id}-${String(frame).padStart(4, "0")}.png`);
    try {
      await renderStill({ composition, serveUrl, output, frame, overwrite: true, chromiumOptions: { gl: "angle" } });
      console.log("wrote", output);
    } catch (e) {
      console.log("STILL FAIL", id, frame, String(e).slice(0, 400));
    }
  }
}
console.log("done");
