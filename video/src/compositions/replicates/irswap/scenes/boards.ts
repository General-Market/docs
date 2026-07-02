// The floor "board" — a two-page paper spread with pre-printed sketches.
// All positions are fractions of the full spread (origin = far-left corner,
// x → along the wall, y → toward the camera). Measured from ref frames
// 100/340/1100 (child aa1c71e).

export type SpreadOpts = {
  w: number; // canvas width px (= spread world width in canvas units)
  d: number; // canvas height px (= spread depth)
  revealRight?: number; // 0-1, clip fraction of the right page (default 1)
  years?: [string, string, string] | null; // far-edge labels TL/seam/TR
  yearAlpha?: number;
  yearCap?: number; // cap height in canvas units
  leftPage?: boolean; // draw the left page white+content (default true)
  shadowBand?: boolean; // wall-foot shadow along far edge
};

const SEAM = 0.487;

export const drawSpread = (ctx: CanvasRenderingContext2D, o: SpreadOpts) => {
  const { w, d } = o;
  const X = (fx: number) => fx * w;
  const Y = (fy: number) => fy * d;
  const leftPage = o.leftPage !== false;
  const reveal = o.revealRight ?? 1;

  // pages (white, pink trim on outer edges)
  const page = (x0: number, x1: number) => {
    ctx.fillStyle = "#FCFCFB";
    ctx.fillRect(X(x0), 0, X(x1) - X(x0), d);
    ctx.strokeStyle = "#DBCDD1"; // dusty pink trim
    ctx.lineWidth = Math.max(2, d * 0.008);
    ctx.beginPath();
    // left, near, right edges (far edge sits under the wall shadow)
    ctx.moveTo(X(x0) + 1, 0);
    ctx.lineTo(X(x0) + 1, d - 1);
    ctx.lineTo(X(x1) - 1, d - 1);
    ctx.lineTo(X(x1) - 1, 0);
    ctx.stroke();
  };
  if (leftPage) page(0, SEAM);
  if (reveal > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(SEAM), 0, X(SEAM + (1 - SEAM) * reveal) - X(SEAM), d);
    ctx.clip();
    page(SEAM, 1);
    // ruled lines (parallel to seam), grey
    ctx.strokeStyle = "#E4E4E4";
    ctx.lineWidth = Math.max(1.5, d * 0.005);
    for (const fx of [0.553, 0.585, 0.618, 0.649, 0.681, 0.713, 0.748, 0.782, 0.814, 0.848, 0.881, 0.911]) {
      ctx.beginPath();
      ctx.moveTo(X(fx), Y(0.58));
      ctx.lineTo(X(fx), Y(0.91));
      ctx.stroke();
    }
    // red squiggle chart (desaturated)
    ctx.strokeStyle = "#E0D2D6";
    ctx.lineWidth = Math.max(2, d * 0.008);
    ctx.beginPath();
    const sq: [number, number][] = [
      [0.533, 0.146], [0.575, 0.21], [0.592, 0.228], [0.637, 0.209],
      [0.66, 0.27], [0.679, 0.315], [0.708, 0.259], [0.74, 0.32],
      [0.757, 0.345], [0.768, 0.302], [0.807, 0.37], [0.827, 0.335],
      [0.87, 0.365], [0.906, 0.381],
    ];
    ctx.moveTo(X(sq[0][0]), Y(sq[0][1]));
    for (const [fx, fy] of sq.slice(1)) ctx.lineTo(X(fx), Y(fy));
    ctx.stroke();
    // margin lines right page
    ctx.strokeStyle = "#CFCFCF";
    ctx.lineWidth = Math.max(1.5, d * 0.005);
    ctx.beginPath();
    ctx.moveTo(X(0.946), 0);
    ctx.lineTo(X(0.946), d);
    ctx.stroke();
    ctx.restore();
  }
  if (leftPage) {
    // left page sketches
    const rect = (x0: number, y0: number, x1: number, y1: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(X(x0), Y(y0), X(x1) - X(x0), Y(y1) - Y(y0));
    };
    rect(0.077, 0.045, 0.199, 0.297, "#D0D0D0");
    rect(0.204, 0.043, 0.35, 0.191, "#D1D1D2");
    rect(0.327, 0.038, 0.455, 0.2, "#D4ECF0");
    rect(0.206, 0.215, 0.456, 0.305, "#D4ECF0");
    rect(0.071, 0.76, 0.22, 0.899, "#D4ECF0");
    // margin lines
    ctx.strokeStyle = "#CFCFCF";
    ctx.lineWidth = Math.max(1.5, d * 0.005);
    ctx.beginPath();
    ctx.moveTo(X(0.048), 0);
    ctx.lineTo(X(0.048), d);
    ctx.moveTo(0, Y(0.932));
    ctx.lineTo(X(SEAM), Y(0.932));
    ctx.stroke();
  }
  // seam gutter
  ctx.strokeStyle = "#DBDBDB";
  ctx.lineWidth = Math.max(2, d * 0.007);
  ctx.beginPath();
  ctx.moveTo(X(SEAM), 0);
  ctx.lineTo(X(SEAM), d);
  ctx.stroke();
  // wall-foot shadow band along far edge
  if (o.shadowBand !== false) {
    ctx.fillStyle = "rgba(190,193,197,0.55)";
    ctx.fillRect(0, 0, w, Math.max(3, d * 0.02));
  }
  // years along the far edge
  if (o.years && (o.yearAlpha ?? 1) > 0) {
    ctx.globalAlpha = o.yearAlpha ?? 1;
    ctx.fillStyle = "#848484";
    const cap = o.yearCap ?? d * 0.11;
    ctx.font = `600 ${cap / 0.72}px Barlow, sans-serif`;
    ctx.textBaseline = "middle";
    const yMid = Y(0.09);
    ctx.textAlign = "left";
    ctx.fillText(o.years[0], X(0.0), yMid);
    ctx.textAlign = "center";
    ctx.fillText(o.years[1], X(0.54), yMid);
    ctx.textAlign = "right";
    ctx.fillText(o.years[2], X(1.0), yMid);
    ctx.globalAlpha = 1;
  }
};
