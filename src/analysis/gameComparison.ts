import type { GameConfig } from '../data/config';
import type { TrialData } from '../data/types';
import { summarizeGame1 } from './game1Analysis';

export interface GameComparisonSummary {
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
    baselineMeanAbsoluteErrorMs: baselineSummary.meanAbsoluteErrorMs,
    fakeoutGoMeanAbsoluteErrorMs: fakeoutSummary.meanAbsoluteErrorMs,
    differenceMs:
      baselineSummary.meanAbsoluteErrorMs === null || fakeoutSummary.meanAbsoluteErrorMs === null
        ? null
        : fakeoutSummary.meanAbsoluteErrorMs - baselineSummary.meanAbsoluteErrorMs,
    baselineOnTargetCount: baselineSummary.numberIn700to800Window,
    fakeoutOnTargetCount: fakeoutSummary.numberIn700to800Window,
    baselineCount: baselineSummary.count,
    fakeoutGoCount: fakeoutSummary.count,
    baselineAccuracyPercent: baselineSummary.percentageIn700to800Window,
    fakeoutGoAccuracyPercent: fakeoutSummary.percentageIn700to800Window,
    accuracyDifferencePercentagePoints:
      fakeoutSummary.percentageIn700to800Window - baselineSummary.percentageIn700to800Window
  };
}
