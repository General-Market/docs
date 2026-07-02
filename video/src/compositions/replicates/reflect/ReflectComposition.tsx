import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { measureText } from "@remotion/layout-utils";
import {
  Track,
  ejecting, before, spike, circle, dashA,
  funds, safe,
  you, always, need, backup, guaranteed, drive, boxL, boxR,
  ejseat,
  reflectWord, security, purple, lockup,
  beforeSweep, fundsSweep, safeSweep, birdMeta,
} from "./data";

export const FPS = 30;
export const DURATION = 658; // 21.93s — matches reference reflect-original.mp4

// ═══════════════════════════════════════════════════════════════
// All positions/curves below come from per-frame measurement of the
// reference (data.ts is auto-generated: element bounding boxes were
// tracked frame-by-frame, median-3 smoothed). Photographic content
// (jet footage, bird, hard drive, sky/ASCII plates, logo lockup) is
// composited from extracted reference rasters per the playbook.
// ═══════════════════════════════════════════════════════════════

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Helvetica Neue cap metrics, calibrated against rendered stills.
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
// Measured track boxes include ~2px of anti-aliasing; the ratios below
// are calibrated against rendered stills so the true cap lands inside.
const CAP_RATIO = 0.755; // (effective) cap-height / fontSize
const CAP_TOP = 0.135; // em-box top → cap top, fraction of fontSize

// Ink colors (darkest-2% means, measured)
const SKY_INK = "#3d4747";
const HDD_INK = "#333434";
const SEAT_INK = "#333334";

type Box = { x0: number; x1: number; y0: number; y1: number };

const sampleTrack = (t: Track, frame: number): Box => {
  const n = t.x0.length;
  const i = Math.min(Math.max(frame - t.f0, 0), n - 1);
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, n - 1);
  const w = i - lo;
  const pick = (a: number[]) => a[lo] + (a[hi] - a[lo]) * w;
  return { x0: pick(t.x0), x1: pick(t.x1), y0: pick(t.y0), y1: pick(t.y1) };
};

const trackVelX = (t: Track, frame: number): number =>
  sampleTrack(t, frame + 0.5).x0 - sampleTrack(t, frame - 0.5).x0;

const sweepAt = (sweep: [number, number][], frame: number): number =>
  interpolate(frame, sweep.map((s) => s[0]), sweep.map((s) => s[1]), clamp);

const birdByFrame = new Map(birdMeta.map((b) => [b.f, b]));

// ─── Caps word placed by measured ink bbox ───
// The span is pre-fitted (scaleX) so its ink is exactly nomW×nomH,
// then the whole box is transformed to the live measured bbox.
const CapsWord: React.FC<{
  text: string;
  track?: Track;
  box?: Box; // static alternative
  nomIdx?: number; // index into track arrays for the nominal box
  color: string;
  clip?: { x0: number; x1: number }; // screen-space reveal window
  blur?: number;
  tracking?: string;
  weight?: number;
  // "bbox": scale to the live bbox (measured scaling is real);
  // "center": fixed nominal size anchored at the live bbox center
  // (blur-inflated entrance bboxes must not stretch the glyphs).
  mode?: "bbox" | "center";
  anchor?: "left" | "right" | "center"; // horizontal anchor for center mode
}> = ({ text, track, box, nomIdx = 0, color, clip, blur = 0, tracking = "0.01em", weight = 400, mode = "bbox", anchor = "center" }) => {
  const frame = useCurrentFrame();
  const nom: Box = box ?? {
    x0: track!.x0[nomIdx], x1: track!.x1[nomIdx],
    y0: track!.y0[nomIdx], y1: track!.y1[nomIdx],
  };
  const live: Box = track ? sampleTrack(track, frame) : nom;
  const nomW = nom.x1 - nom.x0;
  const nomH = nom.y1 - nom.y0;
  const fontSize = nomH / CAP_RATIO;
  const natural = measureText({
    text, fontFamily: FONT, fontSize, fontWeight: String(weight), letterSpacing: tracking,
  }).width;
  const scaleX = natural > 0 ? nomW / natural : 1;
  const sx = mode === "bbox" ? (live.x1 - live.x0) / nomW : 1;
  const sy = mode === "bbox" ? (live.y1 - live.y0) / nomH : 1;
  const left =
    mode === "bbox"
      ? live.x0
      : anchor === "left"
        ? live.x0
        : anchor === "right"
          ? live.x1 - nomW
          : (live.x0 + live.x1) / 2 - nomW / 2;
  const top = mode === "bbox" ? live.y0 : (live.y0 + live.y1) / 2 - nomH / 2;

  const word = (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: nomW,
        height: nomH,
        transform: `scale(${sx}, ${sy})`,
        transformOrigin: "top left",
        filter: blur > 0.4 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: -CAP_TOP * fontSize,
          fontFamily: FONT,
          fontSize,
          fontWeight: weight,
          letterSpacing: tracking,
          color,
          whiteSpace: "nowrap",
          lineHeight: 1,
          transform: `scaleX(${scaleX})`,
          transformOrigin: "left",
        }}
      >
        {text}
      </span>
    </div>
  );

  if (!clip) return word;
  return (
    <div
      style={{
        position: "absolute",
        left: clip.x0,
        top: 0,
        width: Math.max(0, clip.x1 - clip.x0),
        height: 720,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: -clip.x0, top: 0, width: 1280, height: 720 }}>
        {word}
      </div>
    </div>
  );
};

// ─── 1. Live-action footage f0–267 (baked overlay incl.) ───
const Footage: React.FC = () => {
  const frame = useCurrentFrame();
  const f = Math.min(Math.max(Math.round(frame), 0), 267);
  return (
    <Img
      src={staticFile(`reflect-assets/footage/f${String(f).padStart(4, "0")}.jpg`)}
      style={{ position: "absolute", width: 1280, height: 720 }}
    />
  );
};

// ─── 2. Sky plates (bird patched out), slow zoom matching text drift ───
const Sky: React.FC = () => {
  const frame = useCurrentFrame();
  // scene A expands ~7% over f270-349, accelerating like the measured
  // text drift (EJECTING x0: 41% of travel done at 63% of the time)
  const zoomA = interpolate(frame, [268, 350], [1.0, 1.068], {
    ...clamp,
    easing: (t) => t * t * 0.62 + t * 0.38,
  });
  const zoomB = interpolate(frame, [350, 416], [1.0, 0.99], clamp);
  const scale = frame < 350 ? zoomA : zoomB;
  const bOpacity = interpolate(frame, [292, 349], [0, 1], clamp);
  const cOpacity = interpolate(frame, [355, 400], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <Img src={staticFile("reflect-assets/sky-a.png")} style={{ position: "absolute", width: 1280, height: 720 }} />
      <Img src={staticFile("reflect-assets/sky-b.png")} style={{ position: "absolute", width: 1280, height: 720, opacity: bOpacity }} />
      <Img src={staticFile("reflect-assets/sky-c.png")} style={{ position: "absolute", width: 1280, height: 720, opacity: cOpacity }} />
    </AbsoluteFill>
  );
};

// ─── Bird: per-frame reference sprites at measured positions ───
const Bird: React.FC = () => {
  const frame = useCurrentFrame();
  let b = birdByFrame.get(Math.round(frame));
  if (!b) {
    // nearest available sprite (rare 1-frame detection gaps)
    for (let d = 1; d < 5 && !b; d++) {
      b = birdByFrame.get(Math.round(frame) - d) ?? birdByFrame.get(Math.round(frame) + d);
    }
  }
  if (!b) return null;
  return (
    <Img
      src={staticFile(`reflect-assets/bird/b${String(b.f).padStart(4, "0")}.png`)}
      style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h }}
    />
  );
};

// ─── 3. Scene A: EJECTING BEFORE ○ — SPIKE. (f270–349) ───
const SceneA: React.FC = () => {
  const frame = useCurrentFrame();
  // circle ring: measured center/radius; draws itself f274–292
  const c = sampleTrack(circle, frame);
  const r = (c.x1 - c.x0 + (c.y1 - c.y0)) / 4;
  const ringDraw = interpolate(frame, [274, 292], [0, 1], {
    ...clamp,
    easing: (t) => 1 - (1 - t) * (1 - t),
  });
  const circumference = 2 * Math.PI * Math.max(r - 1, 1);
  // em-dash: measured bbox directly (wipes in f313+, drifts right)
  const d = sampleTrack(dashA, frame);
  return (
    <>
      {frame >= 270 && <CapsWord text="EJECTING" track={ejecting} color={SKY_INK} />}
      {frame >= 281 && (
        <CapsWord
          text="BEFORE"
          track={before}
          color={SKY_INK}
          clip={frame < 286 ? { x0: sweepAt(beforeSweep, frame), x1: 505 } : undefined}
        />
      )}
      {frame >= 285 && <CapsWord text="SPIKE." track={spike} color={SKY_INK} />}
      {frame >= 274 && (
        <svg
          width={Math.max(c.x1 - c.x0, 2)}
          height={Math.max(c.y1 - c.y0, 2)}
          style={{ position: "absolute", left: c.x0, top: c.y0 }}
        >
          <circle
            cx={(c.x1 - c.x0) / 2}
            cy={(c.y1 - c.y0) / 2}
            r={Math.max(r - 1, 1)}
            fill="none"
            stroke="#5f6a6b"
            strokeWidth={2.4}
            strokeDasharray={ringDraw < 1 ? circumference : undefined}
            strokeDashoffset={ringDraw < 1 ? circumference * (1 - ringDraw) : undefined}
            transform={`rotate(-90 ${(c.x1 - c.x0) / 2} ${(c.y1 - c.y0) / 2})`}
          />
        </svg>
      )}
      {frame >= 291 && (
        <div
          style={{
            position: "absolute",
            left: d.x0,
            top: d.y0,
            width: Math.max(d.x1 - d.x0, 1),
            height: Math.max(d.y1 - d.y0, 2),
            background: "#454f50",
            opacity: interpolate(frame, [291, 294], [0, 1], clamp),
          }}
        />
      )}
    </>
  );
};

// ─── 4. Scene B: FUNDS / SAFE. (f350–416) ───
const SceneB: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <CapsWord
        text="FUNDS"
        track={funds}
        color={SKY_INK}
        clip={frame < 358 ? { x0: sweepAt(fundsSweep, frame), x1: 322 } : undefined}
      />
      <CapsWord
        text="SAFE."
        track={safe}
        color={SKY_INK}
        clip={frame < 358 ? { x0: 993, x1: sweepAt(safeSweep, frame) } : undefined}
      />
    </>
  );
};

// ─── 5. Scene C: hard drive + YOU ALWAYS NEED GUARANTEED BACKUP. ───
// Dashed boxes (line centers measured on f490), group expands horizontally.
const BOXES = [
  { x0: 216, x1: 1078, y0: 255.5, y1: 292 },
  { x0: 402, x1: 934, y0: 303.5, y1: 340 },
  { x0: 198.5, x1: 389, y0: 350.5, y1: 507 },
  { x0: 631, x1: 1078, y0: 398.5, y1: 507.5 },
];
const BOXL_REST = 198;
const BOXR_REST = 1078;

const sampleV = (t: { f0: number; v: number[] }, frame: number): number => {
  const i = Math.min(Math.max(frame - t.f0, 0), t.v.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, t.v.length - 1);
  return t.v[lo] + (t.v[hi] - t.v[lo]) * (i - lo);
};

// GUARANTEED reveal window left edge (letter-appearance measurements)
const GUAR_EDGE: [number, number][] = [
  [417, 858], [419, 830], [421, 818], [423, 810], [428, 788], [432, 780],
  [436, 775], [440, 770], [445, 765], [450, 758], [455, 752], [460, 748],
];

const SceneC: React.FC = () => {
  const frame = useCurrentFrame();
  // sky remnant snaps away over ~4 frames (measured cloud decay f416: 39 → f420: 8 → f428: 4)
  const skyOut = interpolate(frame, [417, 421], [0.72, 0], clamp);
  // box group: horizontal affine from measured left/right edges
  const L = sampleV(boxL, frame);
  const R = sampleV(boxR, frame);
  const sx = (R - L) / (BOXR_REST - BOXL_REST);
  const off = L - BOXL_REST * sx;
  // drive: pure horizontal translation (measured; width constant)
  const dv = sampleTrack(drive, frame);
  const dx = dv.x0 - 402; // sprite captured at rest x0=402
  const dvel = Math.abs(trackVelX(drive, frame));
  // GUARANTEED: right/bottom-anchored, fixed size, window reveal
  const g = sampleTrack(guaranteed, frame);
  const gBox: Box = { x0: g.x1 - 320, x1: g.x1, y0: g.y1 - 36, y1: g.y1 };
  const gEdge = sweepAt(GUAR_EDGE, frame);
  return (
    <>
      <Img src={staticFile("reflect-assets/hdd-bg.png")} style={{ position: "absolute", width: 1280, height: 720 }} />
      <Img
        src={staticFile("reflect-assets/sky-c.png")}
        style={{ position: "absolute", width: 1280, height: 720, opacity: skyOut }}
      />
      {/* dashed boxes */}
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        {BOXES.map((b, i) => (
          <rect
            key={i}
            x={b.x0 * sx + off}
            y={b.y0}
            width={(b.x1 - b.x0) * sx}
            height={b.y1 - b.y0}
            fill="none"
            stroke="#b6c3c9"
            strokeWidth={2}
            strokeDasharray="10 6.5"
          />
        ))}
      </svg>
      {/* words behind the drive — fixed size, translate on measured edges */}
      <CapsWord text="YOU" track={you} mode="center" anchor="left" nomIdx={you.x0.length - 1} color={HDD_INK} blur={Math.min(Math.abs(trackVelX(you, frame)) * 0.25, 5)} />
      <CapsWord text="ALWAYS" track={always} mode="center" anchor="left" nomIdx={always.x0.length - 1} color={HDD_INK} blur={Math.min(Math.abs(trackVelX(always, frame)) * 0.25, 5)} />
      <CapsWord text="NEED" track={need} mode="center" anchor="right" nomIdx={need.x0.length - 1} color={HDD_INK} />
      <CapsWord
        text="GUARANTEED"
        box={gBox}
        color={HDD_INK}
        clip={frame < 462 ? { x0: gEdge, x1: 1200 } : undefined}
      />
      <CapsWord text="BACKUP." track={backup} mode="center" anchor="left" nomIdx={backup.x0.length - 1} color={HDD_INK} blur={Math.min(Math.abs(trackVelX(backup, frame)) * 0.25, 5)} />
      {/* drive sprite (raster from reference, captured at x0=390 y0=235) */}
      <Img
        src={staticFile("reflect-assets/drive.png")}
        style={{
          position: "absolute",
          left: 390 + dx,
          top: 235,
          width: 410,
          height: 245,
          filter: dvel > 3 ? `blur(${Math.min(dvel * 0.22, 4).toFixed(2)}px)` : undefined,
        }}
      />
    </>
  );
};

// ─── 6. Scene D: EJECTOR SEAT + teal bars over ASCII bg (f491–550) ───
const SEAT_NOM: Box = { x0: 471, x1: 815, y0: 337, y1: 374 }; // fully-revealed rest (f524)

const SceneD: React.FC = () => {
  const frame = useCurrentFrame();
  const revealed = frame >= 524;
  const e = sampleTrack(ejseat, frame);
  // left bar: constant width, translates right ~1.6px/f (measured)
  const lbRight = 553 + 1.62 * (frame - 491);
  // right bar: left edge drifts left ~1.85px/f; tail shrinks then holds
  const rbLeft = 756 - 1.85 * (frame - 491);
  const rbW = interpolate(frame, [491, 525], [390, 160], { ...clamp, easing: (t) => 1 - (1 - t) * (1 - t) });
  return (
    <>
      <Img src={staticFile("reflect-assets/ascii-bg.png")} style={{ position: "absolute", width: 1280, height: 720 }} />
      {/* left teal bar (gradient tail leftward) */}
      <div
        style={{
          position: "absolute",
          left: lbRight - 262,
          top: 360,
          width: 262,
          height: 34,
          background: "linear-gradient(90deg, rgba(147,202,217,0) 0%, rgba(160,209,222,0.55) 55%, rgba(147,202,217,0.95) 100%)",
        }}
      />
      {/* right teal bar (fainter, gradient tail rightward) */}
      <div
        style={{
          position: "absolute",
          left: rbLeft,
          top: 321,
          width: rbW,
          height: 32,
          background: "linear-gradient(90deg, rgba(186,222,229,0.8) 0%, rgba(200,229,235,0.4) 45%, rgba(210,234,240,0) 100%)",
        }}
      />
      <CapsWord
        text="EJECTOR SEAT"
        track={revealed ? ejseat : undefined}
        box={revealed ? undefined : SEAT_NOM}
        nomIdx={533 - ejseat.f0}
        color={SEAT_INK}
        clip={revealed ? undefined : { x0: e.x0 - 2, x1: e.x1 + 2 }}
      />
    </>
  );
};

// ─── 7. Scene E: Reflect //SECURITY → logo lockup (f551–657) ───
const SceneE: React.FC = () => {
  const frame = useCurrentFrame();
  const asciiOut = interpolate(frame, [560, 605], [1, 0], clamp);
  const w = sampleTrack(reflectWord, frame);
  const s = sampleTrack(security, frame);
  const p = sampleTrack(purple, frame);
  const lk = sampleTrack(lockup, frame);
  return (
    <>
      <Img src={staticFile("reflect-assets/clean-bg.png")} style={{ position: "absolute", width: 1280, height: 720 }} />
      <Img
        src={staticFile("reflect-assets/ascii-bg.png")}
        style={{ position: "absolute", width: 1280, height: 720, opacity: asciiOut }}
      />
      {frame < 589 ? (
        <>
          {/* purple bar behind //SECURITY — expands from center (measured bbox) */}
          {frame >= 552 && (
            <div
              style={{
                position: "absolute",
                left: p.x0,
                top: p.y0,
                width: Math.max(p.x1 - p.x0, 1),
                height: Math.max(p.y1 - p.y0, 1),
                background: "linear-gradient(90deg, rgba(225,228,254,0.15) 0%, rgba(188,172,247,0.75) 55%, rgba(167,136,251,1) 100%)",
              }}
            />
          )}
          {/* big Reflect wordmark raster (ink at x0=487 y0=328 in capture) */}
          <Img
            src={staticFile("reflect-assets/reflect-word-big.png")}
            style={{ position: "absolute", left: w.x0 - 4, top: w.y0 - 4, width: 271, height: 74 }}
          />
          {/* //SECURITY raster (from f551; ink at x0=463 y0=393 in capture) */}
          <Img
            src={staticFile("reflect-assets/security-text.png")}
            style={{ position: "absolute", left: s.x0 - 5, top: s.y0 - 4, width: 194, height: 35 }}
          />
        </>
      ) : (
        // final lockup raster (mark ink at x0=502 y0=318 in capture); it
        // settles downward AND squashes vertically 71→66px (measured)
        <Img
          src={staticFile("reflect-assets/reflect-lockup.png")}
          style={{
            position: "absolute",
            left: lk.x0 - 4,
            top: lk.y0 - 6 * ((lk.y1 - lk.y0) / 66),
            width: 282,
            height: 78 * ((lk.y1 - lk.y0) / 66),
          }}
        />
      )}
    </>
  );
};

// ─── Master ───
export const ReflectComposition: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff", overflow: "hidden" }}>
      {frame < 268 && <Footage />}
      {frame >= 268 && frame < 417 && (
        <>
          <Sky />
          {frame < 350 && <SceneA />}
          {frame >= 350 && <SceneB />}
          <Bird />
        </>
      )}
      {frame >= 417 && frame < 491 && <SceneC />}
      {frame >= 491 && frame < 551 && <SceneD />}
      {frame >= 551 && <SceneE />}
    </AbsoluteFill>
  );
};

export const reflectReplicateMeta = {
  id: "Reflect-Replicate",
  component: ReflectComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
