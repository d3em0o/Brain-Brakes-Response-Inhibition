import type { Game2Summary, TrialData } from '../data/types';
import type { GameConfig } from '../data/config';
import { clamp, mean, roundMs } from './statistics';
import { summarizeGame1 } from './game1Analysis';

export function nextSSD(currentSSD: number, success: boolean, config: GameConfig): number {
  const delta = success ? config.staircaseStepMs : -config.staircaseStepMs;
  return clamp(currentSSD + delta, config.minSSDms, config.maxSSDms);
}

export function estimateSSRT(meanGoReleaseMs: number, meanSSDms: number): number {
  return Math.max(0, meanGoReleaseMs - meanSSDms);
}

export function completeInhibitionTrial(trial: TrialData, config: GameConfig, currentSSD: number): TrialData {
  const releaseTime = trial.releaseTimeMs;
  const releasedBeforeCue = releaseTime !== undefined && trial.scheduledSSDms !== null && releaseTime < trial.scheduledSSDms;
  const inhibitionSuccess = releaseTime === undefined && trial.valid;
  const next = nextSSD(currentSSD, inhibitionSuccess, config);

  return {
    ...trial,
    jumped: releaseTime !== undefined,
    correct: inhibitionSuccess,
    timingErrorMs: null,
    releasedBeforeCue,
    inhibitionSuccess,
    ssdAfterTrialMs: next,
    points: inhibitionSuccess ? 100 : -50
  };
}

export function summarizeGame2(trials: TrialData[], config: GameConfig, game1MeanReleaseMs?: number | null): Game2Summary {
  const scored = trials.filter((trial) => trial.valid && !trial.practice && trial.game === 2);
  const goSummary = summarizeGame1(scored, config);
  const inhibition = scored.filter((trial) => trial.trialType === 'inhibition');
  const successes = inhibition.filter((trial) => trial.inhibitionSuccess).length;
  const falseJumps = inhibition.filter((trial) => trial.releaseTimeMs !== undefined).length;
  const meanSSDms = roundMs(mean(inhibition.map((trial) => trial.scheduledSSDms ?? 0).filter(Boolean)));
  const meanGo = goSummary.meanReleaseTimeMs ?? game1MeanReleaseMs ?? config.targetTimeMs;
  const estimatedSSRTms = roundMs(estimateSSRT(meanGo, meanSSDms));
  const successPercent = inhibition.length ? roundMs((successes / inhibition.length) * 100) : 0;
  const warnings: string[] = [];

  if (inhibition.length < 6) {
    warnings.push('Not enough trials for a stable stopping estimate.');
  }
  if (inhibition.length && (successPercent < 25 || successPercent > 75)) {
    warnings.push('The challenge may not have settled at the ideal difficulty, so treat this estimate cautiously.');
  }
  if (game1MeanReleaseMs !== null && game1MeanReleaseMs !== undefined && goSummary.meanReleaseTimeMs !== null && goSummary.meanReleaseTimeMs - game1MeanReleaseMs > 120) {
    warnings.push('Looks like you may have started waiting for the hurdle to fall. Try jumping normally unless it actually falls.');
  }

  return {
    goSummary,
    inhibitionTrials: inhibition.length,
    inhibitionSuccesses: successes,
    inhibitionSuccessPercent: successPercent,
    falseJumps,
    meanSSDms,
    estimatedSSRTms,
    score: scored.reduce((sum, trial) => sum + trial.points, 0),
    warnings
  };
}
