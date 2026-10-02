export interface SceneLayout {
  startX: number;
  takeoffX: number;
  hurdleX: number;
  finishX: number;
  groundY: number;
  trackTopY: number;
  trackBottomY: number;
}

export const SCENE_RATIOS = {
  startX: 0.16,
  takeoffX: 0.61,
  hurdleX: 0.69,
  finishX: 0.91,
  groundY: 0.78
} as const;

export function createSceneLayout(width: number, height: number): SceneLayout {
  const groundY = height * SCENE_RATIOS.groundY;
  return {
    startX: width * SCENE_RATIOS.startX,
    takeoffX: width * SCENE_RATIOS.takeoffX,
    hurdleX: width * SCENE_RATIOS.hurdleX,
    finishX: width * SCENE_RATIOS.finishX,
    groundY,
    trackTopY: groundY - 20,
    trackBottomY: height
  };
}

export function drawTrack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  layout: SceneLayout,
  scrollX = 0
): void {
  const skyBottom = height * 0.36;
  const stadiumBottom = height * 0.54;
  const grassBottom = layout.trackTopY;

  const sky = ctx.createLinearGradient(0, 0, 0, skyBottom);
  sky.addColorStop(0, '#78c8f7');
  sky.addColorStop(1, '#d8f2ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, skyBottom);

  ctx.fillStyle = '#cddde6';
  ctx.fillRect(0, skyBottom, width, stadiumBottom - skyBottom);
  ctx.fillStyle = '#eef4f7';
  ctx.fillRect(0, stadiumBottom - 8, width, 8);
  const seatSize = Math.max(8, width / 130);
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < Math.ceil(width / (seatSize * 2.4)); col += 1) {
      ctx.fillStyle = (row + col) % 3 === 0 ? '#f4c84d' : (row + col) % 3 === 1 ? '#3177b7' : '#ef6a54';
      ctx.fillRect(col * seatSize * 2.4 + row * 8 - ((elapsedMs / 180) % (seatSize * 2.4)), skyBottom + 15 + row * 18, seatSize, 8);
    }
  }

  ctx.fillStyle = '#4aaa61';
  ctx.fillRect(0, stadiumBottom, width, grassBottom - stadiumBottom);
  ctx.fillStyle = '#377f4a';
  ctx.fillRect(0, grassBottom - 6, width, 6);

  ctx.fillStyle = '#b94335';
  ctx.fillRect(0, layout.trackTopY, width, height - layout.trackTopY);
  ctx.fillStyle = '#cf5138';
  ctx.fillRect(0, layout.trackTopY, width, 16);

  const trackStripeWidth = Math.max(42, width / 22);
  const trackStripeOffset = scrollX % trackStripeWidth;
  ctx.fillStyle = 'rgba(255, 224, 102, 0.12)';
  for (let x = -trackStripeWidth - trackStripeOffset; x < width + trackStripeWidth; x += trackStripeWidth) {
    ctx.beginPath();
    ctx.moveTo(x, layout.trackTopY + 18);
    ctx.lineTo(x + trackStripeWidth * 0.34, layout.trackTopY + 18);
    ctx.lineTo(x + trackStripeWidth * 0.64, height);
    ctx.lineTo(x + trackStripeWidth * 0.3, height);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 4;
  for (let lane = 0; lane < 4; lane += 1) {
    const y = layout.groundY + 18 + lane * 34;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#fff8d6';
  ctx.lineWidth = 5;
  ctx.setLineDash([18, 16]);
  ctx.lineDashOffset = scrollX % 34;
  ctx.beginPath();
  ctx.moveTo(0, layout.groundY + 52);
  ctx.lineTo(width, layout.groundY + 52);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

export function drawTakeoffMarker(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  ctx.save();
  ctx.fillStyle = '#ffe066';
  ctx.strokeStyle = '#24334c';
  ctx.lineWidth = 2;
  const markerWidth = 12;
  const markerHeight = 24;
  ctx.fillRect(x - markerWidth / 2, groundY - markerHeight + 6, markerWidth, markerHeight);
  ctx.strokeRect(x - markerWidth / 2, groundY - markerHeight + 6, markerWidth, markerHeight);
  ctx.restore();
}
