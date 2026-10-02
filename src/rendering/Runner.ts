import type { AthleteState } from '../data/types';

interface Point {
  x: number;
  y: number;
}

export interface ArmSegment {
  shoulder: Point;
  hand: Point;
  angle: number;
}

export interface RunnerArmPose {
  left: ArmSegment;
  right: ArmSegment;
}

export const RUNNING_ARM_BASE_ANGLE = 1.34;
export const RUNNING_ARM_SWING = 0.56;
export const LEFT_SHOULDER: Point = { x: -3, y: -64 };
export const RIGHT_SHOULDER: Point = { x: 3, y: -63 };
export const RUNNING_ANIMATION_FPS = 10;
export const PLAYER_SPRITE_WIDTH = 196;
export const PLAYER_SPRITE_HEIGHT = 169;
const ARM_LENGTH = 34;
const MIN_ARM_ANGLE = 0.72;
const MAX_ARM_ANGLE = 1.96;
const SPRITE_FRAME_WIDTH = 220;
const SPRITE_FRAME_HEIGHT = 190;
const PLAYER_SPRITE_ANCHOR_X = 104;
const PLAYER_SPRITE_FOOT_Y = 166;

interface SpriteSheetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RunnerSpriteFrame {
  src: string;
  sheetRect: SpriteSheetRect;
}

interface FallbackRunningFrame {
  armCycle: number;
  frontKneeX: number;
  frontKneeY: number;
  frontFootX: number;
  frontFootY: number;
  backKneeX: number;
  backKneeY: number;
  backFootX: number;
  backFootY: number;
  bodyBob: number;
}

export const RUN_FRAMES: RunnerSpriteFrame[] = [
  { src: './assets/runner/run-01.png', sheetRect: { x: 34, y: 41, width: 211, height: 181 } },
  { src: './assets/runner/run-02.png', sheetRect: { x: 252, y: 41, width: 206, height: 181 } },
  { src: './assets/runner/run-03.png', sheetRect: { x: 464, y: 41, width: 205, height: 181 } },
  { src: './assets/runner/run-04.png', sheetRect: { x: 675, y: 41, width: 206, height: 181 } },
  { src: './assets/runner/run-05.png', sheetRect: { x: 887, y: 41, width: 207, height: 181 } },
  { src: './assets/runner/run-06.png', sheetRect: { x: 1095, y: 41, width: 206, height: 181 } },
  { src: './assets/runner/run-07.png', sheetRect: { x: 1307, y: 41, width: 206, height: 181 } },
  { src: './assets/runner/run-08.png', sheetRect: { x: 1518, y: 41, width: 208, height: 181 } }
];

export const JUMP_FRAMES: RunnerSpriteFrame[] = [
  { src: './assets/runner/jump-01.png', sheetRect: { x: 36, y: 309, width: 209, height: 186 } },
  { src: './assets/runner/jump-02.png', sheetRect: { x: 253, y: 309, width: 205, height: 186 } },
  { src: './assets/runner/jump-03.png', sheetRect: { x: 464, y: 309, width: 205, height: 186 } },
  { src: './assets/runner/jump-04.png', sheetRect: { x: 675, y: 309, width: 206, height: 186 } },
  { src: './assets/runner/jump-05.png', sheetRect: { x: 887, y: 309, width: 203, height: 186 } },
  { src: './assets/runner/jump-06.png', sheetRect: { x: 1096, y: 309, width: 205, height: 186 } },
  { src: './assets/runner/jump-07.png', sheetRect: { x: 1307, y: 309, width: 205, height: 186 } },
  { src: './assets/runner/jump-08.png', sheetRect: { x: 1517, y: 309, width: 209, height: 186 } }
];

const FALLBACK_RUNNING_FRAMES: FallbackRunningFrame[] = [
  { armCycle: -1, frontKneeX: -18, frontKneeY: -18, frontFootX: -34, frontFootY: -1, backKneeX: 24, backKneeY: -20, backFootX: 42, backFootY: -7, bodyBob: 0 },
  { armCycle: -0.45, frontKneeX: -10, frontKneeY: -13, frontFootX: -18, frontFootY: 0, backKneeX: 18, backKneeY: -27, backFootX: 28, backFootY: -18, bodyBob: -3 },
  { armCycle: 0.45, frontKneeX: 12, frontKneeY: -18, frontFootX: 28, frontFootY: -10, backKneeX: -12, backKneeY: -20, backFootX: -20, backFootY: -1, bodyBob: -1 },
  { armCycle: 1, frontKneeX: 24, frontKneeY: -20, frontFootX: 42, frontFootY: -7, backKneeX: -18, backKneeY: -18, backFootX: -34, backFootY: -1, bodyBob: 0 },
  { armCycle: 0.45, frontKneeX: 18, frontKneeY: -27, frontFootX: 28, frontFootY: -18, backKneeX: -10, backKneeY: -13, backFootX: -18, backFootY: 0, bodyBob: -3 },
  { armCycle: -0.45, frontKneeX: -12, frontKneeY: -20, frontFootX: -20, frontFootY: -1, backKneeX: 12, backKneeY: -18, backFootX: 28, backFootY: -10, bodyBob: -1 }
];

const runnerSpriteImages = new Map<string, HTMLImageElement>();

export function preloadRunnerSprites(): void {
  if (typeof Image === 'undefined') return;
  for (const frame of [...RUN_FRAMES, ...JUMP_FRAMES]) {
    loadRunnerFrame(frame);
  }
}

export function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: AthleteState,
  elapsedMs: number,
  jumpProgress = 0
): void {
  const spriteFrame = getSpriteFrame(state, elapsedMs, jumpProgress);
  const image = loadRunnerFrame(spriteFrame);
  if (image?.complete && image.naturalWidth > 0) {
    drawRunnerSprite(ctx, image, x, y);
    return;
  }
  drawFallbackRunner(ctx, x, y, state, elapsedMs);
}

function getSpriteFrame(state: AthleteState, elapsedMs: number, jumpProgress: number): RunnerSpriteFrame {
  if (isJumpingState(state)) {
    const frameIndex = Math.min(JUMP_FRAMES.length - 1, Math.max(0, Math.floor(jumpProgress * JUMP_FRAMES.length)));
    return JUMP_FRAMES[frameIndex];
  }
  const frameDurationMs = 1000 / RUNNING_ANIMATION_FPS;
  const frameIndex = Math.floor(Math.max(0, elapsedMs) / frameDurationMs) % RUN_FRAMES.length;
  return RUN_FRAMES[frameIndex];
}

function loadRunnerFrame(frame: RunnerSpriteFrame): HTMLImageElement | undefined {
  if (typeof Image === 'undefined') return undefined;
  const existing = runnerSpriteImages.get(frame.src);
  if (existing) return existing;
  const image = new Image();
  image.decoding = 'async';
  image.src = frame.src;
  runnerSpriteImages.set(frame.src, image);
  return image;
}

function drawRunnerSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number): void {
  const drawX = x - (PLAYER_SPRITE_ANCHOR_X / SPRITE_FRAME_WIDTH) * PLAYER_SPRITE_WIDTH;
  const drawY = y - (PLAYER_SPRITE_FOOT_Y / SPRITE_FRAME_HEIGHT) * PLAYER_SPRITE_HEIGHT;
  ctx.drawImage(image, drawX, drawY, PLAYER_SPRITE_WIDTH, PLAYER_SPRITE_HEIGHT);
}

function isJumpingState(state: AthleteState): boolean {
  return state === 'jump_takeoff' || state === 'airborne' || state === 'landing';
}

function drawFallbackRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: AthleteState,
  elapsedMs: number
): void {
  ctx.save();
  const jumping = isJumpingState(state);
  const frame = jumping ? FALLBACK_RUNNING_FRAMES[1] : getRunningFrame(elapsedMs);
  ctx.translate(x, y + (jumping ? 0 : frame.bodyBob));

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#253349';
  ctx.lineWidth = 7;

  const arms = jumping
    ? calculateRunningArmPose(0.2)
    : calculateRunningArmPose(frame.armCycle);

  ctx.strokeStyle = '#d9936b';
  drawArm(ctx, arms.left);
  drawShoulderCap(ctx, LEFT_SHOULDER, '#d9936b');

  ctx.fillStyle = '#f3b37f';
  ctx.beginPath();
  ctx.arc(0, -82, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#0f6f9f';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-4, -68);
  ctx.lineTo(4, -38);
  ctx.stroke();

  ctx.strokeStyle = '#f3b37f';
  drawArm(ctx, arms.right);
  drawShoulderCap(ctx, RIGHT_SHOULDER, '#f3b37f');

  ctx.strokeStyle = '#28334d';
  ctx.lineWidth = 8;
  if (jumping) {
    ctx.beginPath();
    ctx.moveTo(4, -38);
    ctx.lineTo(42, -54);
    ctx.lineTo(72, -48);
    ctx.moveTo(2, -38);
    ctx.lineTo(-26, -22);
    ctx.lineTo(-42, -8);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(2, -38);
    ctx.lineTo(frame.frontKneeX, frame.frontKneeY);
    ctx.lineTo(frame.frontFootX, frame.frontFootY);
    ctx.moveTo(2, -38);
    ctx.lineTo(frame.backKneeX, frame.backKneeY);
    ctx.lineTo(frame.backFootX, frame.backFootY);
    ctx.stroke();
  }

  ctx.strokeStyle = '#f6d04b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8, -66);
  ctx.lineTo(8, -42);
  ctx.stroke();

  ctx.restore();
}

function getRunningFrame(elapsedMs: number): FallbackRunningFrame {
  const frameDurationMs = 1000 / RUNNING_ANIMATION_FPS;
  const frameIndex = Math.floor(Math.max(0, elapsedMs) / frameDurationMs) % FALLBACK_RUNNING_FRAMES.length;
  return FALLBACK_RUNNING_FRAMES[frameIndex];
}

export function calculateArmSegment(
  shoulderX: number,
  shoulderY: number,
  shoulderAngle: number,
  armLength = ARM_LENGTH
): ArmSegment {
  const safeShoulderAngle = clamp(shoulderAngle, MIN_ARM_ANGLE, MAX_ARM_ANGLE);
  const hand = {
    x: shoulderX + Math.cos(safeShoulderAngle) * armLength,
    y: shoulderY + Math.sin(safeShoulderAngle) * armLength
  };
  return {
    shoulder: { x: shoulderX, y: shoulderY },
    hand,
    angle: safeShoulderAngle
  };
}

export function calculateRunningArmPose(runCycle: number): RunnerArmPose {
  return {
    left: calculateArmSegment(
      LEFT_SHOULDER.x,
      LEFT_SHOULDER.y,
      RUNNING_ARM_BASE_ANGLE + runCycle * RUNNING_ARM_SWING
    ),
    right: calculateArmSegment(
      RIGHT_SHOULDER.x,
      RIGHT_SHOULDER.y,
      RUNNING_ARM_BASE_ANGLE - runCycle * RUNNING_ARM_SWING
    )
  };
}

function drawArm(ctx: CanvasRenderingContext2D, arm: ArmSegment): void {
  ctx.save();
  ctx.translate(arm.shoulder.x, arm.shoulder.y);
  ctx.rotate(arm.angle);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ARM_LENGTH, 0);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(ARM_LENGTH, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShoulderCap(ctx: CanvasRenderingContext2D, shoulder: Point, fillStyle: string): void {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(shoulder.x, shoulder.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
