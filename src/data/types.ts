export type GameId = 1 | 2;
export type TrialType = 'go' | 'inhibition';
export type InputMethod = 'keyboard' | 'touch' | 'unknown';
export type HurdleState = 'upright' | 'collapsing' | 'fallen';
export type AthleteState =
  | 'idle'
  | 'ready'
  | 'running'
  | 'jump_takeoff'
  | 'airborne'
  | 'landing'
  | 'continue_running'
  | 'finish';

export interface TrialRuntime {
  trialIndex: number;
  game: GameId;
  trialType: TrialType;
  practice: boolean;
  trialStartTimestamp: number;
  scheduledSSDms: number | null;
  actualCuePresentationTime: number | null;
  collapseTriggered: boolean;
  hurdleState: HurdleState;
  releaseTimestamp?: number;
  releaseTimeMs?: number;
  valid: boolean;
  invalidReason?: string;
  inputMethod: InputMethod;
}

export interface TrialData extends TrialRuntime {
  targetTimeMs: number;
  signedErrorMs?: number;
  absoluteErrorMs?: number;
  timingErrorMs?: number | null;
  jumped?: boolean;
  correct?: boolean;
  withinResearchSuccessWindow?: boolean;
  inhibitionSuccess?: boolean;
  releasedBeforeCue?: boolean;
  ssdAfterTrialMs?: number;
  points: number;
}

export interface Game1Summary {
  count: number;
  jumpAttemptCount: number;
  noResponseCount: number;
  meanReleaseTimeMs: number | null;
  medianReleaseTimeMs: number | null;
  meanSignedErrorMs: number | null;
  meanAbsoluteErrorMs: number | null;
  medianAbsoluteErrorMs: number | null;
  standardDeviationReleaseMs: number | null;
  bestAbsoluteErrorMs: number | null;
  numberIn700to800Window: number;
  percentageIn700to800Window: number;
  numberEarly: number;
  numberLate: number;
  score: number;
}

export interface Game2Summary {
  goSummary: Game1Summary;
  inhibitionTrials: number;
  inhibitionSuccesses: number;
  inhibitionSuccessPercent: number;
  falseJumps: number;
  meanSSDms: number;
  estimatedSSRTms: number;
  score: number;
  warnings: string[];
}

export interface TimingDiagnostics {
  frameIntervals: number[];
  cueErrorsMs: number[];
}
