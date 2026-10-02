import type { AthleteState, HurdleState } from '../data/types';
import type { GameConfig } from '../data/config';
import { drawHurdle } from './Hurdle';
import { drawRunner, preloadRunnerSprites } from './Runner';
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
  worldX: number;
  state: AthleteState;
  jumpProgress?: number;
}

const JUMP_DURATION_MS = 560;
const GAME_SPEED = 1;
const RUNNER_SCREEN_X_RATIO = 0.24;

interface SceneVisuals {
  takeoffX: number;
  hurdleX: number;
  finishX: number;
  scrollX: number;
}

interface SceneDebugMetrics {
  takeoffX: number;
  hurdleX: number;
  distancePx: number;
  distanceAsPercentOfWidth: number;
}

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private cssWidth = 1280;
  private cssHeight = 720;
  private sceneDebugMetrics: SceneDebugMetrics = {
    takeoffX: 0,
    hurdleX: 0,
    distancePx: 0,
    distanceAsPercentOfWidth: 0
  };

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    this.ctx = context;
    this.config = config;
    preloadRunnerSprites();
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

    const visual = this.getRunnerVisual(state, layout);
    const scene = this.getSceneVisuals(layout, visual);
    const collapseProgress = state.trialType === 'inhibition' ? state.collapseProgress ?? 0 : 0;

    drawTrack(ctx, width, height, state.elapsedMs, layout, scene.scrollX);
    drawTakeoffMarker(ctx, scene.takeoffX, layout.groundY);
    drawHurdle(ctx, scene.hurdleX, layout.groundY, collapseProgress, state.elapsedMs);
    drawRunner(ctx, visual.x, visual.y, visual.state, state.elapsedMs, visual.jumpProgress);
    this.drawFinishMarker(scene.finishX, layout.groundY);
    this.drawOverlayText(state);
    this.updateSceneDebugMetrics(scene, visual);
  }

  renderMenu(title = 'BRAIN BRAKES', subtitle = 'How fast can your brain change its mind?'): void {
    this.render({ elapsedMs: 0, athleteState: 'idle', message: title, subMessage: subtitle });
  }

  isVisualComplete(state: RenderState): boolean {
    const layout = createSceneLayout(this.cssWidth, this.cssHeight);
    const visual = this.getRunnerVisual(state, layout);
    return visual.worldX >= layout.finishX + 12;
  }

  getSceneDebugMetrics(): { takeoffX: number; hurdleX: number; distancePx: number; distanceAsPercentOfWidth: number } {
    return this.sceneDebugMetrics;
  }

  private getRunnerVisual(state: RenderState, layout: SceneLayout): RunnerVisual {
    const runSpeed = this.getRunSpeed(layout);
    const runnerScreenX = this.getRunnerScreenX(layout);
    const baseGroundWorldX = Math.min(
      layout.finishX + 18,
      layout.startX + runSpeed * Math.max(0, state.elapsedMs)
    );

    if (state.releaseTimeMs === undefined) {
      const noJumpState = baseGroundWorldX >= layout.finishX ? 'finish' : state.athleteState;
      return {
        x: runnerScreenX,
        y: layout.groundY,
        worldX: baseGroundWorldX,
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
        x: runnerScreenX,
        y: layout.groundY - jumpHeight * arc,
        worldX: jumpStartX + jumpDistance * jumpProgress,
        state: jumpProgress < 0.25 ? 'jump_takeoff' : jumpProgress < 0.72 ? 'airborne' : 'landing',
        jumpProgress
      };
    }

    const landingX = jumpStartX + jumpDistance;
    const runOutElapsed = jumpElapsed - JUMP_DURATION_MS;
    const runOutWorldX = Math.min(layout.finishX + 18, landingX + runSpeed * runOutElapsed);
    return {
      x: runnerScreenX,
      y: layout.groundY,
      worldX: runOutWorldX,
      state: runOutWorldX >= layout.finishX ? 'finish' : 'continue_running',
      jumpProgress
    };
  }

  private getRunSpeed(layout: SceneLayout): number {
    return ((layout.takeoffX - layout.startX) / this.config.targetTimeMs) * GAME_SPEED;
  }

  private getRunnerScreenX(layout: SceneLayout): number {
    return this.cssWidth * RUNNER_SCREEN_X_RATIO || layout.startX;
  }

  private getSceneVisuals(layout: SceneLayout, visual: RunnerVisual): SceneVisuals {
    const screenXForWorldX = (worldX: number) => visual.x + (worldX - visual.worldX);
    return {
      takeoffX: screenXForWorldX(layout.takeoffX),
      hurdleX: screenXForWorldX(layout.hurdleX),
      finishX: screenXForWorldX(layout.finishX),
      scrollX: Math.max(0, visual.worldX - layout.startX)
    };
  }

  private updateSceneDebugMetrics(scene: SceneVisuals, visual: RunnerVisual): void {
    const distancePx = scene.hurdleX - visual.x;
    this.sceneDebugMetrics = {
      takeoffX: scene.takeoffX,
      hurdleX: scene.hurdleX,
      distancePx,
      distanceAsPercentOfWidth: this.cssWidth ? (distancePx / this.cssWidth) * 100 : 0
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
