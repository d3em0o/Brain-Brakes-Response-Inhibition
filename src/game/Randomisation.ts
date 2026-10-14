import type { TrialType } from '../data/types';

const DEFAULT_GAME2_PLAN: TrialType[] = [
  'go',
  'go',
  'inhibition',
  'go',
  'go',
  'inhibition',
  'inhibition',
  'go',
  'go',
  'inhibition'
];

export function createGame2Plan(goTrials: number, inhibitionTrials: number, _random = Math.random): TrialType[] {
  if (goTrials === 6 && inhibitionTrials === 4) return [...DEFAULT_GAME2_PLAN];
  if (goTrials < 2) throw new Error('Game 2 plan needs at least two GO trials.');
  return createSpacedPlan(goTrials, inhibitionTrials);
}

export function createPracticePlan(totalTrials: number): TrialType[] {
  const shortPractice: TrialType[] = ['go', 'go', 'inhibition', 'go', 'inhibition'];
  if (totalTrials <= shortPractice.length) return shortPractice.slice(0, totalTrials);
  return Array.from({ length: totalTrials }, (_, index) => (index % 4 === 3 ? 'inhibition' : 'go'));
}

function createSpacedPlan(goTrials: number, inhibitionTrials: number): TrialType[] {
  const tailLength = goTrials + inhibitionTrials - 2;
  const tail: TrialType[] = Array.from({ length: tailLength }, () => 'go');

  for (let stopIndex = 0; stopIndex < inhibitionTrials; stopIndex += 1) {
    const idealPosition = Math.round(((stopIndex + 1) * (tailLength + 1)) / (inhibitionTrials + 1)) - 1;
    const position = nearestOpenPosition(tail, idealPosition);
    tail[position] = 'inhibition';
  }

  return ['go', 'go', ...tail];
}

function nearestOpenPosition(plan: TrialType[], preferredPosition: number): number {
  for (let offset = 0; offset < plan.length; offset += 1) {
    const left = preferredPosition - offset;
    if (left >= 0 && plan[left] === 'go') return left;
    const right = preferredPosition + offset;
    if (right < plan.length && plan[right] === 'go') return right;
  }
  throw new Error('No open trial position available.');
}
