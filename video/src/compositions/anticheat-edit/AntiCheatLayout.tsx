// AntiCheatLayout — the side-panel rig for the AntiCheat edit.
//
// Modeled on tutorial/TalkingHeadLayout: the talking head is a rectangle that
// spring-animates between layouts. When a panel event is active the camera
// shifts to one side (left-medium / right-medium) and the schematic / article
// fills the freed CONTENT AREA — never fullscreen, never on top of the head.
// When nothing is active the camera returns to full frame and breathes with a
// slow, beat-snapped push / pan so the talk is never static.
//
// The schematics and articles are authored full-bleed (1920×1080) with their
// own backgrounds. The rig renders each at native size inside a clipped box
// and transform-scales it to the panel, so the original design is preserved —
// just shrunk into the side.

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PixelReveal } from "./props";
import { activePanel, type PanelEvent, type PanelSide } from "./panelEvents";
import { BEATS_PLAY_TIME } from "./beatgrid";
import { colors } from "../anticheat/theme";

const SRC_W = 1920;
const SRC_H = 1080;

// ── Geometry — Tutorial rects, tuned for a 16:9 video head ───────────────────

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MARGIN = 64;
const GAP = 40;

function buildRects(W: number, H: number) {
  const h = H - 2 * MARGIN;
  const medW = Math.round(W * 0.46); // ~883 at 1920 — head stays readable
  const cInset = Math.round(W * 0.0); // full frame when centered

  const webcam: Record<"centered" | "left-medium" | "right-medium", Rect> = {
    centered: { x: cInset, y: 0, w: W - 2 * cInset, h: H },
    "left-medium": { x: MARGIN, y: MARGIN, w: medW, h },
    "right-medium": { x: W - MARGIN - medW, y: MARGIN, w: medW, h },
  };

  const content: Record<PanelSide, Rect> = {
    // Webcam left → content on the right, and vice versa.
    left: { x: MARGIN + medW + GAP, y: MARGIN, w: W - MARGIN - medW - GAP - MARGIN, h },
    right: { x: MARGIN, y: MARGIN, w: W - MARGIN - medW - GAP - MARGIN, h },
  };

  return { webcam, content };
}

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

// ── Beat snapping — pull a target time to the nearest music beat ─────────────

function nearestBeat(sec: number): number {
  let best = sec;
  let bestD = Infinity;
  for (const b of BEATS_PLAY_TIME) {
    const d = Math.abs(b - sec);
    if (d < bestD) {
      bestD = d;
      best = b;
    } else if (b > sec && d > bestD) {
      break; // beats are sorted — past the minimum
    }
  }
  return best;
}

const TRANSITION = 20; // frames for the camera to slide between layouts

// ── Idle camera breath — slow push + pan during talk, snapped to beats ───────
//
// A handful of "moves" across the talk, each anchored to a music beat and held
// for a stretch. Between moves the camera eases from one resting pose to the
// next. Poses are tiny — scale 1.0–1.08, pan a few % — so it reads as a steady
// hand, not a jitter. The intro (first 60s) gets a touch more travel.

export type Pose = { scale: number; px: number; py: number };

// Deterministic pseudo-pose from a seed, kept inside tasteful bounds.
function poseFor(i: number, intro: boolean): Pose {
  const r = (n: number) => {
    const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const scaleRange = intro ? 0.08 : 0.055;
  const panRange = intro ? 0.045 : 0.03;
  return {
    scale: 1.0 + r(1) * scaleRange,
    px: (r(2) - 0.5) * 2 * panRange,
    py: (r(3) - 0.5) * 2 * panRange * 0.6,
  };
}

// Anchor times (sec) where the idle camera re-poses. Snapped to beats. A move
// roughly every ~8–10s keeps it alive without being busy; denser early.
const IDLE_ANCHORS: number[] = (() => {
  const out: number[] = [];
  let t = 4;
  while (t < 640) {
    out.push(nearestBeat(t));
    t += t < 60 ? 7 : 9.5;
  }
  return out;
})();

// Exported so the intro-hero person cutout can ride the exact same breath as
// the base head it sits over — any mismatch ghosts the silhouette.
export function idleCamera(sec: number, fps: number): Pose {
  // Find the bracketing anchors and ease between their poses.
  let i = 0;
  while (i < IDLE_ANCHORS.length - 1 && IDLE_ANCHORS[i + 1] <= sec) i++;
  const a = IDLE_ANCHORS[i];
  const b = IDLE_ANCHORS[Math.min(i + 1, IDLE_ANCHORS.length - 1)] || a + 9;
  const intro = sec < 60;
  const pa = poseFor(i, intro);
  const pb = poseFor(i + 1, sec + 9 < 60);
  // Spring-eased crossfade over ~1.4s after each anchor; hold the rest.
  const eased = spring({
    frame: (sec - a) * fps,
    fps,
    config: { damping: 200 },
    durationInFrames: Math.round(1.4 * fps),
  });
  const t = b > a ? Math.min(1, eased) : 0;
  return {
    scale: pa.scale + (pb.scale - pa.scale) * t,
    px: pa.px + (pb.px - pa.px) * t,
    py: pa.py + (pb.py - pa.py) * t,
  };
}

// ── The scaled panel — a full-bleed node shrunk into the content area ────────

const ScaledPanel: React.FC<{ event: PanelEvent; area: Rect; framesIn: number }> = ({
  event,
  area,
  framesIn,
}) => {
  // Contain the 1920×1080 source inside the panel, then center it.
  const scale = Math.min(area.w / SRC_W, area.h / SRC_H);
  const dispW = SRC_W * scale;
  const dispH = SRC_H * scale;
  const offX = area.x + (area.w - dispW) / 2;
  const offY = area.y + (area.h - dispH) / 2;

  const ENTER = 10;
  const opacity = interpolate(framesIn, [0, ENTER], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Slide in from the panel's outer edge as it settles.
  const slide =
    event.side === "left"
      ? interpolate(framesIn, [0, ENTER + 4], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(framesIn, [0, ENTER + 4], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const inner = (
    <div
      style={{
        position: "absolute",
        left: offX,
        top: offY,
        width: dispW,
        height: dispH,
        borderRadius: 22 * Math.min(1, scale * 1.6),
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(2,14,43,0.45)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Render the source at its native size, scaled to fit the box. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SRC_W,
          height: SRC_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {event.render}
      </div>
    </div>
  );

  return (
    <div style={{ opacity, transform: `translateX(${slide}px)` }}>
      {event.pixel ? (
        // The chunky pixel front IS the entrance — clip it to the panel box so
        // the dissolve happens inside the side, not across the whole frame.
        <div
          style={{
            position: "absolute",
            left: offX,
            top: offY,
            width: dispW,
            height: dispH,
            borderRadius: 22 * Math.min(1, scale * 1.6),
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(2,14,43,0.45)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: SRC_W,
              height: SRC_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <PixelReveal mode="in" from="down-left" startFrame={0} durationInFrames={22} cellSize={56}>
              {event.render}
            </PixelReveal>
          </div>
        </div>
      ) : (
        inner
      )}
    </div>
  );
};

// ── Blue dot field — the inverted end-card background ────────────────────────
//
// Whenever the webcam zooms out into a panel, the head and the page sit on the
// same field the film closes on: Base blue (#0052FF) under a faint white dot
// grid. Same texture vocabulary as the end card's resting state (spacing 14,
// radius 1.6, white at 0.18), drawn here as a tiled CSS gradient so it costs
// nothing across the full talk instead of ~10k SVG circles per frame.

const BlueDotField: React.FC<{ opacity: number }> = ({ opacity }) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundColor: colors.accent,
      backgroundImage:
        "radial-gradient(circle, rgba(255,255,255,0.18) 1.6px, transparent 2.2px)",
      backgroundSize: "14px 14px",
      pointerEvents: "none",
    }}
  />
);

// ── Main rig ─────────────────────────────────────────────────────────────────

export const AntiCheatLayout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const sec = frame / fps;

  const { webcam: RECTS, content: AREAS } = React.useMemo(() => buildRects(W, H), [W, H]);

  const panel = activePanel(sec);

  // Target layout: shift to the head side when a panel is up, else full frame.
  const targetLayout = panel
    ? panel.side === "left"
      ? "left-medium"
      : "right-medium"
    : "centered";

  // Spring the webcam rect from where it was a transition ago. We approximate
  // "previous layout" by sampling the panel state TRANSITION frames earlier.
  const prevSec = (frame - TRANSITION) / fps;
  const prevPanel = activePanel(prevSec);
  const prevLayout = prevPanel
    ? prevPanel.side === "left"
      ? "left-medium"
      : "right-medium"
    : "centered";

  // When did the current layout begin? Walk back to the boundary.
  const target = RECTS[targetLayout];
  let webcamRect = target;
  if (prevLayout !== targetLayout) {
    // Find the frame the panel became active/inactive, within the window.
    let boundaryFrame = frame;
    for (let f = frame; f >= frame - TRANSITION - 2 && f >= 0; f--) {
      const p = activePanel(f / fps);
      const lay = p ? (p.side === "left" ? "left-medium" : "right-medium") : "centered";
      if (lay !== targetLayout) {
        boundaryFrame = f + 1;
        break;
      }
      boundaryFrame = f;
    }
    const framesIn = frame - boundaryFrame;
    if (framesIn < TRANSITION) {
      const from = RECTS[prevLayout];
      const t = spring({
        frame: framesIn,
        fps,
        config: { damping: 200 },
        durationInFrames: TRANSITION,
      });
      webcamRect = lerpRect(from, target, t);
    }
  }

  // Idle breath — only when full frame (don't fight the panel framing).
  const isFull = targetLayout === "centered";
  const cam = isFull ? idleCamera(sec, fps) : { scale: 1.0, px: 0, py: 0 };

  // Border radius eases up as the head shrinks into a panel.
  const br = interpolate(webcamRect.w, [RECTS["left-medium"].w, RECTS.centered.w], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // How far the camera has zoomed out — 0 at full frame, 1 once it has settled
  // into a panel. Drives the blue dot field in behind the head and the page.
  const bgReveal = interpolate(
    webcamRect.w,
    [RECTS.centered.w, RECTS["left-medium"].w],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Frames the panel has been active (for its entrance).
  let panelFramesIn = 0;
  if (panel) {
    panelFramesIn = frame - Math.round(panel.at * fps);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#020E2B" }}>
      {/* The inverted end-card field, revealed as the camera zooms out. */}
      <BlueDotField opacity={bgReveal} />

      {/* The talking head — spring-animated rectangle, idle-breathing inner. */}
      <div
        style={{
          position: "absolute",
          left: webcamRect.x,
          top: webcamRect.y,
          width: webcamRect.w,
          height: webcamRect.h,
          borderRadius: br,
          overflow: "hidden",
          boxShadow: isFull ? "none" : "0 24px 80px rgba(2,14,43,0.55)",
          border: isFull ? "none" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <OffthreadVideo
          src={staticFile("anticheat-edit/final.mp4")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${cam.scale}) translate(${cam.px * 100}%, ${cam.py * 100}%)`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* The schematic / article, scaled into the freed content area. */}
      {panel && (
        <ScaledPanel
          event={panel}
          area={AREAS[panel.side]}
          framesIn={panelFramesIn}
        />
      )}
    </AbsoluteFill>
  );
};
