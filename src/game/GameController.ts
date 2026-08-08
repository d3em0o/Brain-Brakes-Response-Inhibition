import { summarizeGame1 } from '../analysis/game1Analysis';
import { calculateGameComparison } from '../analysis/gameComparison';
import { summarizeGame2 } from '../analysis/inhibitionAnalysis';
import { cloneConfig, DEFAULT_CONFIG, RESEARCH_LIKE_CONFIG, type GameConfig, type GameMode } from '../data/config';
import type { AthleteState, GameId, InputMethod, TimingDiagnostics, TrialData, TrialRuntime, TrialType } from '../data/types';
import { createGame2Plan, createPracticePlan } from './Randomisation';
import { InputManager } from './InputManager';
import { TrialEngine } from './TrialEngine';
import { collapseProgress, hurdleStateFromCue } from './CollapseLogic';
import { GameRenderer } from '../rendering/GameRenderer';
import { renderGame1Results, renderGame2Results } from '../ui/results';
import {
  exportSessionCsv,
  exportSessionJson,
  renderDebugPanel,
  renderSettingsForm,
  type DebugSnapshot
} from '../ui/facilitator';
import { button, screenShell } from '../ui/screens';

type TrialState = 'menu' | 'ready' | 'collecting' | 'animating' | 'feedback' | 'paused';

export class GameController {
  private root: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private screen!: HTMLElement;
  private debugPanel!: HTMLElement;
  private touchButton!: HTMLElement;
  private renderer!: GameRenderer;
  private input!: InputManager;
  private config: GameConfig = cloneConfig();
  private trialEngine: TrialEngine = new TrialEngine(this.config);
  private trials: TrialData[] = [];
  private diagnostics: TimingDiagnostics = { frameIntervals: [], cueErrorsMs: [] };
  private debug = new URLSearchParams(window.location.search).get('debug') === '1';
  private trialState: TrialState = 'menu';
  private currentGame: GameId = 1;
  private currentPlan: TrialType[] = [];
  private currentTrialIndex = 0;
  private practice = true;
  private currentSSDms = this.config.initialSSDms;
  private nextStaircaseMs = this.config.initialSSDms;
  private activeTrial?: TrialRuntime;
  private feedbackTitle = '';
  private feedbackDetail = '';
  private lastFrameTimestamp = 0;
  private elapsedMs = 0;
  private inputMethod: InputMethod = 'unknown';
  private feedbackTimer?: number;

  constructor(root: HTMLElement) {
    this.root = root;
    this.mount();
    this.renderer = new GameRenderer(this.canvas, this.config);
    this.input = new InputManager({
      onHoldStart: (method, timestamp) => this.handleHoldStart(method, timestamp),
      onRelease: (method, timestamp) => this.handleRelease(method, timestamp)
    });
    this.input.attachTouchButton(this.touchButton);
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('blur', () => this.invalidateActiveTrial('Window focus changed'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.invalidateActiveTrial('Browser tab was hidden');
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && this.trialState !== 'collecting' && this.trialState !== 'animating') this.showHome();
    });
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.showHome();
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  private mount(): void {
    this.root.innerHTML = `
      <main class="game-app">
        <canvas id="game-canvas" aria-label="Brain Brakes hurdle game" tabindex="0"></canvas>
        <div id="screen-layer" class="screen-layer"></div>
        <button id="touch-hold" class="touch-hold" type="button">HOLD TO RUN</button>
        <aside id="debug-panel" class="debug-panel" ${this.debug ? '' : 'hidden'}></aside>
      </main>
    `;
    this.canvas = this.root.querySelector('#game-canvas') as HTMLCanvasElement;
    this.screen = this.root.querySelector('#screen-layer') as HTMLElement;
    this.debugPanel = this.root.querySelector('#debug-panel') as HTMLElement;
    this.touchButton = this.root.querySelector('#touch-hold') as HTMLElement;
  }

  private showHome(): void {
    this.trialState = 'menu';
    this.clearFeedbackTimer();
    this.activeTrial = undefined;
    this.renderer.renderMenu();
    const admin = this.debug
      ? `${button('GAME 1 ONLY', 'game1-start', 'secondary')}${button('GAME 2 ONLY', 'game2-start', 'secondary')}${button('FACILITATOR SETTINGS', 'settings', 'secondary')}`
      : '';
    this.showScreen(
      screenShell(
        'BRAIN BRAKES',
        `<p class="subtitle">How fast can your brain change its mind?</p><div class="small-track-icon"></div>`,
        `${button('START', 'intro')}${admin}`
      )
    );
  }

  private showIntro(): void {
    this.showScreen(
      screenShell(
        'GET READY',
        `<p>You are the hurdler. Hold the space bar to run, then release it to jump.</p><p class="note">No names, accounts, or scores are saved.</p>`,
        button('NEXT', 'game1-instructions')
      )
    );
  }

  private showGame1Instructions(): void {
    this.showScreen(
      screenShell(
        '1 - HURDLE TIMING',
        `<ol class="instruction-list"><li>Hold SPACE to start running.</li><li>Release SPACE when you reach the take-off line.</li><li>Try to get as close as possible.</li></ol><div class="spacebar-visual">SPACE</div>`,
        button('PRACTICE', 'game1-practice')
      )
    );
  }

  private showGame2Instructions(): void {
    this.showScreen(
      screenShell(
        '2 - HURDLE FAKE-OUT',
        `<ol class="instruction-list"><li>Jump just like before.</li><li>Sometimes the hurdle collapses.</li><li>If it falls, keep holding SPACE and do not jump.</li></ol>`,
        button('PRACTICE', 'game2-practice')
      )
    );
  }

  private startGame1(practice: boolean): void {
    this.currentGame = 1;
    this.practice = practice;
    this.currentTrialIndex = 0;
    this.currentPlan = Array.from(
      { length: practice ? this.config.game1PracticeTrials : this.config.game1ScoredTrials },
      () => 'go'
    );
    this.prepareReadyState();
  }

  private startGame2(practice: boolean): void {
    this.currentGame = 2;
    this.practice = practice;
    this.currentTrialIndex = 0;
    this.currentSSDms = this.config.initialSSDms;
    this.nextStaircaseMs = this.currentSSDms;
    this.currentPlan = practice
      ? createPracticePlan(this.config.game2PracticeTrials)
      : createGame2Plan(this.config.game2GoTrials, this.config.game2InhibitionTrials);
    this.prepareReadyState();
  }

  private prepareReadyState(detail = 'Hold SPACE when you are ready'): void {
    this.trialState = 'ready';
    this.activeTrial = undefined;
    this.elapsedMs = 0;
    this.feedbackTitle = detail;
    this.feedbackDetail = this.practice ? 'Practice trial' : 'Scored trial';
    this.hideScreen();
    this.input.reset();
  }

  private handleHoldStart(method: InputMethod, timestamp: number): void {
    if (this.trialState !== 'ready') return;
    this.inputMethod = method;
    const trialType = this.currentPlan[this.currentTrialIndex];
    const scheduledSSDms = this.currentGame === 2 && trialType === 'inhibition' ? this.currentSSDms : null;
    this.activeTrial = this.trialEngine.startTrial(
      this.currentTrialIndex + 1,
      this.currentGame,
      trialType,
      this.practice,
      method,
      timestamp,
      scheduledSSDms
    );
    if (this.debug) {
      console.info(
        `Trial ${this.activeTrial.trialIndex}: type = ${this.activeTrial.trialType}, SSD = ${
          this.activeTrial.scheduledSSDms === null ? 'null' : `${this.activeTrial.scheduledSSDms} ms`
        }`
      );
      if (this.activeTrial.trialType === 'go' && this.activeTrial.scheduledSSDms !== null) {
        console.error('BUG: GO trial has non-null SSD');
      }
    }
    this.trialState = 'collecting';
    this.elapsedMs = 0;
    this.canvas.focus();
    this.playSound('start');
  }

  private handleRelease(method: InputMethod, timestamp: number): void {
    if (this.trialState !== 'collecting' || !this.activeTrial || this.activeTrial.releaseTimeMs !== undefined) return;
    this.inputMethod = method;
    this.activeTrial = this.trialEngine.recordRelease(this.activeTrial, timestamp);
    this.trialState = 'animating';
    this.playSound('land');
  }

  private loop(timestamp: number): void {
    if (this.lastFrameTimestamp) {
      const delta = timestamp - this.lastFrameTimestamp;
      if (delta > 0 && delta < 100) this.diagnostics.frameIntervals.push(delta);
      if (this.diagnostics.frameIntervals.length > 240) this.diagnostics.frameIntervals.shift();
    }
    this.lastFrameTimestamp = timestamp;

    if ((this.trialState === 'collecting' || this.trialState === 'animating') && this.activeTrial) {
      this.elapsedMs = timestamp - this.activeTrial.trialStartTimestamp;
      this.presentCueIfNeeded(timestamp);
      if (
        this.trialState === 'collecting' &&
        this.activeTrial.trialType === 'inhibition' &&
        this.activeTrial.releaseTimeMs === undefined &&
        this.elapsedMs >= this.config.totalTrialTimeMs
      ) {
        this.trialState = 'animating';
      }
      if (this.trialState === 'collecting' && this.activeTrial?.trialType === 'go' && this.activeTrial.releaseTimeMs === undefined && this.elapsedMs > 1350) {
        this.invalidateActiveTrial('Release was too late');
      }
      if (this.trialState === 'animating' && this.renderer.isVisualComplete(this.currentRenderState())) {
        this.finishActiveTrial();
      }
    }

    this.renderer.render(this.currentRenderState());

    if (this.debug) renderDebugPanel(this.debugPanel, this.debugSnapshot(timestamp));
    requestAnimationFrame((next) => this.loop(next));
  }

  private presentCueIfNeeded(timestamp: number): void {
    if (!this.activeTrial) return;
    if (this.activeTrial.trialType !== 'inhibition') {
      if (this.activeTrial.scheduledSSDms !== null || this.activeTrial.collapseTriggered) {
        console.error('BUG: collapse attempted during GO trial');
        this.activeTrial = {
          ...this.activeTrial,
          scheduledSSDms: null,
          actualCuePresentationTime: null,
          collapseTriggered: false,
          hurdleState: 'upright'
        };
      }
      return;
    }
    if (this.activeTrial.actualCuePresentationTime !== null || this.activeTrial.collapseTriggered) {
      this.activeTrial = { ...this.activeTrial, hurdleState: hurdleStateFromCue(this.activeTrial, timestamp) };
      return;
    }
    const scheduled = this.activeTrial.scheduledSSDms;
    if (scheduled === null) return;
    const elapsed = timestamp - this.activeTrial.trialStartTimestamp;
    if (elapsed >= scheduled) {
      this.activeTrial = this.trialEngine.markCuePresented(this.activeTrial, timestamp, this.debug);
      this.diagnostics.cueErrorsMs.push(elapsed - scheduled);
      this.playSound('clatter');
    }
  }

  private finishActiveTrial(): void {
    if (!this.activeTrial) return;
    const completed = this.trialEngine.completeTrial(this.activeTrial, this.currentSSDms);
    this.trials.push(completed);
    if (completed.trialType === 'inhibition' && completed.ssdAfterTrialMs !== undefined) {
      this.currentSSDms = completed.ssdAfterTrialMs;
      this.nextStaircaseMs = this.currentSSDms;
    }
    this.feedbackTitle = this.feedbackFor(completed);
    this.feedbackDetail = this.detailFor(completed);
    this.trialState = 'feedback';
    this.playSound(completed.points >= 75 ? 'success' : 'land');
    const wasValid = completed.valid;
    this.feedbackTimer = window.setTimeout(() => {
      if (wasValid) this.currentTrialIndex += 1;
      if (this.currentTrialIndex >= this.currentPlan.length) {
        this.finishRound();
      } else {
        this.prepareReadyState();
      }
    }, this.config.postTrialFeedbackMs);
  }

  private finishRound(): void {
    this.trialState = 'menu';
    if (this.currentGame === 1 && this.practice) {
      this.showScreen(screenShell('GOT IT?', '<p>Now try a scored set of jumps.</p>', button('START CHALLENGE', 'game1-scored')));
      return;
    }
    if (this.currentGame === 1) {
      const summary = summarizeGame1(this.trials.filter((trial) => trial.game === 1), this.config);
      this.showScreen(
        screenShell(
          'YOUR JUMP TIMING',
          renderGame1Results(summary, this.trials.filter((trial) => trial.game === 1), this.config.targetTimeMs),
          button('NEXT CHALLENGE', 'transition')
        )
      );
      return;
    }
    if (this.currentGame === 2 && this.practice) {
      this.showScreen(screenShell('READY FOR FAKE-OUT?', '<p>Jump normally unless the hurdle actually falls.</p>', button('START CHALLENGE', 'game2-scored')));
      return;
    }
    const game1Summary = summarizeGame1(this.trials.filter((trial) => trial.game === 1), this.config);
    const game2Summary = summarizeGame2(this.trials, this.config, game1Summary.meanReleaseTimeMs);
    const comparison = calculateGameComparison(this.trials, this.config);
    this.showScreen(
      screenShell(
        'BRAIN BRAKES RESULTS',
        renderGame2Results(game2Summary, comparison),
        `${button('WHAT JUST HAPPENED?', 'education')}${this.debug ? button('EXPORT JSON', 'export-json', 'secondary') + button('EXPORT CSV', 'export-csv', 'secondary') : ''}`
      )
    );
  }

  private showTransition(): void {
    this.showScreen(
      screenShell(
        'YOUR BRAIN KNEW WHAT WAS COMING',
        `<p>You could see the hurdle ahead, so your brain had time to prepare your jump before you actually moved.</p><p>Now let's make it harder.</p><p>What happens when you prepare the jump, but the hurdle suddenly changes?</p>`,
        button('NEXT CHALLENGE', 'game2-instructions')
      )
    );
  }

  private showEducation(): void {
    this.showScreen(
      screenShell(
        'WHAT JUST HAPPENED?',
        `<div class="explain-grid"><div><strong>GAME 1</strong><span>PREPARE</span></div><div><strong>GAME 2</strong><span>PREPARE + CANCEL</span></div></div><p>First, your brain prepared the jump before you reached the hurdle.</p><p>Then the environment suddenly changed. You had to cancel a movement you had already prepared.</p><h2>RESPONSE INHIBITION</h2><p>Response inhibition is your ability to stop or change an action that is already being prepared.</p><p class="note">Imagine starting to step across a road, then noticing a car and stopping yourself.</p><p>Your brain does not just create movements. It also has to decide when to stop them.</p>`,
        `${button('PLAY RESPONSE INHIBITION AGAIN', 'game2-replay')}${button('START FROM GAME 1', 'restart', 'secondary')}`
      )
    );
  }

  private showSettings(): void {
    this.showScreen(
      screenShell(
        'FACILITATOR SETTINGS',
        `<div class="settings-form">${renderSettingsForm(this.config)}</div><p class="fine-print">Debug settings change this local session only.</p>`,
        `${button('APPLY SETTINGS', 'apply-settings')}${button('RESEARCH-LIKE MODE', 'research-mode', 'secondary')}${button('RESET TO DEFAULTS', 'reset-settings', 'secondary')}${button('BACK', 'home', 'secondary')}`
      )
    );
  }

  private applySettingsFromForm(): void {
    const inputs = Array.from(this.screen.querySelectorAll<HTMLInputElement>('input[name]'));
    const next = { ...this.config };
    for (const input of inputs) {
      const key = input.name as keyof GameConfig;
      next[key] = Number(input.value) as never;
    }
    this.config = next;
    this.trialEngine = new TrialEngine(this.config);
    this.showHome();
  }

  private setMode(mode: GameMode): void {
    this.config = cloneConfig(mode === 'research-like' ? RESEARCH_LIKE_CONFIG : DEFAULT_CONFIG);
    this.trialEngine = new TrialEngine(this.config);
    this.showSettings();
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'home') this.showHome();
    if (action === 'intro') this.showIntro();
    if (action === 'game1-instructions') this.showGame1Instructions();
    if (action === 'game1-practice') this.startGame1(true);
    if (action === 'game1-scored' || action === 'game1-start') this.startGame1(false);
    if (action === 'transition') this.showTransition();
    if (action === 'game2-instructions') this.showGame2Instructions();
    if (action === 'game2-practice') this.startGame2(true);
    if (action === 'game2-scored' || action === 'game2-start') this.startGame2(false);
    if (action === 'education') this.showEducation();
    if (action === 'game2-replay') this.replayGame2Only();
    if (action === 'restart') {
      this.resetFullSession();
    }
    if (action === 'settings') this.showSettings();
    if (action === 'apply-settings') this.applySettingsFromForm();
    if (action === 'research-mode') this.setMode('research-like');
    if (action === 'reset-settings') this.setMode('outreach');
    if (action === 'export-json') this.download('brain-brakes-session.json', exportSessionJson(this.config, this.trials, this.diagnostics));
    if (action === 'export-csv') this.download('brain-brakes-session.csv', exportSessionCsv(this.config, this.trials, this.diagnostics));
  }

  private replayGame2Only(): void {
    this.trials = this.trials.filter((trial) => trial.game !== 2);
    this.diagnostics = { ...this.diagnostics, cueErrorsMs: [] };
    this.currentGame = 2;
    this.practice = true;
    this.currentTrialIndex = 0;
    this.currentPlan = [];
    this.currentSSDms = this.config.initialSSDms;
    this.nextStaircaseMs = this.config.initialSSDms;
    this.activeTrial = undefined;
    this.elapsedMs = 0;
    this.feedbackTitle = '';
    this.feedbackDetail = '';
    this.clearFeedbackTimer();
    this.input.reset();
    this.showGame2Instructions();
  }

  private resetFullSession(): void {
    this.trials = [];
    this.diagnostics = { frameIntervals: [], cueErrorsMs: [] };
    this.currentGame = 1;
    this.practice = true;
    this.currentTrialIndex = 0;
    this.currentPlan = [];
    this.currentSSDms = this.config.initialSSDms;
    this.nextStaircaseMs = this.config.initialSSDms;
    this.activeTrial = undefined;
    this.elapsedMs = 0;
    this.feedbackTitle = '';
    this.feedbackDetail = '';
    this.inputMethod = 'unknown';
    this.clearFeedbackTimer();
    this.input.reset();
    this.showHome();
  }

  private invalidateActiveTrial(reason: string): void {
    if ((this.trialState !== 'collecting' && this.trialState !== 'animating') || !this.activeTrial) return;
    this.trials.push(this.trialEngine.invalidate(this.activeTrial, reason));
    this.feedbackTitle = 'Trial paused - try that one again.';
    this.feedbackDetail = reason;
    this.trialState = 'paused';
    this.input.reset();
    this.feedbackTimer = window.setTimeout(() => this.prepareReadyState(), this.config.postTrialFeedbackMs);
  }

  private feedbackFor(trial: TrialData): string {
    if (!trial.valid) return 'TRY AGAIN';
    if (trial.trialType === 'inhibition') return trial.inhibitionSuccess ? 'NICE!' : 'DID NOT NEED TO JUMP';
    if (trial.signedErrorMs === undefined) return 'TRY AGAIN';
    const error = Math.abs(trial.signedErrorMs);
    if (error <= 20) return 'PERFECT TIMING';
    if (error <= 40) return 'GREAT';
    if (error <= 70) return 'CLOSE';
    if (error <= 100) return 'NEARLY';
    return trial.signedErrorMs < 0 ? 'TOO EARLY' : 'TOO LATE';
  }

  private detailFor(trial: TrialData): string {
    if (!trial.valid) return trial.invalidReason ?? 'That trial was not counted.';
    if (trial.trialType === 'inhibition') {
      return trial.inhibitionSuccess
        ? 'You kept running.'
        : 'The hurdle had already fallen.';
    }
    const error = Math.round(Math.abs(trial.signedErrorMs ?? 0));
    const direction = (trial.signedErrorMs ?? 0) < 0 ? 'EARLY' : 'LATE';
    return `${error} ms ${direction}`;
  }

  private athleteState(): AthleteState {
    if (this.trialState === 'ready') return 'ready';
    if (this.trialState === 'feedback' || this.trialState === 'paused') {
      if (this.activeTrial?.releaseTimeMs !== undefined) return 'landing';
      if (this.activeTrial?.trialType === 'inhibition') return 'continue_running';
      return 'finish';
    }
    if (!this.activeTrial?.releaseTimeMs) {
      return this.trialState === 'collecting' || this.trialState === 'animating' ? 'running' : 'idle';
    }
    const jumpElapsed = this.elapsedMs - this.activeTrial.releaseTimeMs;
    if (jumpElapsed < 180) return 'jump_takeoff';
    if (jumpElapsed < 520) return 'airborne';
    return 'landing';
  }

  private canvasMessage(): string {
    if (this.trialState === 'collecting' || this.trialState === 'animating') return '';
    return this.feedbackTitle || 'HOLD SPACE TO RUN';
  }

  private canvasSubMessage(): string {
    if (this.trialState === 'collecting' || this.trialState === 'animating') return '';
    return this.feedbackDetail;
  }

  private currentRenderState() {
    return {
      elapsedMs: this.elapsedMs,
      athleteState: this.athleteState(),
      trialType: this.activeTrial?.trialType,
      releaseTimeMs: this.activeTrial?.releaseTimeMs,
      cueElapsedMs: this.activeTrial?.actualCuePresentationTime
        ? this.activeTrial.actualCuePresentationTime - this.activeTrial.trialStartTimestamp
        : undefined,
      collapseProgress: this.activeTrial ? collapseProgress(this.activeTrial, this.elapsedMs) : 0,
      hurdleState: this.activeTrial?.hurdleState ?? 'upright',
      message: this.canvasMessage(),
      subMessage: this.canvasSubMessage(),
      progressLabel: this.progressLabel(),
      invalid: this.trialState === 'paused'
    };
  }

  private progressLabel(): string {
    if (this.trialState === 'menu') return '';
    const total = this.currentPlan.length;
    return `${Math.min(this.currentTrialIndex + 1, total)} / ${total}`;
  }

  private debugSnapshot(timestamp: number): DebugSnapshot {
    const frameDelta = this.lastFrameTimestamp ? timestamp - this.lastFrameTimestamp : 0;
    const scene = this.renderer.getSceneDebugMetrics();
    return {
      currentGame: String(this.currentGame),
      trialNumber: this.progressLabel() || '-',
      trialType: this.activeTrial?.trialType ?? '-',
      gameState: this.trialState,
      elapsedTime: `${Math.round(this.elapsedMs)} ms`,
      releaseTime: this.activeTrial?.releaseTimeMs ? `${Math.round(this.activeTrial.releaseTimeMs)} ms` : '-',
      targetTime: `${this.config.targetTimeMs} ms`,
      scheduledSSD: this.activeTrial?.scheduledSSDms ? `${this.activeTrial.scheduledSSDms} ms` : '-',
      actualCueOnset: this.activeTrial?.actualCuePresentationTime
        ? `${Math.round(this.activeTrial.actualCuePresentationTime - this.activeTrial.trialStartTimestamp)} ms`
        : '-',
      collapseTriggered: String(this.activeTrial?.collapseTriggered ?? false),
      hurdleState: this.activeTrial?.hurdleState ?? 'upright',
      currentStaircase: `${this.currentSSDms} ms`,
      nextStaircase: `${this.nextStaircaseMs} ms`,
      takeoffX: `${scene.takeoffX.toFixed(1)} px`,
      hurdleX: `${scene.hurdleX.toFixed(1)} px`,
      hurdleDistance: `${scene.distancePx.toFixed(1)} px`,
      hurdleDistancePercent: `${scene.distanceAsPercentOfWidth.toFixed(1)}%`,
      inputState: this.inputMethod,
      validity: this.activeTrial?.valid === false ? 'invalid' : 'valid',
      frameDelta: `${frameDelta.toFixed(1)} ms`
    };
  }

  private showScreen(html: string): void {
    this.screen.innerHTML = html;
    this.screen.hidden = false;
    this.touchButton.classList.remove('visible');
  }

  private hideScreen(): void {
    this.screen.hidden = true;
    this.touchButton.classList.add('visible');
  }

  private clearFeedbackTimer(): void {
    if (this.feedbackTimer) window.clearTimeout(this.feedbackTimer);
  }

  private download(filename: string, contents: string): void {
    const blob = new Blob([contents], { type: filename.endsWith('.json') ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private playSound(kind: 'start' | 'success' | 'land' | 'clatter'): void {
    if (localStorage.getItem('brain-brakes-muted') === '1') return;
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies = { start: 180, success: 620, land: 240, clatter: 110 };
    oscillator.frequency.value = frequencies[kind];
    oscillator.type = kind === 'clatter' ? 'sawtooth' : 'sine';
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
