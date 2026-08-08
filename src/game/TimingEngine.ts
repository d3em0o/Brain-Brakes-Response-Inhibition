export interface TrialClock {
  trialStartTimestamp: number;
  now(): number;
  elapsed(): number;
}

export class TimingEngine {
  now(): number {
    return performance.now();
  }

  startTrial(timestamp = this.now()): TrialClock {
    return {
      trialStartTimestamp: timestamp,
      now: () => this.now(),
      elapsed: () => this.now() - timestamp
    };
  }

  elapsedSince(startTimestamp: number, timestamp = this.now()): number {
    return timestamp - startTimestamp;
  }
}
