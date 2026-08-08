import type { GameConfig } from '../data/config';
import type { GameId, InputMethod, TrialData, TrialRuntime, TrialType } from '../data/types';
import { completeGoTrial } from '../analysis/game1Analysis';
import { completeInhibitionTrial } from '../analysis/inhibitionAnalysis';
import { triggerCollapse } from './CollapseLogic';
import { TimingEngine } from './TimingEngine';

export class TrialEngine {
  private timing: TimingEngine;
  private config: GameConfig;

  constructor(config: GameConfig, timing = new TimingEngine()) {
    this.config = config;
    this.timing = timing;
  }

  startTrial(
    trialIndex: number,
    game: GameId,
    trialType: TrialType,
    practice: boolean,
    inputMethod: InputMethod,
    timestamp = this.timing.now(),
    scheduledSSDms: number | null = null
  ): TrialRuntime {
    const trialSSD = game === 2 && trialType === 'inhibition' ? scheduledSSDms : null;
    return {
      trialIndex,
      game,
      trialType,
      practice,
      trialStartTimestamp: timestamp,
      scheduledSSDms: trialSSD,
      actualCuePresentationTime: null,
      collapseTriggered: false,
      hurdleState: 'upright',
      valid: true,
      inputMethod
    };
  }

  markCuePresented(trial: TrialRuntime, timestamp = this.timing.now(), debug = false): TrialRuntime {
    return triggerCollapse(trial, timestamp, debug);
  }

  recordRelease(trial: TrialRuntime, timestamp = this.timing.now()): TrialRuntime {
    return {
      ...trial,
      releaseTimestamp: timestamp,
      releaseTimeMs: timestamp - trial.trialStartTimestamp
    };
  }

  invalidate(trial: TrialRuntime, reason: string): TrialData {
    return {
      ...trial,
      valid: false,
      invalidReason: reason,
      targetTimeMs: this.config.targetTimeMs,
      points: 0
    };
  }

  completeTrial(trial: TrialRuntime, currentSSDms: number): TrialData {
    const base: TrialData = {
      ...trial,
      targetTimeMs: this.config.targetTimeMs,
      points: 0
    };

    if (trial.trialType === 'inhibition') {
      return completeInhibitionTrial(base, this.config, currentSSDms);
    }

    return completeGoTrial(base, this.config);
  }
}
