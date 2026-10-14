import type { GameConfig } from '../data/config';
import type { TrialData } from '../data/types';
import { summarizeGame1 } from './game1Analysis';

export interface GameComparisonSummary {
  targetTimeMs: number;
  windowStartMs: number;
  windowEndMs: number;
  baselineMeanAbsoluteErrorMs: number | null;
  fakeoutGoMeanAbsoluteErrorMs: number | null;
  differenceMs: number | null;
  baselineOnTargetCount: number;
  fakeoutOnTargetCount: number;
  baselineCount: number;
  fakeoutGoCount: number;
  baselineAccuracyPercent: number;
  fakeoutGoAccuracyPercent: number;
  accuracyDifferencePercentagePoints: number;
}

export function calculateGameComparison(trials: TrialData[], config: GameConfig): GameComparisonSummary {
  const baseline = trials.filter((trial) => trial.game === 1 && trial.valid && !trial.practice);
  const fakeoutGo = trials.filter(
    (trial) => trial.game === 2 && trial.trialType === 'go' && trial.valid && !trial.practice
  );
  const baselineSummary = summarizeGame1(baseline, config);
  const fakeoutSummary = summarizeGame1(fakeoutGo, config);

  return {
    targetTimeMs: config.targetTimeMs,
    windowStartMs: config.goodWindowStartMs,
    windowEndMs: config.goodWindowEndMs,
    baselineMeanAbsoluteErrorMs: baselineSummary.meanAbsoluteErrorMs,
    fakeoutGoMeanAbsoluteErrorMs: fakeoutSummary.meanAbsoluteErrorMs,
    differenceMs:
      baselineSummary.meanAbsoluteErrorMs === null || fakeoutSummary.meanAbsoluteErrorMs === null
        ? null
        : fakeoutSummary.meanAbsoluteErrorMs - baselineSummary.meanAbsoluteErrorMs,
    baselineOnTargetCount: baselineSummary.numberInTargetWindow,
    fakeoutOnTargetCount: fakeoutSummary.numberInTargetWindow,
    baselineCount: baselineSummary.count,
    fakeoutGoCount: fakeoutSummary.count,
    baselineAccuracyPercent: baselineSummary.percentageInTargetWindow,
    fakeoutGoAccuracyPercent: fakeoutSummary.percentageInTargetWindow,
    accuracyDifferencePercentagePoints:
      fakeoutSummary.percentageInTargetWindow - baselineSummary.percentageInTargetWindow
  };
}
