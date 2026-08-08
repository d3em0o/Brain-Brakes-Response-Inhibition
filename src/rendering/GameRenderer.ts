import type { AthleteState, HurdleState } from '../data/types';
import type { GameConfig } from '../data/config';
import { drawHurdle } from './Hurdle';
import { drawRunner } from './Runner';
import { createSceneLayout, drawTakeoffMarker, drawTrack, type SceneLayout } from './Track';

export interface RenderState {
  elapsedMs: number;
  athleteState: AthleteState;
  trialType?: 'go' | 'inhibition';
  releaseTimeMs?: number;
  cueElapsedMs?: number;
  collapseProgress?: number;
  hurdleState?: HurdleState;
  message: string;
  subMessage?: string;
  progressLabel?: string;
  invalid?: boolean;
}

interface RunnerVisual {
  x: number;
  y: number;
  state: AthleteState;
  jumpProgress?: number;
}

const JUMP_DURATION_MS = 560;

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private cssWidth = 1280;
  private cssHeight = 720;

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    this.ctx = context;
    this.config = config;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = rect.width || 1280;
    this.cssHeight = rect.height || 720;
    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(state: RenderState): void {
    const ctx = this.ctx;
    const width = this.cssWidth;
    const height = this.cssHeight;
    ctx.clearRect(0, 0, width, height);
    const layout = createSceneLayout(width, height);
    drawTrack(ctx, width, height, state.elapsedMs, layout);

    const visual = this.getRunnerVisual(state, layout);
    const collapseProgress = state.trialType === 'inhibition' ? state.collapseProgress ?? 0 : 0;

    drawTakeoffMarker(ctx, layout.takeoffX, layout.groundY);
    drawHurdle(ctx, layout.hurdleX, layout.groundY, collapseProgress, state.elapsedMs);
    drawRunner(ctx, visual.x, visual.y, visual.state, state.elapsedMs);
    this.drawFinishMarker(layout.finishX, layout.groundY);
    this.drawOverlayText(state);
  }

  renderMenu(title = 'BRAIN BRAKES', subtitle = 'How fast can your brain change its mind?'): void {
    this.render({ elapsedMs: 0, athleteState: 'idle', message: title, subMessage: subtitle });
  }

  isVisualComplete(state: RenderState): boolean {
    const layout = createSceneLayout(this.cssWidth, this.cssHeight);
    const visual = this.getRunnerVisual(state, layout);
    return visual.x >= layout.finishX + 12;
  }

  getSceneDebugMetrics(): { takeoffX: number; hurdleX: number; distancePx: number; distanceAsPercentOfWidth: number } {
    const layout = createSceneLayout(this.cssWidth, this.cssHeight);
    const distancePx = layout.hurdleX - layout.takeoffX;
    return {
      takeoffX: layout.takeoffX,
      hurdleX: layout.hurdleX,
      distancePx,
      distanceAsPercentOfWidth: this.cssWidth ? (distancePx / this.cssWidth) * 100 : 0
    };
  }

  private getRunnerVisual(state: RenderState, layout: SceneLayout): RunnerVisual {
    const runSpeed = (layout.takeoffX - layout.startX) / this.config.targetTimeMs;
    const baseGroundX = Math.min(
      layout.finishX + 18,
      layout.startX + runSpeed * Math.max(0, state.elapsedMs)
    );

    if (state.releaseTimeMs === undefined) {
      const noJumpState = baseGroundX >= layout.finishX ? 'finish' : state.athleteState;
      return {
        x: baseGroundX,
        y: layout.groundY,
        state: noJumpState
      };
    }

    const releaseTimeMs = Math.max(0, state.releaseTimeMs);
    const jumpStartX = Math.min(layout.finishX - 44, layout.startX + runSpeed * releaseTimeMs);
    const jumpElapsed = Math.max(0, state.elapsedMs - releaseTimeMs);
    const jumpProgress = Math.min(1, jumpElapsed / JUMP_DURATION_MS);
    const jumpDistance = Math.max(150, (layout.finishX - layout.takeoffX) * 0.62);
    const jumpHeight = Math.max(98, Math.min(138, this.cssHeight * 0.18));

    if (jumpProgress < 1) {
      const arc = 4 * jumpProgress * (1 - jumpProgress);
      return {
        x: jumpStartX + jumpDistance * jumpProgress,
        y: layout.groundY - jumpHeight * arc,
        state: jumpProgress < 0.25 ? 'jump_takeoff' : jumpProgress < 0.72 ? 'airborne' : 'landing',
        jumpProgress
      };
    }

    const landingX = jumpStartX + jumpDistance;
    const runOutElapsed = jumpElapsed - JUMP_DURATION_MS;
    return {
      x: Math.min(layout.finishX + 18, landingX + runSpeed * runOutElapsed),
      y: layout.groundY,
      state: landingX + runSpeed * runOutElapsed >= layout.finishX ? 'finish' : 'continue_running',
      jumpProgress
    };
  }

  private drawFinishMarker(x: number, groundY: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#253349';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, groundY + 20);
    ctx.lineTo(x, groundY - 116);
    ctx.stroke();
    ctx.fillStyle = '#f8f8f8';
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#253349' : '#f8f8f8';
        ctx.fillRect(x + col * 10, groundY - 116 + row * 10, 10, 10);
      }
    }
    ctx.restore();
  }

  private drawOverlayText(state: RenderState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = state.invalid ? '#8a1e1e' : '#1e314f';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText(state.message, this.cssWidth / 2, 62);
    if (state.subMessage) {
      ctx.font = '600 20px system-ui, sans-serif';
      ctx.fillText(state.subMessage, this.cssWidth / 2, 94);
    }
    if (state.progressLabel) {
      ctx.textAlign = 'right';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(state.progressLabel, this.cssWidth - 28, 42);
    }
    ctx.restore();
  }
}
