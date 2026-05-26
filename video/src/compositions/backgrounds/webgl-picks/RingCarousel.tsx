// Source: CodePen "summer vibes" 3D image ring.
// The original spun a ring of six Unsplash photos with a CSS @property
// --spin keyframe (45s linear infinite) while the parent held a fixed
// rotateX(-20deg) rotateZ(30deg) tilt. Here the wall-clock keyframe becomes
// a frame-driven angle: the ring completes one full revolution across the
// 600-frame scene, with a gentle ease so frame 1 already shows it mid-turn.
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

// Six tiles, replacing the six remote photos with summer-toned gradients.
const TILES: string[] = [
  "linear-gradient(135deg, #ff9a3c 0%, #ff5f6d 100%)",
  "linear-gradient(135deg, #ffd23f 0%, #ff8c42 100%)",
  "linear-gradient(135deg, #2ec4b6 0%, #1a936f 100%)",
  "linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)",
  "linear-gradient(135deg, #ee9ca7 0%, #c34a8e 100%)",
  "linear-gradient(135deg, #f7b733 0%, #fc4a1a 100%)",
];

const TOTAL = TILES.length;
const SLIDE_DEG = 360 / TOTAL;

// Ring geometry — scaled up from the original 100px box so it reads at 1080p.
const RING_W = 360; // original --width
const RING_H = (RING_W * 9) / 16; // aspect-ratio 16/9
const IMG_TRANSLATE_X = 1.2; // original --img-translate-x: 120%

// The original card translate distance is 120% of the ring width.
const TRANSLATE_X = RING_W * IMG_TRANSLATE_X;

export const RingCarousel: React.FC = () => {
  const frame = useCurrentFrame();

  // frame → spin angle: one smooth full revolution over 600 frames, eased
  // so it starts already moving and never visibly stalls at the loop seam.
  const spin = interpolate(frame, [0, 600], [0, 360], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });

  // Subtle breathing tilt so the static rotateX/rotateZ frame feels alive.
  const tilt = interpolate(
    frame,
    [0, 300, 600],
    [-22, -18, -22],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ececec",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Cherry Bomb One', system-ui, sans-serif",
      }}
    >
      {/* wrapper — preserve-3d so the title shares the ring's space */}
      <div
        style={{
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        {/* title "summer vibes" — golden fill, white stroke, orange drop */}
        <div
          style={{
            fontSize: 180,
            color: "#ffcc33",
            WebkitTextStroke: "5px #fff",
            paintOrder: "stroke fill",
            filter: "drop-shadow(8px 8px 0px orange)",
            letterSpacing: 4,
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          summer vibes
        </div>

        {/* ring — fixed tilt + frame-driven rotateY */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            width: RING_W,
            height: RING_H,
            transformStyle: "preserve-3d",
            transform: `rotateX(${tilt}deg) rotateZ(30deg) rotateY(${spin}deg)`,
          }}
        >
          {TILES.map((bg, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: 14,
                background: bg,
                boxShadow:
                  "0 10px 30px rgba(0,0,0,0.25), inset 0 0 0 2px rgba(255,255,255,0.25)",
                transform: `rotateY(${i * SLIDE_DEG}deg) translateX(${TRANSLATE_X}px) rotateY(90deg)`,
                backfaceVisibility: "hidden",
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
