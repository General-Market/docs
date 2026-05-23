// Faithful port of the original CSS-3D Kipling cube. A boy photo sits on a
// background, a hue-rotating overlay floats on top, and a CSS cube whose
// interior walls scroll Kipling's *If—* (public domain, 1910) is mirrored
// below as a soft reflection. The original loop is 200s; the scene is 10s,
// so animations are driven from frame fraction and the text scroll covers
// the first 5% of the original travel.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

const BACKGROUND_IMAGE =
  "https://drive.google.com/thumbnail?id=1_ZMV_LcmUXLsRokuz6WXGyN9zVCGfAHp&sz=w1920";
const BOY_IMAGE =
  "https://drive.google.com/thumbnail?id=1eGqJskQQgBJ67myGekmo4YfIVI3lfDTm&sz=w1920";

const RED = "red";

// Kipling, *If—* (1910, public domain). Highlighted words match the original
// CSS demo. Repeated four times so the long faces stream uninterrupted.
const POEM_TEXT = (
  <>
    If you can <span style={{ color: RED }}>keep</span> your head when all about
    you are <span style={{ color: RED }}>losing</span> theirs and{" "}
    <span style={{ color: RED }}>blaming</span> it on you, If you can{" "}
    <span style={{ color: RED }}>trust</span> yourself when all men{" "}
    <span style={{ color: RED }}>doubt</span> you, but make{" "}
    <span style={{ color: RED }}>allowance</span> for their doubting too; If you
    can <span style={{ color: RED }}>wait</span> and not be tired by waiting, Or
    being <span style={{ color: RED }}>lied</span> about, don't deal in{" "}
    <span style={{ color: RED }}>lies</span>, Or being{" "}
    <span style={{ color: RED }}>hated</span>, don't give way to{" "}
    <span style={{ color: RED }}>hating</span>, And yet don't look too good, nor
    talk too wise: If you can <span style={{ color: RED }}>dream</span>—and not
    make dreams your <span style={{ color: RED }}>master</span>; If you can{" "}
    <span style={{ color: RED }}>think</span>—and not make thoughts your{" "}
    <span style={{ color: RED }}>aim</span>; If you can meet with{" "}
    <span style={{ color: RED }}>triumph</span> and{" "}
    <span style={{ color: RED }}>disaster</span> And treat those two{" "}
    <span style={{ color: RED }}>impostors</span> just the same; If you can bear
    to hear the <span style={{ color: RED }}>truth</span> you've spoken{" "}
    <span style={{ color: RED }}>Twisted</span> by knaves to make a{" "}
    <span style={{ color: RED }}>trap</span> for fools, Or watch the things you
    gave your life to, <span style={{ color: RED }}>broken</span>, And{" "}
    <span style={{ color: RED }}>stoop</span> and build 'em up with worn-out
    tools: If you can make one <span style={{ color: RED }}>heap</span> of all
    your <span style={{ color: RED }}>winnings</span> And{" "}
    <span style={{ color: RED }}>risk</span> it on one turn of pitch-and-toss,
    And <span style={{ color: RED }}>lose</span>, and start again at your
    beginnings And never breathe a word about your{" "}
    <span style={{ color: RED }}>loss</span>; If you can{" "}
    <span style={{ color: RED }}>force</span> your heart and nerve and{" "}
    <span style={{ color: RED }}>sinew</span> To{" "}
    <span style={{ color: RED }}>serve</span> your turn long after they are
    gone, And so <span style={{ color: RED }}>hold on</span> when there is
    nothing in you Except the <span style={{ color: RED }}>Will</span> which
    says to them: 'Hold on!' If you can{" "}
    <span style={{ color: RED }}>talk</span> with crowds and keep your{" "}
    <span style={{ color: RED }}>virtue</span>, Or{" "}
    <span style={{ color: RED }}>walk</span> with Kings—nor lose the common{" "}
    <span style={{ color: RED }}>touch</span>, If neither{" "}
    <span style={{ color: RED }}>foes</span> nor loving friends can hurt you,
    If all men <span style={{ color: RED }}>count</span> with you, but none too
    much; If you can fill the unforgiving{" "}
    <span style={{ color: RED }}>minute</span> With sixty seconds' worth of
    distance <span style={{ color: RED }}>run</span>, Yours is the{" "}
    <span style={{ color: RED }}>Earth</span> and everything that's in it, And—
    which is more—you'll be a <span style={{ color: RED }}>Man</span>, my son!
    &nbsp;&nbsp;&nbsp;
  </>
);

const POEM_REPEATED = (
  <>
    {POEM_TEXT}
    {POEM_TEXT}
    {POEM_TEXT}
    {POEM_TEXT}
  </>
);

type CubeProps = {
  leftMargin: number;
  backMargin: number;
  rightMargin: number;
  reflection?: boolean;
};

const FACE_W = 870;
const FACE_H = 190;
const TB_SIZE = 870;

const faceBase: React.CSSProperties = {
  width: FACE_W,
  height: FACE_H,
  position: "absolute",
  background: "transparent",
  opacity: 0.5,
  overflow: "hidden",
};

const tbBase: React.CSSProperties = {
  ...faceBase,
  width: TB_SIZE,
  height: TB_SIZE,
};

const pBase: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontFamily: '"Bebas Neue", "Oswald", "Arial Narrow", sans-serif',
  fontWeight: 400,
  fontSize: "calc(6em + 19px * 0.7)",
  paddingTop: 20,
  color: "white",
  margin: 0,
};

const Cube: React.FC<CubeProps> = ({
  leftMargin,
  backMargin,
  rightMargin,
  reflection = false,
}) => {
  // Reflection mirrors vertically and uses a different perspective origin.
  const perspectiveOrigin = reflection ? "51% -30%" : "51% 70%";

  const back: React.CSSProperties = {
    ...faceBase,
    transform: reflection
      ? "translateZ(-435px) rotateY(180deg) scaleX(-1) scaleY(-1)"
      : "translateZ(-435px) rotateY(180deg) scaleX(-1)",
  };
  const left: React.CSSProperties = {
    ...faceBase,
    transform: reflection
      ? "translateX(-435px) rotateY(-90deg) scaleX(-1) scaleY(-1)"
      : "translateX(-435px) rotateY(-90deg) scaleX(-1)",
  };
  const right: React.CSSProperties = {
    ...faceBase,
    transform: reflection
      ? "translateX(435px) rotateY(90deg) scaleX(-1) scaleY(-1)"
      : "translateX(435px) rotateY(90deg) scaleX(-1)",
  };
  const top: React.CSSProperties = {
    ...tbBase,
    transform: "translateY(-435px) rotateX(90deg) scaleY(-1)",
  };
  const bottom: React.CSSProperties = {
    ...tbBase,
    transform: "translateY(-245px) rotateX(-90deg) scaleY(-1)",
  };

  const pTransform = reflection ? "scaleY(0.7)" : undefined;

  return (
    <div
      style={{
        width: FACE_W,
        height: FACE_H,
        position: "relative",
        transformStyle: "preserve-3d",
        perspective: 480,
        perspectiveOrigin,
      }}
    >
      <div style={top} />
      <div style={bottom} />
      <div style={left}>
        <p
          style={{
            ...pBase,
            marginLeft: leftMargin,
            transform: pTransform,
            transformOrigin: "left top",
          }}
        >
          {POEM_REPEATED}
        </p>
      </div>
      <div style={right}>
        <p
          style={{
            ...pBase,
            marginLeft: rightMargin,
            transform: pTransform,
            transformOrigin: "left top",
          }}
        >
          {POEM_REPEATED}
        </p>
      </div>
      <div style={back}>
        <p
          style={{
            ...pBase,
            marginLeft: backMargin,
            transform: pTransform,
            transformOrigin: "left top",
          }}
        >
          {POEM_REPEATED}
        </p>
      </div>
    </div>
  );
};

export const KiplingCube: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const t = frame / durationInFrames; // 0..1
  const seconds = frame / fps;

  // 200s loop compressed to 10s: text travels 5% of the original range.
  const leftMargin = interpolate(t, [0, 1], [480, -2244]);
  const backMargin = interpolate(t, [0, 1], [-390, -3114]);
  const rightMargin = interpolate(t, [0, 1], [-1260, -3984]);

  // Zoom 1 -> 2.5
  const scale = 1 + 1.5 * t;
  // Boy blur 0 -> 3px
  const boyBlur = 3 * t;
  // Plate brightness/contrast drift
  const brightness = 1 - 0.2 * t;
  const contrast = 1 + 0.3 * t;
  // Hue overlay pulses on an 8s cycle (matches original CSS hue-rotate keyframes)
  const hue = 100 * Math.sin((seconds * Math.PI) / 4);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(10deg, #ccc, #f5f5f5)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* The .content frame: 1000x562, rounded, with the slow filter drift */}
      <div
        style={{
          width: 1000,
          height: 562,
          position: "relative",
          borderRadius: 40,
          overflow: "hidden",
          filter: `brightness(${brightness}) contrast(${contrast})`,
        }}
      >
        {/* .container-full: holds the zoom-in transform */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: 1000,
            height: 562,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* Hue overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 3,
              width: "100%",
              height: "100%",
              mixBlendMode: "overlay",
              background:
                "radial-gradient(ellipse at center, #1e5799 0%, #7db9e8 100%)",
              filter: `hue-rotate(${hue}deg)`,
              pointerEvents: "none",
            }}
          />

          {/* Background plate */}
          <img
            src={BACKGROUND_IMAGE}
            alt=""
            style={{
              position: "absolute",
              width: 1000,
              top: 0,
              left: 0,
            }}
          />

          {/* Boy in front */}
          <img
            src={BOY_IMAGE}
            alt=""
            style={{
              position: "absolute",
              width: 1000,
              top: 0,
              left: 0,
              zIndex: 2,
              filter: `blur(${boyBlur}px)`,
            }}
          />

          {/* Main cube */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
            }}
          >
            <Cube
              leftMargin={leftMargin}
              backMargin={backMargin}
              rightMargin={rightMargin}
            />
          </div>

          {/* Reflected cube — mirrored and blurred */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 380,
              filter: "blur(10px)",
              zIndex: 4,
            }}
          >
            <Cube
              leftMargin={leftMargin}
              backMargin={backMargin}
              rightMargin={rightMargin}
              reflection
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
