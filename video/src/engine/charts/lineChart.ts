import { mulberry32 } from "../../shorts/short-02/components/city/cityConfig";

export function drawLineChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  colorHex: string,
  seed: number,
) {
  const rng = mulberry32(seed);
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let y = 0; y < h; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const points = 60;
  const data: number[] = [];
  let val = 50 + rng() * 30;
  for (let i = 0; i < points; i++) {
    val += (rng() - 0.48) * 5;
    val = Math.max(10, Math.min(90, val));
    data.push(val);
  }

  const padX = 15;
  const padY = 20;
  const visiblePoints = Math.min(points, Math.floor(frame * 0.5) + 8);

  const gradient = ctx.createLinearGradient(0, padY, 0, h - padY);
  gradient.addColorStop(0, colorHex + "40");
  gradient.addColorStop(1, colorHex + "00");

  ctx.beginPath();
  ctx.moveTo(padX, h - padY);
  for (let i = 0; i < visiblePoints; i++) {
    const x = padX + (i / (points - 1)) * (w - padX * 2);
    const y = padY + ((100 - data[i]) / 100) * (h - padY * 2);
    ctx.lineTo(x, y);
  }
  const lastX = padX + ((visiblePoints - 1) / (points - 1)) * (w - padX * 2);
  ctx.lineTo(lastX, h - padY);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < visiblePoints; i++) {
    const x = padX + (i / (points - 1)) * (w - padX * 2);
    const y = padY + ((100 - data[i]) / 100) * (h - padY * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (visiblePoints > 0) {
    const lastY =
      padY + ((100 - data[visiblePoints - 1]) / 100) * (h - padY * 2);
    const pulse = 3 + Math.sin(frame * 0.1) * 1.5;
    ctx.beginPath();
    ctx.arc(lastX, lastY, pulse, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.fill();
  }

  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, 2);
}
