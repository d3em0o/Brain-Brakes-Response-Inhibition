export type GameMode = 'outreach' | 'research-like';

export interface GameConfig {
  targetTimeMs: number;
  totalTrialTimeMs: number;
  goodWindowStartMs: number;
  goodWindowEndMs: number;
  game1PracticeTrials: number;
  game1ScoredTrials: number;
  game2PracticeTrials: number;
  game2TotalTrials: number;
  game2GoTrials: number;
  game2InhibitionTrials: number;
  initialSSDms: number;
  minSSDms: number;
  maxSSDms: number;
  staircaseStepMs: number;
  postTrialFeedbackMs: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  targetTimeMs: 800,
  totalTrialTimeMs: 1000,
  goodWindowStartMs: 700,
  goodWindowEndMs: 800,
  game1PracticeTrials: 5,
  game1ScoredTrials: 10,
  game2PracticeTrials: 5,
  game2TotalTrials: 10,
  game2GoTrials: 7,
  game2InhibitionTrials: 3,
  initialSSDms: 550,
  minSSDms: 450,
  maxSSDms: 650,
  staircaseStepMs: 50,
  postTrialFeedbackMs: 650
};

export const RESEARCH_LIKE_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  game1PracticeTrials: 8,
  game1ScoredTrials: 24,
  game2PracticeTrials: 12,
  game2TotalTrials: 80,
  game2GoTrials: 60,
  game2InhibitionTrials: 20,
  initialSSDms: 500,
  minSSDms: 300,
  maxSSDms: 700,
  staircaseStepMs: 50
};

export function cloneConfig(config: GameConfig = DEFAULT_CONFIG): GameConfig {
  return { ...config };
}
