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
  withinResearchSuccessWindow?: boolean;
  inhibitionSuccess?: boolean;
  releasedBeforeCue?: boolean;
  ssdAfterTrialMs?: number;
  points: number;
}

export interface Game1Summary {
  count: number;
  meanReleaseTimeMs: number;
  medianReleaseTimeMs: number;
  meanSignedErrorMs: number;
  meanAbsoluteErrorMs: number;
  medianAbsoluteErrorMs: number;
  standardDeviationReleaseMs: number;
  bestAbsoluteErrorMs: number;
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
  meanSSDms: number;
  estimatedSSRTms: number;
  score: number;
  warnings: string[];
}

export interface TimingDiagnostics {
  frameIntervals: number[];
  cueErrorsMs: number[];
}
