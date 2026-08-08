export function drawHurdle(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  collapseProgress: number,
  wobble = 0
): void {
  ctx.save();
  ctx.translate(x, groundY);
  const immediateMotion = collapseProgress > 0 ? 0.08 : 0;
  const p = Math.max(collapseProgress, immediateMotion);
  const angle = p * 1.58 + (p > 0 && p < 1 ? Math.sin(wobble / 24) * 0.025 : 0);
  const topY = -70 + p * 64;
  const leftLean = p * 42;
  const rightLean = p * 24;

  ctx.strokeStyle = '#f6f8fb';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.lineTo(-28 + leftLean, topY);
  ctx.moveTo(34, 0);
  ctx.lineTo(28 + rightLean, topY + p * 12);
  ctx.stroke();

  ctx.save();
  ctx.translate(p * 34, topY);
  ctx.rotate(angle);
  ctx.fillStyle = '#f8f5ec';
  ctx.fillRect(-52, -7, 104, 14);
  ctx.fillStyle = '#db3b32';
  ctx.fillRect(-34, -7, 18, 14);
  ctx.fillRect(18, -7, 18, 14);
  ctx.restore();

  ctx.strokeStyle = 'rgba(35,51,73,0.25)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-48, 5);
  ctx.lineTo(56, 5);
  ctx.stroke();

  if (p >= 0.95) {
    ctx.fillStyle = '#f8f5ec';
    ctx.fillRect(-50, -10, 112, 10);
    ctx.fillStyle = '#db3b32';
    ctx.fillRect(-28, -10, 18, 10);
    ctx.fillRect(24, -10, 18, 10);
  }
  ctx.restore();
}
