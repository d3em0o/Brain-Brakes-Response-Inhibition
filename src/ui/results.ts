import type { Game1Summary, Game2Summary, TrialData } from '../data/types';
import type { GameComparisonSummary } from '../analysis/gameComparison';

export function timingLine(trials: TrialData[], targetTimeMs: number): string {
  const markers = trials
    .filter((trial) => trial.valid && !trial.practice && trial.releaseTimeMs !== undefined)
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
        <strong>${summary.meanAbsoluteErrorMs} ms</strong>
        <small>average timing error</small>
      </article>
      <article><span>BEST JUMP</span><strong>${summary.bestAbsoluteErrorMs} ms</strong><small>away</small></article>
      <article><span>CONSISTENCY</span><strong>+/-${summary.standardDeviationReleaseMs} ms</strong><small>release spread</small></article>
      <article><span>ON-TARGET JUMPS</span><strong>${summary.numberIn700to800Window} / ${summary.count}</strong><small>700-800 ms</small></article>
    </section>
    ${timingLine(trials, targetTimeMs)}
  `;
}

export function renderGame2Results(summary: Game2Summary, comparison: GameComparisonSummary): string {
  const difference = comparison.differenceMs;
  const differenceLabel =
    Math.abs(difference) <= 5
      ? 'about the same'
      : difference > 0
        ? `${difference} ms less accurate`
        : `${Math.abs(difference)} ms more accurate`;

  return `
    <section class="result-grid">
      <article class="stat-primary">
        <span>BRAIN BRAKES</span>
        <strong>${summary.inhibitionSuccesses} / ${summary.inhibitionTrials}</strong>
        <small>falling hurdles correctly kept running</small>
      </article>
      <article><span>FALLING HURDLES</span><strong>${summary.inhibitionSuccesses} / ${summary.inhibitionTrials}</strong><small>correctly kept running</small></article>
      <article><span>NORMAL JUMPS</span><strong>${summary.goSummary.meanAbsoluteErrorMs} ms</strong><small>average timing error</small></article>
      <article><span>GAME SCORE</span><strong>${summary.score}</strong><small>points</small></article>
    </section>
    <section class="comparison-panel">
      <h2>COMPARE YOUR JUMP TIMING</h2>
      <div class="comparison-stats">
        <article><span>BEFORE FAKE-OUTS</span><strong>${comparison.baselineMeanAbsoluteErrorMs} ms</strong><small>${comparison.baselineOnTargetCount} / ${comparison.baselineCount} on target</small></article>
        <article><span>DURING FAKE-OUTS</span><strong>${comparison.fakeoutGoMeanAbsoluteErrorMs} ms</strong><small>${comparison.fakeoutOnTargetCount} / ${comparison.fakeoutGoCount} on target</small></article>
        <article><span>DIFFERENCE</span><strong>${difference >= 0 ? '+' : ''}${difference} ms</strong><small>${differenceLabel}</small></article>
      </div>
    </section>
  `;
}
