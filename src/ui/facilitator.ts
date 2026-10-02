import type { GameConfig } from '../data/config';
import type { TimingDiagnostics, TrialData } from '../data/types';
import { summarizeGame1 } from '../analysis/game1Analysis';
import { summarizeGame2 } from '../analysis/inhibitionAnalysis';

export interface DebugSnapshot {
  currentGame: string;
  trialNumber: string;
  trialType: string;
  gameState: string;
  elapsedTime: string;
  releaseTime: string;
  targetTime: string;
  scheduledSSD: string;
  actualCueOnset: string;
  collapseTriggered: string;
  hurdleState: string;
  currentStaircase: string;
  nextStaircase: string;
  takeoffX: string;
  hurdleX: string;
  hurdleDistance: string;
  hurdleDistancePercent: string;
  inputState: string;
  validity: string;
  frameDelta: string;
}

export function renderDebugPanel(container: HTMLElement, snapshot: DebugSnapshot): void {
  container.innerHTML = Object.entries(snapshot)
    .map(([key, value]) => `<div><span>${label(key)}</span><strong>${value}</strong></div>`)
    .join('');
}

export function renderSettingsForm(config: GameConfig): string {
  const fields: Array<[keyof GameConfig, string]> = [
    ['game1ScoredTrials', 'Game 1 scored trials'],
    ['game2TotalTrials', 'Game 2 total trials'],
    ['game2GoTrials', 'Game 2 GO trials'],
    ['game2InhibitionTrials', 'Game 2 falling hurdles'],
    ['initialSSDms', 'Initial SSD'],
    ['staircaseStepMs', 'SSD step'],
    ['minSSDms', 'Minimum SSD'],
    ['maxSSDms', 'Maximum SSD'],
    ['targetTimeMs', 'Target time']
  ];

  return fields
    .map(
      ([key, text]) =>
        `<label>${text}<input type="number" min="1" step="1" name="${key}" value="${config[key]}"></label>`
    )
    .join('');
}

export function exportSessionJson(config: GameConfig, trials: TrialData[], diagnostics: TimingDiagnostics): string {
  const game1Summary = summarizeGame1(trials.filter((trial) => trial.game === 1), config);
  const game2Summary = summarizeGame2(trials, config, game1Summary.meanReleaseTimeMs);
  return JSON.stringify(
    {
      sessionDateTime: new Date().toISOString(),
      config,
      facilitatorSummary: {
        game1: game1Summary,
        game2: game2Summary
      },
      trials,
      diagnostics: {
        averageFrameIntervalMs: average(diagnostics.frameIntervals),
        approximateRefreshHz: diagnostics.frameIntervals.length ? 1000 / average(diagnostics.frameIntervals) : null,
        cueErrorsMs: diagnostics.cueErrorsMs
      }
    },
    null,
    2
  );
}

export function exportSessionCsv(config: GameConfig, trials: TrialData[], diagnostics: TimingDiagnostics): string {
  const game1Summary = summarizeGame1(trials.filter((trial) => trial.game === 1), config);
  const game2Summary = summarizeGame2(trials, config, game1Summary.meanReleaseTimeMs);
  const header = [
    'sessionDateTime',
    'game',
    'trialIndex',
    'trialType',
    'practice',
    'valid',
    'jumped',
    'correct',
    'releaseTimeMs',
    'signedErrorMs',
    'absoluteErrorMs',
    'timingErrorMs',
    'scheduledSSDms',
    'actualCuePresentationTime',
    'inhibitionSuccess',
    'points',
    'targetTimeMs',
    'inputMethod',
    'estimatedSSRTms',
    'meanSSDms',
    'averageFrameIntervalMs',
    'config'
  ];
  const sessionDateTime = new Date().toISOString();
  const averageFrameIntervalMs = average(diagnostics.frameIntervals).toFixed(2);
  const rows = trials.map((trial) =>
    [
      sessionDateTime,
      trial.game,
      trial.trialIndex,
      trial.trialType,
      trial.practice,
      trial.valid,
      trial.jumped ?? '',
      trial.correct ?? '',
      trial.releaseTimeMs ?? '',
      trial.signedErrorMs ?? '',
      trial.absoluteErrorMs ?? '',
      trial.timingErrorMs ?? '',
      trial.scheduledSSDms ?? '',
      trial.actualCuePresentationTime ?? '',
      trial.inhibitionSuccess ?? '',
      trial.points,
      trial.targetTimeMs,
      trial.inputMethod,
      game2Summary.estimatedSSRTms,
      game2Summary.meanSSDms,
      averageFrameIntervalMs,
      JSON.stringify(config)
    ]
      .map(csvCell)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function csvCell(value: unknown): string {
  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

function label(key: string): string {
  return key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
}
