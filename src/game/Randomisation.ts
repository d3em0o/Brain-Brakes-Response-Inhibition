import type { TrialType } from '../data/types';

export function createGame2Plan(goTrials: number, inhibitionTrials: number, random = Math.random): TrialType[] {
  if (goTrials < 2) throw new Error('Game 2 plan needs at least two GO trials.');
  const tail: TrialType[] = [
    ...Array.from({ length: goTrials - 2 }, () => 'go' as const),
    ...Array.from({ length: inhibitionTrials }, () => 'inhibition' as const)
  ];

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const plan: TrialType[] = ['go', 'go', ...shuffle(tail, random)];
    if (!hasThreeInhibitionInARow(plan)) return plan;
  }

  return createSpacedPlan(goTrials, inhibitionTrials);
}

export function createPracticePlan(totalTrials: number): TrialType[] {
  const shortPractice: TrialType[] = ['go', 'go', 'inhibition', 'go', 'inhibition'];
  if (totalTrials <= shortPractice.length) return shortPractice.slice(0, totalTrials);
  return Array.from({ length: totalTrials }, (_, index) => (index % 4 === 3 ? 'inhibition' : 'go'));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function hasThreeInhibitionInARow(plan: TrialType[]): boolean {
  return plan.some(
    (trial, index) =>
      index >= 2 &&
      trial === 'inhibition' &&
      plan[index - 1] === 'inhibition' &&
      plan[index - 2] === 'inhibition'
  );
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
