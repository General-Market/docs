import { mulberry32 } from "../../shorts/short-02/components/city/cityConfig";

export function drawPortfolioCrash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
) {
  ctx.fillStyle = "#120808";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,50,50,0.06)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let y = 0; y < h; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#ff3333";
  ctx.fillText("PORTFOLIO VALUE", 15, 30);
  const loss = Math.floor(frame * 8.5 + 500);
  ctx.textAlign = "right";
  ctx.font = "bold 22px monospace";
  ctx.fillText(`-$${loss.toLocaleString()}`, w - 15, 30);
  ctx.textAlign = "start";

  const points = 60;
  const rng = mulberry32(666);
  const data: number[] = [];
  let val = 85;
  for (let i = 0; i < points; i++) {
    val -= (rng() * 2.5 + 0.3);
    val += rng() * 0.8;
    val = Math.max(5, Math.min(95, val));
    data.push(val);
  }

  const padX = 15;
  const padY = 40;
  const visiblePoints = Math.min(points, Math.floor(frame * 0.6) + 5);
  const colorHex = "#ff3333";

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
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (visiblePoints > 0) {
    const lastY = padY + ((100 - data[visiblePoints - 1]) / 100) * (h - padY * 2);
    const pulse = 4 + Math.sin(frame * 0.15) * 2;
    ctx.beginPath();
    ctx.arc(lastX, lastY, pulse, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.fill();
  }

  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, w, 3);
}
