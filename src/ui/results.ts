import type { Game1Summary, Game2Summary, TrialData } from '../data/types';
import type { GameComparisonSummary } from '../analysis/gameComparison';
import type { GameConfig } from '../data/config';

export function timingLine(trials: TrialData[], config: GameConfig): string {
  const releaseTimes = trials
    .filter((trial) => trial.valid && !trial.practice && trial.trialType === 'go' && trial.releaseTimeMs !== undefined)
    .map((trial) => trial.releaseTimeMs as number);
  const plottedValues = [config.goodWindowStartMs, config.goodWindowEndMs, config.targetTimeMs, ...releaseTimes];
  const farthestFromTarget = Math.max(...plottedValues.map((value) => Math.abs(value - config.targetTimeMs)));
  const halfRange = Math.ceil(Math.max(150, farthestFromTarget + 60) / 50) * 50;
  const scaleMin = config.targetTimeMs - halfRange;
  const scaleMax = config.targetTimeMs + halfRange;

  const valueToLeft = (value: number): number => Math.max(0, Math.min(100, ((value - scaleMin) / (scaleMax - scaleMin)) * 100));
  const formatPercent = (value: number): string => Number(value.toFixed(4)).toString();
  const usedLefts: number[] = [];
  const markers = releaseTimes
    .map((releaseTime) => {
      const left = valueToLeft(releaseTime);
      const nearby = usedLefts.filter((usedLeft) => Math.abs(usedLeft - left) < 2.4).length;
      usedLefts.push(left);
      const top = [50, 36, 64, 24, 76][nearby % 5];
      return `<span class="timing-dot" style="left:${formatPercent(left)}%;top:${top}%"></span>`;
    })
    .join('');
  const windowLeft = valueToLeft(config.goodWindowStartMs);
  const windowRight = valueToLeft(config.goodWindowEndMs);
  const targetLeft = valueToLeft(config.targetTimeMs);

  return `
    <div class="timing-line" aria-label="Timing line from earlier to later">
      <span class="timing-window" style="left:${formatPercent(windowLeft)}%;width:${formatPercent(windowRight - windowLeft)}%"></span>
      <span class="timing-window-label" style="left:${formatPercent(windowLeft + (windowRight - windowLeft) / 2)}%">Great Timing!</span>
      <span class="timing-target" style="left:${formatPercent(targetLeft)}%"><span>800 ms</span></span>
      ${markers}
    </div>
    <div class="timing-labels">
      <span>EARLIER</span>
      <span>LATER</span>
    </div>
    <p class="timing-help">Closer to the middle line = better timing!</p>
  `;
}

export function renderGame1Results(summary: Game1Summary, trials: TrialData[], config: GameConfig): string {
  return `
    <section class="result-grid">
      <article class="stat-primary">
        <span>YOUR TIMING</span>
        <strong>${formatMsOff(summary.meanAbsoluteErrorMs)}</strong>
        <small>Your average distance from a perfect jump</small>
      </article>
      <article><span>BEST JUMP</span><strong>${formatMsOff(summary.bestAbsoluteErrorMs)}</strong><small>Your closest jump!</small></article>
      <article><span>STEADINESS</span><strong>${formatMs(summary.standardDeviationReleaseMs)}</strong><small>How similar your jump timings were</small></article>
      <article><span>ON TARGET</span><strong>${summary.percentageInTargetWindow}%</strong><small>${formatOutOf(summary.numberInTargetWindow, summary.count)} jumps close to the middle line!</small></article>
    </section>
    ${timingLine(trials, config)}
  `;
}

export function renderGame2Results(summary: Game2Summary, comparison: GameComparisonSummary): string {
  return `
    <section class="result-grid">
      <article class="stat-primary">
        <span>STOP SCORE</span>
        <strong>${summary.inhibitionSuccessPercent}%</strong>
        <small>You stopped for ${formatOutOf(summary.inhibitionSuccesses, summary.inhibitionTrials)} falling hurdles!</small>
      </article>
      <article><span>JUMP ACCURACY</span><strong>${summary.goSummary.percentageInTargetWindow}%</strong><small>${formatOutOf(summary.goSummary.numberInTargetWindow, summary.goSummary.count)} normal jumps on target!</small></article>
      <article><span>STEADINESS</span><strong>${formatMs(summary.goSummary.standardDeviationReleaseMs)}</strong><small>How steady your jump timing was</small></article>
      <article><span>GAME SCORE</span><strong class="stat-value-compact">${summary.score} points</strong><small>Your total points!</small></article>
    </section>
    <section class="comparison-panel">
      <h2>COMPARE YOUR PERFORMANCE</h2>
      <div class="comparison-stats">
        <article>
          <span>NORMAL ROUND</span>
          <strong>${formatMsOff(comparison.baselineMeanAbsoluteErrorMs)}</strong>
          <small>${comparison.baselineAccuracyPercent}% on target</small>
          <small>Your jumps before the tricks!</small>
        </article>
        <article>
          <span>TRICK ROUND</span>
          <strong>${formatMsOff(comparison.fakeoutGoMeanAbsoluteErrorMs)}</strong>
          <small>${comparison.fakeoutGoAccuracyPercent}% on target</small>
          <small>Your jumps with surprise hurdles!</small>
        </article>
        <article>
          <span>WHAT CHANGED?</span>
          <strong>${formatSignedMsOff(comparison.differenceMs)}</strong>
          <small>On target: ${comparison.baselineAccuracyPercent}% -> ${comparison.fakeoutGoAccuracyPercent}%</small>
          <small>See how your jumping changed!</small>
        </article>
      </div>
    </section>
  `;
}

function formatMs(value: number | null): string {
  return value === null ? 'N/A' : `${value} ms`;
}

function formatMsOff(value: number | null): string {
  return value === null ? 'N/A' : `${value} ms off`;
}

function formatSignedMsOff(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value} ms off`;
}

function formatOutOf(value: number, total: number): string {
  return `${value} out of ${total}`;
}
