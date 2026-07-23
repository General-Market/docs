import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { CrxAppScenes } from "./src/compositions/replicates/anoma/CrxAppCards";

// Scratch QA contact sheet: 9 frozen frames of the CRX app cards on a
// 3×3 grid. Each cell is 1280×720 — the cards' native 720-space — so
// tiling 3×3 fills the 3840×2160 sheet with the scenes rendered 1:1
// (geometrically identical to the HD_SCALE=3 master downscaled 0.333).
const FRAMES = [180, 250, 300, 345, 520, 620, 700, 810, 835];

const Sheet: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#dfe4e6",
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      alignContent: "flex-start",
    }}
  >
    {FRAMES.map((f) => (
      <div
        key={f}
        style={{
          position: "relative",
          width: 1280,
          height: 720,
          overflow: "hidden",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
        }}
      >
        <CrxAppScenes frame={f} />
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            zIndex: 10,
            fontFamily: "Menlo, monospace",
            fontSize: 22,
            lineHeight: 1,
            padding: "6px 10px",
            backgroundColor: "rgba(0,0,0,0.72)",
            color: "#fff",
            borderRadius: 4,
          }}
        >
          f{f}
        </div>
      </div>
    ))}
  </AbsoluteFill>
);

const Root: React.FC = () => (
  <Composition
    id="CrxContactSheet"
    component={Sheet}
    width={3840}
    height={2160}
    fps={30}
    durationInFrames={1}
  />
);

registerRoot(Root);
