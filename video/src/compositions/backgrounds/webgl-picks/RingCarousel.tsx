// Source: CodePen "summer vibes" 3D image ring.
// The original spun a ring of six photos with a CSS @property --spin keyframe
// (45s linear) under a fixed tilt. Two things broke when it was first ported to
// 1920×1080: the tiles were oriented TANGENT to the ring (so the front ones
// showed edge-on as slivers) and the tilt was pushed so far that the ring lay
// down flat — the result was three stray tiles scattered over the title, no
// ring at all.
//
// This version rebuilds it as a clean carousel: six tiles sit on a circle and
// face OUTWARD (rotateY(i·60°) translateZ(R)), so the tile at the front turns
// its full face to the camera and the others curve away with honest depth. The
// whole ring tips forward a little and spins one full revolution across the 600
// frames. The "summer vibes" title sits flat on top, outside the 3D transform,
// so it stays legible while the images orbit behind it.
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

// Eight summer-toned gradient tiles (the original's six photos, plus two so the
// front arc reads as a continuous band rather than three stray cards).
const TILES: string[] = [
  "linear-gradient(135deg, #ff9a3c 0%, #ff5f6d 100%)",
  "linear-gradient(135deg, #ffd23f 0%, #ff8c42 100%)",
  "linear-gradient(135deg, #2ec4b6 0%, #1a936f 100%)",
  "linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)",
  "linear-gradient(135deg, #ee9ca7 0%, #c34a8e 100%)",
  "linear-gradient(135deg, #f7b733 0%, #fc4a1a 100%)",
  "linear-gradient(135deg, #f9d423 0%, #ff4e50 100%)",
  "linear-gradient(135deg, #43cea2 0%, #185a9d 100%)",
];

const TOTAL = TILES.length;
const SLIDE_DEG = 360 / TOTAL; // 45° between adjacent tiles

// Tile + ring geometry, scaled up from the original 100px box to read at 1080p.
const TILE_W = 300;
const TILE_H = Math.round((TILE_W * 9) / 16); // 16/9 → 169
// Radius chosen so eight tiles 45° apart overlap into a continuous curved band
// (touch radius for a 300px tile at 45° ≈ 360). Front tile sits at +RADIUS
// (toward camera), so ~4–5 tiles face the viewer at once and form a real ring.
const RING_RADIUS = 365;
// Perspective on the stationary wrapper (not the spinning ring) so the vanishing
// point stays put. ~1700 gives the front tile a gentle ~1.34× magnification.
const PERSPECTIVE = 1700;
const TILT = -15; // ring tips forward a touch

export const RingCarousel: React.FC = () => {
  const frame = useCurrentFrame();

  // frame → spin: one smooth full revolution over 600 frames, eased so it is
  // already turning on frame 1 and the loop seam (360° ≡ 0°) never stalls.
  const spin = interpolate(frame, [0, 600], [0, 360], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });

  // Gentle tilt breathing keeps the static frame alive.
  const tilt = TILT + Math.sin((frame / 600) * Math.PI * 2) * 3;

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
      {/* Stationary camera — perspective lives here so the vanishing point
          stays put while the ring spins inside it. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          perspective: PERSPECTIVE,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Ring — fixed tilt + frame-driven rotateY, centered on the origin. */}
        <div
          style={{
            position: "absolute",
            transformStyle: "preserve-3d",
            transform: `rotateX(${tilt}deg) rotateY(${spin}deg)`,
          }}
        >
          {TILES.map((bg, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: TILE_W,
                height: TILE_H,
                left: -TILE_W / 2,
                top: -TILE_H / 2,
                borderRadius: 16,
                background: bg,
                boxShadow:
                  "0 18px 50px rgba(0,0,0,0.28), inset 0 0 0 2px rgba(255,255,255,0.28)",
                // Place on the circle facing outward: turn to the tile's angle,
                // then push out along the (now-rotated) Z toward the camera.
                transform: `rotateY(${i * SLIDE_DEG}deg) translateZ(${RING_RADIUS}px)`,
                backfaceVisibility: "hidden",
              }}
            />
          ))}
        </div>
      </div>

      {/* Title "summer vibes" — flat on top, outside the 3D transform, so it
          stays crisp and legible while the images orbit behind it. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 132,
          color: "#ffcc33",
          WebkitTextStroke: "5px #fff",
          paintOrder: "stroke fill",
          filter: "drop-shadow(8px 8px 0px orange)",
          letterSpacing: 4,
          whiteSpace: "nowrap",
          lineHeight: 1,
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        summer vibes
      </div>
    </AbsoluteFill>
  );
};
