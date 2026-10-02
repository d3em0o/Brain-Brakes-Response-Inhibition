import type { Game1Summary, Game2Summary, TrialData } from '../data/types';
import type { GameComparisonSummary } from '../analysis/gameComparison';

export function timingLine(trials: TrialData[], targetTimeMs: number): string {
  const markers = trials
    .filter((trial) => trial.valid && !trial.practice && trial.trialType === 'go' && trial.releaseTimeMs !== undefined)
    .map((trial) => {
      const left = Math.max(0, Math.min(100, ((trial.releaseTimeMs as number) - 500) / 600 * 100));
      return `<span class="timing-dot" style="left:${left}%"></span>`;
    })
    .join('');
  const targetLeft = ((targetTimeMs - 500) / 600) * 100;
  return `
    <div class="timing-line" aria-label="Timing line from early to late">
      <span class="timing-target" style="left:${targetLeft}%"><span>800 ms</span></span>
      ${markers}
    </div>
    <div class="timing-labels"><span>EARLY</span><span>TARGET</span><span>LATE</span></div>
  `;
}

export function renderGame1Results(summary: Game1Summary, trials: TrialData[], targetTimeMs: number): string {
  return `
    <section class="result-grid">
      <article class="stat-primary">
        <span>YOUR JUMP TIMING</span>
        <strong>${formatMs(summary.meanAbsoluteErrorMs)}</strong>
        <small>average timing error from ${summary.jumpAttemptCount} jump attempts</small>
      </article>
      <article><span>BEST JUMP</span><strong>${formatMs(summary.bestAbsoluteErrorMs)}</strong><small>away</small></article>
      <article><span>CONSISTENCY</span><strong>${summary.standardDeviationReleaseMs === null ? 'N/A' : `+/-${summary.standardDeviationReleaseMs} ms`}</strong><small>release spread</small></article>
      <article><span>NORMAL JUMP ACCURACY</span><strong>${summary.percentageIn700to800Window}%</strong><small>${summary.numberIn700to800Window} / ${summary.count} normal hurdles on target</small></article>
    </section>
    ${timingLine(trials, targetTimeMs)}
  `;
}

export function renderGame2Results(summary: Game2Summary, comparison: GameComparisonSummary): string {
  return `
    <section class="result-grid">
      <article class="stat-primary">
        <span>INHIBITION ACCURACY</span>
        <strong>${summary.inhibitionSuccessPercent}%</strong>
        <small>${summary.inhibitionSuccesses} / ${summary.inhibitionTrials} falling hurdles correctly ignored</small>
      </article>
      <article><span>NORMAL JUMP ACCURACY</span><strong>${summary.goSummary.percentageIn700to800Window}%</strong><small>${summary.goSummary.numberIn700to800Window} / ${summary.goSummary.count} normal hurdles on target</small></article>
      <article><span>FALSE JUMPS</span><strong>${summary.falseJumps}</strong><small>jumped when the hurdle fell</small></article>
      <article><span>GAME SCORE</span><strong>${summary.score}</strong><small>points</small></article>
    </section>
    <section class="comparison-panel">
      <h2>COMPARE YOUR PERFORMANCE</h2>
      <div class="comparison-stats">
        <article><span>BEFORE FAKE-OUTS</span><strong>${formatMs(comparison.baselineMeanAbsoluteErrorMs)}</strong><small>${comparison.baselineAccuracyPercent}% on target - ${comparison.baselineOnTargetCount} / ${comparison.baselineCount} normal hurdles</small></article>
        <article><span>DURING FAKE-OUTS</span><strong>${formatMs(comparison.fakeoutGoMeanAbsoluteErrorMs)}</strong><small>${comparison.fakeoutGoAccuracyPercent}% on target - ${comparison.fakeoutOnTargetCount} / ${comparison.fakeoutGoCount} normal hurdles</small></article>
        <article><span>CHANGE WITH FAKE-OUTS</span><strong>${formatSignedMs(comparison.differenceMs)}</strong><small>${formatSignedPercentagePoints(comparison.accuracyDifferencePercentagePoints)} accuracy</small></article>
      </div>
    </section>
  `;
}

function formatMs(value: number | null): string {
  return value === null ? 'N/A' : `${value} ms`;
}

function formatSignedMs(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value} ms`;
}

function formatSignedPercentagePoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${value} percentage points`;
}
