import type { Game1Summary, TrialData } from '../data/types';
import type { GameConfig } from '../data/config';
import { mean, median, roundMs, standardDeviation } from './statistics';

export function scoreGoTrial(absoluteErrorMs?: number): number {
  if (absoluteErrorMs === undefined) return 0;
  if (absoluteErrorMs <= 20) return 100;
  if (absoluteErrorMs <= 40) return 75;
  if (absoluteErrorMs <= 70) return 50;
  if (absoluteErrorMs <= 100) return 25;
  return 10;
}

export function categorizeGoTrial(signedErrorMs?: number): string {
  if (signedErrorMs === undefined) return 'TRY AGAIN';
  const error = Math.abs(signedErrorMs);
  if (error <= 20) return 'PERFECT TIMING';
  if (error <= 40) return 'GREAT';
  if (error <= 70) return 'CLOSE';
  if (error <= 100) return 'NEARLY';
  return signedErrorMs < 0 ? 'TOO EARLY' : 'TOO LATE';
}

export function completeGoTrial(trial: TrialData, config: GameConfig): TrialData {
  if (trial.releaseTimeMs === undefined) {
    return { ...trial, valid: false, points: 0 };
  }

  const signedErrorMs = trial.releaseTimeMs - config.targetTimeMs;
  const absoluteErrorMs = Math.abs(signedErrorMs);
  const withinResearchSuccessWindow =
    trial.releaseTimeMs >= config.goodWindowStartMs && trial.releaseTimeMs <= config.goodWindowEndMs;

  return {
    ...trial,
    targetTimeMs: config.targetTimeMs,
    signedErrorMs,
    absoluteErrorMs,
    withinResearchSuccessWindow,
    points: scoreGoTrial(absoluteErrorMs)
  };
}

export function summarizeGame1(trials: TrialData[], config: GameConfig): Game1Summary {
  const validTrials = trials.filter(
    (trial) => trial.valid && !trial.practice && trial.trialType === 'go' && trial.releaseTimeMs !== undefined
  );
  const releaseTimes = validTrials.map((trial) => trial.releaseTimeMs as number);
  const signedErrors = validTrials.map((trial) => trial.signedErrorMs ?? (trial.releaseTimeMs as number) - config.targetTimeMs);
  const absoluteErrors = signedErrors.map(Math.abs);
  const inWindow = validTrials.filter((trial) => trial.withinResearchSuccessWindow).length;
  const count = validTrials.length;

  return {
    count,
    meanReleaseTimeMs: roundMs(mean(releaseTimes)),
    medianReleaseTimeMs: roundMs(median(releaseTimes)),
    meanSignedErrorMs: roundMs(mean(signedErrors)),
    meanAbsoluteErrorMs: roundMs(mean(absoluteErrors)),
    medianAbsoluteErrorMs: roundMs(median(absoluteErrors)),
    standardDeviationReleaseMs: roundMs(standardDeviation(releaseTimes)),
    bestAbsoluteErrorMs: count ? roundMs(Math.min(...absoluteErrors)) : 0,
    numberIn700to800Window: inWindow,
    percentageIn700to800Window: count ? roundMs((inWindow / count) * 100) : 0,
    numberEarly: signedErrors.filter((error) => error < 0).length,
    numberLate: signedErrors.filter((error) => error > 0).length,
    score: validTrials.reduce((sum, trial) => sum + trial.points, 0)
  };
}
