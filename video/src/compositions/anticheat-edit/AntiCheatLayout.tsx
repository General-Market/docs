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
//
// Each panel's content is mounted inside its own <Sequence from={at}>, so the
// node's useCurrentFrame() is LOCAL (0 at the panel's start). That is what lets
// the pixel-dissolve, the title reveal, and the article's fade/pan fire — and,
// crucially, what stops the article fade-OUT from clamping a late global frame
// to zero opacity (the bug that left article panels blank).
//
// When a section TITLE hands off to its mechanism schematic on the same side,
// the camera does NOT return to centre and swing back; it holds the side and
// the CONTENT PANEL turns on a 3D carousel — a rotateX flip from the title face
// to the schematic face, like one segment of a horizontal drum.

import React from "react";
import {
  AbsoluteFill,
  Loop,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PixelReveal } from "./props";
import {
  activePanel,
  PANEL_EVENTS,
  type PanelEvent,
  type PanelSide,
} from "./panelEvents";
import { BEATS_PLAY_TIME } from "./beatgrid";
import { colors } from "../anticheat/theme";
import { RAIL_W, railPresence } from "./overlays/chapters";

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
  const medW = Math.round(W * 0.33); // ~634 at 1920 — head at a third, diagram takes the rest
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

// ── Panel scene — which panel is up, and whether it is mid-carousel ──────────
//
// The merged timeline (panelEvents.ts) drops a title, then its schematic, then
// charts — a mechanism's beats all share ONE side; the next mechanism flips. So
// a title and its first schematic are usually adjacent and same-side: instead
// of swinging the head back to centre in the gap between them, we HOLD the side
// and turn the content panel on a 3D carousel. A handoff is any two consecutive
// same-side events with a small enough gap; the turn fires at the second one's
// start and lasts TURN_SEC.

const BRIDGE_MAX_SEC = 1.3; // max title→schematic gap we bridge with a held camera
const TURN_SEC = 0.6; // length of the 3D carousel turn (18 frames @ 30)

type Handoff = { from: PanelEvent; to: PanelEvent; seam: number };

// Same-side, small-gap consecutive pairs — the carousel handoffs. Built once.
const HANDOFFS: Handoff[] = (() => {
  const out: Handoff[] = [];
  for (let i = 0; i < PANEL_EVENTS.length - 1; i++) {
    const from = PANEL_EVENTS[i];
    const to = PANEL_EVENTS[i + 1];
    if (from.side === to.side && to.at - (from.at + from.duration) <= BRIDGE_MAX_SEC) {
      out.push({ from, to, seam: to.at });
    }
  }
  return out;
})();

// The events that ARRIVE via a carousel turn — they must not also play their
// own fresh entrance (the rotation IS their entrance).
const CAROUSEL_TARGETS = new Set<PanelEvent>(HANDOFFS.map((h) => h.to));
const arrivesByTurn = (e: PanelEvent): boolean => CAROUSEL_TARGETS.has(e);

type Scene = {
  side: PanelSide | "center";
  /** content on the front face (the current / outgoing panel) */
  front: PanelEvent | null;
  /** content on the back face during a turn (the incoming panel) */
  back: PanelEvent | null;
  /** 0 = front flat, 1 = back flat */
  turn: number;
  /** play-second the turn pivots around (its seam) */
  seam: number;
  /** play-second the front face stays mounted until — past its own window
   *  while it is held over a bridge gap and through the turn. */
  frontEndSec: number;
};

const CENTER_SCENE: Scene = {
  side: "center",
  front: null,
  back: null,
  turn: 0,
  seam: 0,
  frontEndSec: 0,
};

function panelScene(sec: number): Scene {
  // A carousel turn — or the held-side bridge that leads into it — wins over
  // the plain active panel, so the camera never dips toward centre in the gap.
  for (const h of HANDOFFS) {
    // The outgoing face must outlive its own window across the bridge AND the
    // turn, or it pops to an empty panel in the gap before the schematic.
    const heldUntil = h.seam + TURN_SEC;
    if (sec >= h.seam && sec < h.seam + TURN_SEC) {
      return {
        side: h.to.side,
        front: h.from,
        back: h.to,
        turn: (sec - h.seam) / TURN_SEC,
        seam: h.seam,
        frontEndSec: heldUntil,
      };
    }
    // Bridge gap: the first panel has ended but the turn hasn't begun — hold it.
    if (sec >= h.from.at + h.from.duration && sec < h.seam) {
      return {
        side: h.from.side,
        front: h.from,
        back: null,
        turn: 0,
        seam: h.seam,
        frontEndSec: heldUntil,
      };
    }
  }
  const a = activePanel(sec);
  if (a) {
    return { side: a.side, front: a, back: null, turn: 0, seam: 0, frontEndSec: a.at + a.duration };
  }
  return CENTER_SCENE;
}

function sideAt(sec: number): PanelSide | "center" {
  return panelScene(sec).side;
}

function sideToLayout(
  side: PanelSide | "center",
): "centered" | "left-medium" | "right-medium" {
  if (side === "left") return "left-medium";
  if (side === "right") return "right-medium";
  return "centered";
}

// ── The panel box — a full-bleed node shrunk into the content area ───────────
//
// `area` is RELATIVE to the stage (which is positioned at the real content
// rect), so x/y are 0 here. The node's own entrance animates off the LOCAL
// frame (the caller wraps this in a Sequence). `entrance` is suppressed for the
// faces of a carousel — there the rotation is the entrance, so the content just
// shows its settled state.

const PanelBox: React.FC<{ event: PanelEvent; area: Rect; entrance: boolean }> = ({
  event,
  area,
  entrance,
}) => {
  const frame = useCurrentFrame();
  const sw = event.srcW ?? SRC_W;
  const sh = event.srcH ?? SRC_H;
  const scale = Math.min(area.w / sw, area.h / sh);
  const dispW = sw * scale;
  const dispH = sh * scale;
  const offX = area.x + (area.w - dispW) / 2;
  const offY = area.y + (area.h - dispH) / 2;

  const ENTER = 10;
  const opacity = entrance
    ? interpolate(frame, [0, ENTER], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  // Slide in from the panel's outer edge as it settles (fresh entrance only).
  const slide = !entrance
    ? 0
    : event.side === "left"
      ? interpolate(frame, [0, ENTER + 4], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(frame, [0, ENTER + 4], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // The source rendered at native size, scaled to fit the box.
  const scaledNode = (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: sw,
        height: sh,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {event.render}
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, opacity, transform: `translateX(${slide}px)` }}>
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
        {/* The chunky pixel front IS the fresh entrance for schematics; on a
            carousel face we skip it and let the turn do the reveal. */}
        {event.pixel && entrance ? (
          <PixelReveal mode="in" from="down-left" startFrame={0} durationInFrames={22} cellSize={56}>
            {scaledNode}
          </PixelReveal>
        ) : (
          scaledNode
        )}
      </div>
    </div>
  );
};

// One panel face, mounted in its own Sequence so its node sees a LOCAL frame.
// `endSec` lets a carousel's outgoing face outlive its own window through the
// turn; a normal panel just unmounts at its end.
const PanelFace: React.FC<{
  event: PanelEvent;
  area: Rect;
  entrance: boolean;
  endSec: number;
}> = ({ event, area, entrance, endSec }) => {
  const { fps } = useVideoConfig();
  const from = Math.round(event.at * fps);
  const dur = Math.max(1, Math.round(endSec * fps) - from);
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <PanelBox event={event} area={area} entrance={entrance} />
    </Sequence>
  );
};

// ── The stage — the content rect, holding either one panel or a turning pair ──

const PanelStage: React.FC<{ scene: Scene; areas: Record<PanelSide, Rect> }> = ({
  scene,
  areas,
}) => {
  const side = scene.side;
  if (side === "center" || !scene.front) return null;

  const area = areas[side];
  const relArea: Rect = { x: 0, y: 0, w: area.w, h: area.h };
  const stageBase: React.CSSProperties = {
    position: "absolute",
    left: area.x,
    top: area.y,
    width: area.w,
    height: area.h,
  };

  if (scene.back) {
    // 3D carousel: the panel turns about its horizontal axis (rotateX). The
    // back face is pre-rotated 180° so it lands face-on as the turn completes.
    const rot = -scene.turn * 180;
    return (
      <div style={{ ...stageBase, perspective: 1600 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `rotateX(${rot}deg)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <PanelFace event={scene.front} area={relArea} entrance={false} endSec={scene.frontEndSec} />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateX(180deg)",
            }}
          >
            <PanelFace
              event={scene.back}
              area={relArea}
              entrance={false}
              endSec={scene.back.at + scene.back.duration}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={stageBase}>
      <PanelFace
        event={scene.front}
        area={relArea}
        entrance={!arrivesByTurn(scene.front)}
        endSec={scene.frontEndSec}
      />
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

  // The chapter board claims the right edge while it is live; ease the whole
  // rig into the remaining left width by the same presence curve, so the head
  // and panels never sit behind it (and ease back to full frame at the turn).
  const EW = W - RAIL_W * railPresence(sec);
  const { webcam: RECTS, content: AREAS } = buildRects(EW, H);

  const scene = panelScene(sec);

  // Target layout: shift to the panel side (held across a same-side handoff),
  // else full frame. sideAt() keeps the side through a carousel bridge so the
  // camera never dips toward centre between a title and its schematic.
  const targetLayout = sideToLayout(scene.side);

  // Spring the webcam rect from where it was a transition ago.
  const prevSec = (frame - TRANSITION) / fps;
  const prevLayout = sideToLayout(sideAt(prevSec));

  const target = RECTS[targetLayout];
  let webcamRect = target;
  if (prevLayout !== targetLayout) {
    // Find the frame the layout changed, within the window.
    let boundaryFrame = frame;
    for (let f = frame; f >= frame - TRANSITION - 2 && f >= 0; f--) {
      const lay = sideToLayout(sideAt(f / fps));
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
    [RECTS["left-medium"].w, RECTS.centered.w],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
            // Keynote grade — richer, not washed out (per the look-dev pass).
            filter: "brightness(1.03) contrast(1.10) saturate(1.17)",
          }}
        />
        {/* Dynamic electric-blue light — drifting god-rays from the top-left,
            screen-blended so it only adds light. Clipped to the head, looped
            across the talk. Tune LIGHT presence with the opacity below. */}
        <AbsoluteFill
          style={{ mixBlendMode: "screen", opacity: 0.4, filter: "saturate(1.5) brightness(1.08)" }}
        >
          <Loop durationInFrames={360}>
            <OffthreadVideo
              src={staticFile("anticheat-edit/light_shafts.mp4")}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              muted
            />
          </Loop>
        </AbsoluteFill>
      </div>

      {/* The schematic / article, scaled into the freed content area — turning
          on a 3D carousel when a title hands off to its mechanism schematic. */}
      <PanelStage scene={scene} areas={AREAS} />
    </AbsoluteFill>
  );
};
