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
    return {
      ...trial,
      targetTimeMs: config.targetTimeMs,
      jumped: false,
      correct: false,
      timingErrorMs: null,
      withinResearchSuccessWindow: false,
      points: 0
    };
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
    timingErrorMs: absoluteErrorMs,
    jumped: true,
    correct: withinResearchSuccessWindow,
    withinResearchSuccessWindow,
    points: scoreGoTrial(absoluteErrorMs)
  };
}

export function summarizeGame1(trials: TrialData[], config: GameConfig): Game1Summary {
  const normalTrials = trials.filter((trial) => trial.valid && !trial.practice && trial.trialType === 'go');
  const jumpAttempts = normalTrials.filter((trial) => trial.releaseTimeMs !== undefined);
  const releaseTimes = jumpAttempts.map((trial) => trial.releaseTimeMs as number);
  const signedErrors = jumpAttempts.map((trial) => trial.signedErrorMs ?? (trial.releaseTimeMs as number) - config.targetTimeMs);
  const absoluteErrors = signedErrors.map(Math.abs);
  const inWindow = normalTrials.filter((trial) => trial.withinResearchSuccessWindow).length;
  const count = normalTrials.length;
  const jumpAttemptCount = jumpAttempts.length;

  return {
    count,
    jumpAttemptCount,
    noResponseCount: count - jumpAttemptCount,
    meanReleaseTimeMs: jumpAttemptCount ? roundMs(mean(releaseTimes)) : null,
    medianReleaseTimeMs: jumpAttemptCount ? roundMs(median(releaseTimes)) : null,
    meanSignedErrorMs: jumpAttemptCount ? roundMs(mean(signedErrors)) : null,
    meanAbsoluteErrorMs: jumpAttemptCount ? roundMs(mean(absoluteErrors)) : null,
    medianAbsoluteErrorMs: jumpAttemptCount ? roundMs(median(absoluteErrors)) : null,
    standardDeviationReleaseMs: jumpAttemptCount ? roundMs(standardDeviation(releaseTimes)) : null,
    bestAbsoluteErrorMs: jumpAttemptCount ? roundMs(Math.min(...absoluteErrors)) : null,
    numberIn700to800Window: inWindow,
    percentageIn700to800Window: count ? roundMs((inWindow / count) * 100) : 0,
    numberEarly: signedErrors.filter((error) => error < 0).length,
    numberLate: signedErrors.filter((error) => error > 0).length,
    score: normalTrials.reduce((sum, trial) => sum + trial.points, 0)
  };
}
