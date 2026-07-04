// Frames 0-1704: title card → falls flat onto the floor board → 3D chart
// room with three continuous chart chapters, one camera-driven world.

import React, { useCallback } from "react";
import {
  AbsoluteFill,
} from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { COLORS, A, B, LEGEND_ROWS } from "../data/chartroom";
import { clamp01, easeOutPow, polyUpToArc } from "../lib/helpers";
import { CanvasPlane } from "../lib/world";
import { getTitleImg } from "../lib/assets";
import type { V3 } from "../lib/world";
import { drawSpread } from "./boards";
import * as M from "./chartroomModel";

const { fontFamily: BARLOW } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});


const setFont = (ctx: CanvasRenderingContext2D, cap: number, weight = 500) => {
  ctx.font = `${weight} ${cap / 0.72}px ${BARLOW}`;
};

const roundRect = (
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const popScale = (dt: number) => {
  if (dt < 0) return 0;
  if (dt < 7) return 1.15 * easeOutPow(dt / 7, 2);
  if (dt < 12) return 1.15 - 0.15 * ((dt - 7) / 5);
  return 1;
};

const strokePoly = (
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  mapX: (s: number) => number,
  mapY: (y: number) => number,
) => {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(mapX(pts[0][0]), mapY(pts[0][1]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(mapX(pts[i][0]), mapY(pts[i][1]));
  ctx.stroke();
};

// Generic floor spread plane.
const SpreadFloor: React.FC<{
  frame: number;
  fit: Parameters<typeof M.floorPlacement>[0];
  board: { s0: number; s1: number; w: number; depth: number; tFar: number; tNear: number };
  yF: number;
  draw: (ctx: CanvasRenderingContext2D, f: number, w: number, d: number) => void;
  res?: number;
}> = ({ frame, fit, board, yF, draw, res = 2 }) => {
  const { center, quat } = M.floorPlacement(fit, board, yF);
  return (
    <group position={center} quaternion={quat}>
      <CanvasPlane frame={frame} width={board.w} height={board.depth} res={res}
        position={[0, 0, 0]} rotation={[0, 0, 0]} draw={draw} renderOrder={0} />
    </group>
  );
};

// Depth-stretched year text on a spread: font sized by glyph width,
// vertically stretched to the measured floor depth.
const yearDrawer = (
  metrics: { width: number; depth: number },
) => (
  ctx: CanvasRenderingContext2D,
  years: [string, string, string],
  spreadW: number,
  alpha: number,
) => {
  if (alpha <= 0) return;
  const size = metrics.width / 2.2; // 4-glyph width → font px (Barlow adv ≈ 0.55em)
  const stretch = metrics.depth / (size * 0.72);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#848484";
  ctx.font = `600 ${size}px ${BARLOW}`;
  ctx.textBaseline = "top";
  ctx.scale(1, stretch);
  const yTop = 4 / stretch; // just under the far edge
  ctx.textAlign = "left";
  ctx.fillText(years[0], 2, yTop);
  ctx.textAlign = "center";
  ctx.fillText(years[1], spreadW * 0.54, yTop);
  ctx.textAlign = "right";
  ctx.fillText(years[2], spreadW - 2, yTop);
  ctx.restore();
};

// ═══════════ Chapter A wall ═══════════
const A_S_MIN = -110;
const A_S_MAX = 460;
const A_Y_MIN = M.yBaseA - 30;
const A_Y_MAX = 215;

const ChapterAWall: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number) => {
    const drift = M.wallDriftA(f);
    const mx = (s: number) => s - A_S_MIN + drift;
    const my = (y: number) => A_Y_MAX - y;
    const ink = M.wallInkA(f);
    if (ink <= 0) return;
    // 11 gridlines, fading out at the pan
    const gridFade = 1 - clamp01((f - 445) / 7);
    ctx.globalAlpha = ink * gridFade;
    ctx.strokeStyle = "#E4E4E4";
    ctx.lineWidth = 2;
    const top = M.wallGrowTopY(f);
    for (let i = 0; i <= 10; i++) {
      const s = i * M.fitA.spacing;
      ctx.beginPath();
      ctx.moveTo(mx(s), my(M.yBaseA));
      ctx.lineTo(mx(s), my(top));
      ctx.stroke();
    }
    ctx.strokeStyle = "#E6DEE0";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(mx(0), my(M.wallA.baselineY));
    ctx.lineTo(mx(M.wallA.baselineS[1]), my(M.wallA.baselineY));
    ctx.stroke();
    ctx.setLineDash([]);
    // red history line
    const histAlpha =
      1 - clamp01((f - A.historyFade[0]) / (A.historyFade[1] - A.historyFade[0]));
    if (histAlpha > 0) {
      ctx.globalAlpha = histAlpha;
      ctx.strokeStyle = "#C93842";
      ctx.lineWidth = 3.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      strokePoly(ctx, polyUpToArc(M.wallA.redPoly, M.wallA.redArc.cum, M.redProgressA(f)), mx, my);
    }
    // markers
    const mAlpha = 1 - clamp01((f - A.markerFade[0]) / (A.markerFade[1] - A.markerFade[0]));
    for (const m of M.wallA.markers) {
      const sc = popScale(f - m.pop);
      if (sc <= 0 || mAlpha <= 0) continue;
      ctx.globalAlpha = mAlpha;
      const w = m.w * sc;
      const h = m.h * sc;
      ctx.fillStyle = "#4BADC2";
      roundRect(ctx, mx(m.c[0]) - w / 2, my(m.c[1]) - h / 2, w, h, 3 * sc);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      setFont(ctx, 11 * sc, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(m.n), mx(m.c[0]), my(m.c[1]) + 0.5);
    }
    // Base rate label
    const lblA = clamp01((f - 125) / 8) *
      (1 - clamp01((f - A.historyFade[0]) / (A.historyFade[1] - A.historyFade[0])));
    if (lblA > 0) {
      ctx.globalAlpha = lblA;
      ctx.fillStyle = COLORS.labelRed;
      setFont(ctx, M.wallA.baseLabelCap, 600);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Base rate", mx(M.wallA.baseLabel[0]), my(M.wallA.baseLabel[1]));
    }
    ctx.globalAlpha = 1;
  }, []);
  const w = A_S_MAX - A_S_MIN;
  const h = A_Y_MAX - A_Y_MIN;
  const cs = A_S_MIN + w / 2;
  const cy = A_Y_MIN + h / 2;
  const pos: V3 = [
    M.fitA.origin[0] + M.fitA.dirS[0] * cs, cy, M.fitA.origin[2] + M.fitA.dirS[2] * cs,
  ];
  return (
    <CanvasPlane frame={frame} width={w} height={h} position={pos}
      rotation={[0, M.fitA.yawRad, 0]} draw={draw} renderOrder={2} />
  );
};

// ═══════════ Chapter B wall ═══════════
const B_S_MIN = -260;
const B_S_MAX = 11 * M.fitB.spacing + 60;
const B_Y_MIN = M.yBaseB - 20;
const B_Y_MAX = 200;

const ChapterBWall: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number) => {
    const mx = (s: number) => s - B_S_MIN;
    const my = (y: number) => B_Y_MAX - y;
    const enter = clamp01((f - 452) / 16); // wall fades in after the pan
    ctx.globalAlpha = enter;
    ctx.strokeStyle = COLORS.gridline;
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 10; i++) {
      const s = i * M.fitB.spacing;
      ctx.beginPath();
      ctx.moveTo(mx(s), my(M.yBaseB));
      ctx.lineTo(mx(s), my(M.yTopB));
      ctx.stroke();
    }
    ctx.strokeStyle = "#E6DEE0";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(mx(M.wallB.baselineS[0]), my(M.wallB.baselineY));
    ctx.lineTo(mx(M.wallB.baselineS[1]), my(M.wallB.baselineY));
    ctx.stroke();
    ctx.setLineDash([]);
    const ink = M.wallInkFadeB(f) * enter;
    if (ink <= 0) {
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = ink;
    // solid red stub (fades slightly before the chapter fade)
    const stubAlpha = 1 - clamp01((f - 875) / 25);
    if (stubAlpha > 0) {
      ctx.globalAlpha = ink * stubAlpha;
      ctx.strokeStyle = "#C43038";
      ctx.lineWidth = 4.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      strokePoly(ctx, M.wallB.solidPoly, mx, my);
      ctx.globalAlpha = ink;
    }
    // dashes
    const k = M.dashCountB(f);
    ctx.strokeStyle = "#C13840";
    ctx.lineWidth = 4;
    ctx.lineCap = "butt";
    for (let i = 0; i < k; i++) {
      const d = M.wallB.dashes[i];
      const nxt = M.wallB.dashes[Math.min(i + 1, M.wallB.dashes.length - 1)];
      const prv = M.wallB.dashes[Math.max(i - 1, 0)];
      const tx = nxt[0] - prv[0];
      const ty = nxt[1] - prv[1];
      const len = Math.hypot(tx, ty) || 1;
      const ux = (tx / len) * 4.5;
      const uy = (ty / len) * 4.5;
      ctx.beginPath();
      ctx.moveTo(mx(d[0] - ux), my(d[1] - uy));
      ctx.lineTo(mx(d[0] + ux), my(d[1] + uy));
      ctx.stroke();
    }
    // grey fixed line
    const ext = M.greyExtentB(f);
    if (ext) {
      ctx.strokeStyle = "#828282";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(mx(ext[0]), my(M.wallB.greyY));
      ctx.lineTo(mx(ext[1]), my(M.wallB.greyY));
      ctx.stroke();
    }
    // labels: moved to the DOM overlay (round 3) — the reference keeps
    // "Fixed rate"/"Base rate" screen-large while the wall zooms, so
    // wall-locking them shrank and misplaced them (crop SSIM 0.70).
    // LabelsOverlay owns them for all of chapter B now.
    ctx.globalAlpha = 1;
  }, []);
  const w = B_S_MAX - B_S_MIN;
  const h = B_Y_MAX - B_Y_MIN;
  const cs = B_S_MIN + w / 2;
  const cy = B_Y_MIN + h / 2;
  const pos: V3 = [
    M.fitB.origin[0] + M.fitB.dirS[0] * cs, cy, M.fitB.origin[2] + M.fitB.dirS[2] * cs,
  ];
  return (
    <CanvasPlane frame={frame} width={w} height={h} position={pos}
      rotation={[0, M.fitB.yawRad, 0]} draw={draw} renderOrder={2} />
  );
};
// ═══════════ Chapter C wall ═══════════
const C_S_MIN = -160;
const C_S_MAX = 11 * M.fitC.spacing + 100;
const C_Y_MIN = M.yBaseC - 20;
const C_Y_MAX = 180;

const ChapterCWall: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number) => {
    const mx = (s: number) => s - C_S_MIN;
    const my = (y: number) => C_Y_MAX - y;
    // gridlines; from 1662 they topple right→left. Canvas +x runs along
    // dirS (increasing gridline index → screen-right), so ctx.rotate(+θ)
    // about the base in y-down canvas coords tips the top screen-right.
    ctx.strokeStyle = COLORS.gridline;
    ctx.lineWidth = 2.5;
    const yB = my(M.yBaseC);
    const yT = my(M.yTopC);
    for (let i = 0; i <= 10; i++) {
      const { angle, alpha } = M.toppleC(f, i);
      if (alpha <= 0) continue;
      const x = mx(i * M.fitC.spacing);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (angle > 0) {
        ctx.translate(x, yB);
        ctx.rotate(angle);
        ctx.translate(-x, -yB);
      }
      ctx.beginPath();
      ctx.moveTo(x, yB);
      ctx.lineTo(x, yT);
      ctx.stroke();
      ctx.restore();
    }
    // dashed skirting, fading out under the topple
    const blAlpha = M.baselineFadeC(f);
    if (blAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = blAlpha;
      ctx.strokeStyle = "#E6DEE0";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(mx(-20), my(M.wallC.baselineY));
      ctx.lineTo(mx(10 * M.fitC.spacing + 30), my(M.wallC.baselineY));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // jagged grey historical line (square corners), erasing left→right
    const jag = M.polySliceArc(
      M.wallC.jaggedPoly, M.jaggedArcC.cum, M.jaggedEraseC(f), M.jaggedProgressC(f),
    );
    if (jag.length >= 2) {
      ctx.strokeStyle = "#828282";
      ctx.lineWidth = 3.5;
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      strokePoly(ctx, jag, mx, my);
    }
    // red S-curve, erasing left→right (upper arc goes last)
    const red = M.polySliceArc(
      M.wallC.redPoly, M.redArcC.cum, M.redEraseC(f), M.redProgressC(f),
    );
    if (red.length >= 2) {
      ctx.strokeStyle = "#E02B2E";
      ctx.lineWidth = 4.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      strokePoly(ctx, red, mx, my);
    }
  }, []);
  const w = C_S_MAX - C_S_MIN;
  const h = C_Y_MAX - C_Y_MIN;
  const cs = C_S_MIN + w / 2;
  const cy = C_Y_MIN + h / 2;
  const pos: V3 = [
    M.fitC.origin[0] + M.fitC.dirS[0] * cs, cy, M.fitC.origin[2] + M.fitC.dirS[2] * cs,
  ];
  return (
    <CanvasPlane frame={frame} width={w} height={h} position={pos}
      rotation={[0, M.fitC.yawRad, 0]} draw={draw} renderOrder={2} />
  );
};

// ═══════════ Title page (absolute scale, outside the room group) ═══════════
// Canvas 650 wide: page 20..630, left stack sliver 8..20, right dark
// band 632..648 (the card stack edges seen at f0).
const TitlePage: React.FC<{ frame: number; img: HTMLImageElement | null }> = ({ frame, img }) => {
  const { pos, quat } = M.titlePose(frame);
  const pageH = M.PAGE_H_ABS;
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number) => {
    const fade = M.pageFade(f);
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    // stack edges
    ctx.fillStyle = "#E7E7E7";
    ctx.fillRect(8, 0, 12, pageH);
    ctx.fillStyle = "#DDDDDD";
    ctx.fillRect(2, 0, 6, pageH);
    const g = ctx.createLinearGradient(632, 0, 648, 0);
    g.addColorStop(0, "#7B8081");
    g.addColorStop(0.5, "#979799");
    g.addColorStop(1, "#C8C8C8");
    ctx.fillStyle = g;
    ctx.fillRect(632, 0, 16, pageH);
    // white page
    ctx.fillStyle = "#FCFCFB";
    ctx.fillRect(20, 0, 610, pageH);
    // teal title panel (vertical gradient) + inner photo, fading f71-78
    const a = M.tealFade(f);
    if (a > 0) {
      ctx.globalAlpha = fade * a;
      const tg = ctx.createLinearGradient(0, 0, 0, pageH);
      tg.addColorStop(0, "#199ABD");
      tg.addColorStop(0.65, "#1F86A8");
      tg.addColorStop(1, "#1C7896");
      ctx.fillStyle = tg;
      ctx.fillRect(28, 8, 594, pageH - 16);
      if (img) {
        ctx.drawImage(img, 59, 130, 513.3, 276);
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(59, 130, 513.3, 276);
      }
    }
    ctx.globalAlpha = 1;
  }, [img, pageH]);
  return (
    <group position={pos} quaternion={quat}>
      <CanvasPlane frame={frame} width={650} height={pageH} res={1.4}
        position={M.meshOffset} rotation={[0, 0, 0]} draw={draw} renderOrder={1} />
    </group>
  );
};

// ═══════════ Legend overlay (screen-space, chapter A) ═══════════
const LegendOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 120 || frame > A.legendExit[1] + 2) return null;
  const exitDy = frame > A.legendExit[0] ? -5.2 * (frame - A.legendExit[0]) : 0;
  const exitAlpha = frame > A.legendExit[0] ? 1 - clamp01((frame - A.legendExit[0]) / 16) : 1;
  return (
    <AbsoluteFill style={{ opacity: exitAlpha }}>
      {LEGEND_ROWS.map((row, i) => {
        const sc = popScale(frame - row.pop);
        if (sc <= 0) return null;
        const [, , , th] = row.bbox;
        const cy = row.bbox[1] + th / 2 + exitDy;
        const tag = row.tag;
        return (
          <React.Fragment key={row.text}>
            <div
              style={{
                position: "absolute",
                left: row.bbox[0] + row.bbox[2],
                top: cy,
                transform: `translate(-100%, -50%) scale(${sc})`,
                transformOrigin: "right center",
                fontFamily: BARLOW,
                fontWeight: 400,
                fontSize: 15,
                color: "#A8A8A8",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              {row.text}
            </div>
            <div
              style={{
                position: "absolute",
                left: tag[0],
                top: tag[1] + exitDy,
                width: tag[2],
                height: tag[3],
                transform: `scale(${sc})`,
                background: "#4BADC2",
                borderRadius: 3,
                clipPath:
                  "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 32%, -6% 25%, 0 18%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: BARLOW,
                fontWeight: 700,
                fontSize: 16,
                color: "#fff",
                boxShadow: "-1px 1px 2px rgba(120,130,135,0.35)",
              }}
            >
              {i + 1}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ═══════════ DOM label overlay (chapter B + B→C glide + chapter C) ═══════════
// Round 3: owns the labels from f452 (they were wall-locked until 903,
// which shrank them with the zoom; the reference keeps them screen-large
// — measured tracks B_FIXED_LABEL / B_BASE_LABEL).
const LabelsOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 455 || frame > M.C_EXIT.labelFade[1]) return null;
  const fixed = M.fixedLabelPos(frame);
  const base = M.baseLabelPos(frame);
  const capC = M.labelCapC(frame);
  // measured B caps blend into the C sizing across the 903-940 glide
  const glide = clamp01((frame - 903) / 37);
  const capBase = frame >= 940 ? capC : M.labelCapBaseB(frame) + (capC - M.labelCapBaseB(frame)) * glide;
  const capFixed = frame >= 940 ? capC : M.labelCapFixedB(frame) + (capC - M.labelCapFixedB(frame)) * glide;
  const style = (p: [number, number], color: string, cap: number): React.CSSProperties => ({
    position: "absolute",
    left: p[0],
    top: p[1],
    transform: "translate(-50%, -50%)",
    fontFamily: BARLOW,
    fontWeight: 600,
    fontSize: cap / 0.72,
    color,
    whiteSpace: "nowrap",
  });
  // chapter-B entry fade (with the wall) + the fixed label's L→R wipe
  const enter = clamp01((frame - 452) / 16);
  const wipe = clamp01(
    (frame - B.greyTiming.labelWipe[0]) /
      (B.greyTiming.labelWipe[1] - B.greyTiming.labelWipe[0]),
  );
  return (
    <AbsoluteFill style={{ opacity: M.labelFadeC(frame) * enter }}>
      {wipe > 0 && (
        <div
          style={{
            ...style(fixed, COLORS.labelGrey, capFixed),
            clipPath: wipe < 1 ? `inset(0 ${(1 - wipe) * 100}% 0 0)` : undefined,
          }}
        >
          Fixed rate
        </div>
      )}
      <div style={style(base, COLORS.labelRed, capBase)}>Base rate</div>
    </AbsoluteFill>
  );
};

// ═══════════ Floors ═══════════
const drawYearsA = yearDrawer(M.yearMetricsA);
const AFloor: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, d: number) => {
    if (f >= 452) return; // outside chapter A: blank canvas (was unmounted)
    const ink = M.boardInkA(f);
    if (ink <= 0) return;
    ctx.globalAlpha = ink;
    drawSpread(ctx, { w, d, years: null, shadowBand: f > 116 });
    drawYearsA(ctx, ["1990", "2000", "2010"], w, clamp01((f - 126) / 6));
    ctx.globalAlpha = 1;
  }, []);
  return (
    <SpreadFloor frame={frame} fit={M.fitA} board={M.boardA} yF={M.floorYA}
      draw={draw} res={2.5} />
  );
};

const drawYearsB = yearDrawer(M.yearMetricsB);
const BFloor: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, d: number) => {
    if (f < 452 || f >= 935) return; // outside chapter B: blank canvas (was unmounted)
    const enter = clamp01((f - 452) / 16);
    ctx.globalAlpha = enter;
    drawSpread(ctx, { w, d, years: null });
    drawYearsB(ctx, ["2010", "2015", "2020"], w, 1);
    ctx.globalAlpha = 1;
  }, []);
  return (
    <SpreadFloor frame={frame} fit={M.fitB} board={M.boardB} yF={M.floorYB}
      draw={draw} res={2.5} />
  );
};

// Round 3 (owner ground-continuity): the reference keeps the chapter-C
// floor spread visible at the frame bottom through the topple, the map
// ink-in, AND the early buildings era (sheets prominent 1670-1745,
// sliding out by ~1805) — the replica's world-locked spread sat below
// frame from 1660, so the ground emptied and the map faded in from
// nothing (a scene cut). The spread therefore slides by a calibrated
// world offset (blended in 1655-1675, frozen after) that pins its bars
// page to the measured band, and lives until the reference loses it.
// Solved analytically (floorPlacement basis + drawSpread fractions,
// Gauss-Newton over three measured f1720 band features: bars page,
// sticky, squiggle page; ~15px RMS residual — the ref band is drawn
// flatter than a rigid floor plane can project, same as the slot
// band). The +39 y float is invisible: nothing else references this
// plane after the topple lines fade (~1690). Under the buildings-era
// camera (CAM_KEYS + pitch env) the band stays quasi-static at the
// frame bottom through 1800, exactly like the reference.
const A_BRIDGE: [number, number, number] = [27.6, 39.2, -224.5];
const bridgeT = (f: number) => clamp01((f - 1655) / 20);
const CFloor: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, d: number) => {
    if (f < 935 || f >= 1810) return; // outside chapter C: blank canvas (was unmounted)
    // persists under the topple and the buildings entry; fades out as
    // the reference loses the sheets (C_EXIT.floorFade)
    const ink = M.floorFadeC(f);
    if (ink <= 0) return;
    ctx.globalAlpha = ink;
    drawSpread(ctx, { w, d, years: null });
    ctx.globalAlpha = 1;
  }, []);
  const t = bridgeT(frame);
  return (
    <group position={[A_BRIDGE[0] * t, A_BRIDGE[1] * t, A_BRIDGE[2] * t]}>
      <SpreadFloor frame={frame} fit={M.fitC} board={M.boardC} yF={M.floorYC}
        draw={draw} res={2.5} />
    </group>
  );
};

// ═══════════ Ground layer (composition-level, persistent) ═══════════
// All three floors mount once and never unmount; each floor's draw
// early-returns outside its chapter window, leaving a blank transparent
// canvas — pixel-identical to the old mount/unmount gates.
export const ChartRoomGround: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {/* chapter A floor renders inside the same scaled group as before */}
    <group scale={M.A_GROUP.scale} position={M.A_GROUP.position}>
      <AFloor frame={frame} />
    </group>
    <BFloor frame={frame} />
    <CFloor frame={frame} />
  </>
);

// ═══════════ Scene ═══════════
// camera in scale-1 chapter coords; chapter A renders scaled, so its
// camera is transformed by the same map (z stays DCAM on the axis).
export const camChartRoom = (frame: number): V3 =>
  frame < 452
    ? ([M.camA(frame)[0] * M.SCALE_A, M.camA(frame)[1] * M.SCALE_A, M.camA(frame)[2]] as V3)
    : frame < 935
      ? M.camB(frame)
      : M.camC(frame);

// Camera yaw (rotation.y): nonzero inside chapters B and C, whose
// reference camera orbits the walls (see chartroomModel camB/camC solves).
// Regime switches at 452/935 sit inside content crossfades, exactly like
// the position solve; the C yaw tapers to 0 by 1690 (inside the gridline
// topple), so T_BLD and the buildings handoff stay byte-identical.
export const camChartRoomYaw = (frame: number): number =>
  frame >= 452 && frame < 935
    ? M.camBYaw(frame)
    : frame >= 935 && frame < 1690
      ? M.camCYaw(frame)
      : 0;

export const ChartRoomWorld: React.FC<{ frame: number }> = ({ frame }) => {
  const img = getTitleImg();
  return (
    <>
      {frame < 452 && (
        <>
          <group scale={M.A_GROUP.scale} position={M.A_GROUP.position}>
            <ChapterAWall frame={frame} />
          </group>
          <TitlePage frame={frame} img={img} />
        </>
      )}
      {frame >= 452 && frame < 935 && <ChapterBWall frame={frame} />}
      {frame >= 935 && frame < 1690 && <ChapterCWall frame={frame} />}
    </>
  );
};

export const ChartRoomOverlay: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <LegendOverlay frame={frame} />
    <LabelsOverlay frame={frame} />
  </>
);


