// Frames 4131-4263: "Advantages & Disadvantages" interstitial. Same paper
// room; the fallen chart dashboard settles on the floor; three centered
// text lines enter (tracking-in+fade / fade / fade) and exit together.

import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { clamp01, easeOutPow } from "../lib/helpers";
import { CameraRig, Room, Vignette } from "../lib/world";
import { FloorPaper, PAPER_CAM } from "./floorPaper";

const { fontFamily: FONT, waitUntilDone } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["300", "400"],
});

const F0 = 4131;
const fade = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1, b - a));

const useFonts = () => {
  const [, setReady] = useState(false);
  const [handle] = useState(() => delayRender("advdis-fonts"));
  useEffect(() => {
    Promise.resolve(waitUntilDone()).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
};

const Line: React.FC<{
  text: string; cx: number; cy: number; size: number; opacity: number;
  scaleX?: number; blur?: number;
}> = ({ text, cx, cy, size, opacity, scaleX = 1, blur = 0 }) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute", left: cx, top: cy,
        transform: `translate(-50%,-50%) scaleX(${scaleX})`,
        fontFamily: FONT, fontWeight: 300, fontSize: size, color: "#5A5A5A", letterSpacing: "0.5px",
        whiteSpace: "nowrap", opacity, lineHeight: 1,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {text}
    </div>
  );
};

export const AdvDis: React.FC = () => {
  const local = useCurrentFrame();
  const frame = local + F0;
  useFonts();

  // slow drift measured at f4200: +0.076 px/f x, +0.03 px/f y
  const dx = 0.076 * (frame - 4200);
  const dy = 0.03 * (frame - 4200);
  const out = 1 - fade(frame, 4244, 4266);

  // line 1: tracking-in (w 0.24→1 by 4145) + slow fade (ref is still pale
  // at 4150) + blur 4140-4142
  const sx = 0.24 + 0.76 * easeOutPow(fade(frame, 4140, 4145), 2);
  const o1 = fade(frame, 4141, 4157) * out;
  const b1 = 2.5 * (1 - fade(frame, 4140, 4142));
  const o2 = fade(frame, 4148, 4162) * out;
  const o3 = fade(frame, 4162, 4173) * out;

  return (
    <AbsoluteFill>
      <Vignette variant="room" />
      <Room>
        <CameraRig position={PAPER_CAM} />
        <FloorPaper frame={frame} />
      </Room>
      <Line text="Advantages" cx={419.5 + dx} cy={169 + dy} size={32} opacity={o1} scaleX={sx} blur={b1} />
      <Line text="&" cx={417 + dx} cy={200 + dy} size={30} opacity={o2} />
      <Line text="Disadvantages" cx={422 + dx} cy={230 + dy} size={32} opacity={o3} />
    </AbsoluteFill>
  );
};
