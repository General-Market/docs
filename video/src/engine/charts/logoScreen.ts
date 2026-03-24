export function drawLogoScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  label: string,
  accentHex: string,
) {
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, w, h);

  if (!label) return;

  const pulse = 0.5 + 0.2 * Math.sin(frame * 0.06);
  const gradient = ctx.createRadialGradient(
    w / 2,
    h / 2,
    0,
    w / 2,
    h / 2,
    w * 0.4,
  );
  gradient.addColorStop(0, accentHex + "30");
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const fontSize = label.length > 6 ? 36 : 48;
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.7 + pulse * 0.3;
  ctx.fillText(label, w / 2, h / 2);
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, w, 2);
}
