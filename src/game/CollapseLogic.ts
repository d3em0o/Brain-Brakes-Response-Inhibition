import type { HurdleState, TrialRuntime } from '../data/types';

export const COLLAPSE_DURATION_MS = 140;

export function triggerCollapse(trial: TrialRuntime, timestamp: number, debug = false): TrialRuntime {
  if (trial.trialType !== 'inhibition') {
    if (debug) console.error('BUG: collapse attempted during GO trial');
    return { ...trial, scheduledSSDms: null, actualCuePresentationTime: null, collapseTriggered: false, hurdleState: 'upright' };
  }

  if (trial.scheduledSSDms === null || trial.collapseTriggered) return trial;

  return {
    ...trial,
    actualCuePresentationTime: timestamp,
    collapseTriggered: true,
    hurdleState: 'collapsing'
  };
}

export function hurdleStateFromCue(trial: TrialRuntime, timestamp: number): HurdleState {
  if (!trial.collapseTriggered || trial.actualCuePresentationTime === null) return 'upright';
  return timestamp - trial.actualCuePresentationTime >= COLLAPSE_DURATION_MS ? 'fallen' : 'collapsing';
}

export function collapseProgress(trial: TrialRuntime, elapsedMs: number): number {
  if (trial.trialType !== 'inhibition' || !trial.collapseTriggered || trial.actualCuePresentationTime === null) return 0;
  const cueElapsed = trial.actualCuePresentationTime - trial.trialStartTimestamp;
  if (elapsedMs < cueElapsed) return 0;
  return Math.min(1, Math.max(0.001, (elapsedMs - cueElapsed) / COLLAPSE_DURATION_MS));
}
