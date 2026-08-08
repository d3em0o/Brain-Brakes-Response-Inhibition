export interface ResearchReference {
  source: string;
  study: string;
  population: string;
  ageMin: number;
  ageMax: number;
  sampleSize: number;
  targetTimeMs: number;
  goOnlyMeanMs: number;
  mixedGoMeanMs: number;
  ssrtMeanMs: number;
  ssrtSDMs: number;
  stopCueMeanMs: number;
  stopSuccessPercent: number;
  protocol: string;
  validatedForCurrentGame: boolean;
}

export const GILBERT_2025_REFERENCE: ResearchReference = {
  source: 'Gilbert et al. 2025',
  study: 'Gilbert et al. 2025',
  population: 'Typically developing children aged 8-12',
  ageMin: 8,
  ageMax: 12,
  sampleSize: 38,
  targetTimeMs: 800,
  goOnlyMeanMs: 790,
  mixedGoMeanMs: 814,
  ssrtMeanMs: 284,
  ssrtSDMs: 48,
  stopCueMeanMs: 528,
  stopSuccessPercent: 61.7,
  protocol: 'Anticipated-response response-inhibition paradigm',
  validatedForCurrentGame: false
};

export interface FutureNormativeMetric {
  metric: string;
  ageGroup: string;
  sampleSize: number;
  mean: number;
  sd?: number;
  percentiles?: Record<string, number>;
}
