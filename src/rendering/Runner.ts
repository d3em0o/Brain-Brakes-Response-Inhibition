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
const ARM_LENGTH = 34;
const MIN_ARM_ANGLE = 0.72;
const MAX_ARM_ANGLE = 1.96;

export function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: AthleteState,
  elapsedMs: number
): void {
  ctx.save();
  ctx.translate(x, y);
  const phase = elapsedMs / 95;
  const runCycle = Math.sin(phase);
  const jumping = state === 'jump_takeoff' || state === 'airborne' || state === 'landing';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#253349';
  ctx.lineWidth = 7;

  const arms = jumping
    ? calculateRunningArmPose(0.2)
    : calculateRunningArmPose(runCycle);

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
    ctx.lineTo(20 * runCycle, -16);
    ctx.lineTo(38 * runCycle, 0);
    ctx.moveTo(2, -38);
    ctx.lineTo(-18 * runCycle, -16);
    ctx.lineTo(-34 * runCycle, 0);
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
