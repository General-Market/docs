// ProtocolScreens — the two products the speaker built, floating behind him.
//
// On "I built [perps] and index protocol myself": his index app (General /
// Markets) on the left and the perps frontend (Symmio) on the right, both
// angled inward toward the centre (where he stands), white-bordered, drifting
// in a slow float. Drop into <BehindBeat back={<ProtocolScreens/>} /> so they
// sit behind the cutout.

import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const Screen: React.FC<{
  src: string;
  side: "left" | "right";
  enter: number; // 0..1 entrance
  bob: number; // px float offset
}> = ({ src, side, enter, bob }) => {
  const sign = side === "left" ? 1 : -1;
  // angle inward: the inner edge tips toward the viewer/centre
  const rotY = sign * -17;
  const cx = side === "left" ? "30%" : "70%";
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: "49%",
        width: 980,
        transform: [
          "translate(-50%, -50%)",
          `translateY(${bob}px)`,
          `perspective(2200px)`,
          `rotateY(${rotY}deg)`,
          `rotateX(2.5deg)`,
          `rotateZ(${sign * -1.2}deg)`,
          `scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
        ].join(" "),
        opacity: enter,
        borderRadius: 14,
        border: "7px solid #fff",
        overflow: "hidden",
        boxShadow: "0 40px 120px rgba(2,14,43,0.55), 0 8px 28px rgba(2,14,43,0.4)",
        background: "#fff",
      }}
    >
      <Img src={staticFile(src)} style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  );
};

export const ProtocolScreens: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterL = spring({ frame: frame - 2, fps, config: { damping: 18, mass: 0.9 }, durationInFrames: 22 });
  const enterR = spring({ frame: frame - 8, fps, config: { damping: 18, mass: 0.9 }, durationInFrames: 22 });

  // slow, offset floats
  const bobL = Math.sin(frame / 38) * 14;
  const bobR = Math.sin(frame / 33 + 1.2) * 16;

  return (
    <AbsoluteFill>
      <Screen src="anticheat-edit/assets/shot-index-general.png" side="left" enter={enterL} bob={bobL} />
      <Screen src="anticheat-edit/assets/shot-perps-symmio.png" side="right" enter={enterR} bob={bobR} />
    </AbsoluteFill>
  );
};
