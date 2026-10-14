import type { Game1Summary, Game2Summary, TrialData } from '../data/types';
import type { GameComparisonSummary } from '../analysis/gameComparison';
import type { GameConfig } from '../data/config';

export function timingLine(trials: TrialData[], config: GameConfig): string {
  const releaseTimes = trials
    .filter((trial) => trial.valid && !trial.practice && trial.trialType === 'go' && trial.releaseTimeMs !== undefined)
    .map((trial) => trial.releaseTimeMs as number);
  const scaleMin = Math.min(500, config.goodWindowStartMs - 100, ...releaseTimes);
  const scaleMax = Math.max(1100, config.goodWindowEndMs + 100, ...releaseTimes);
  const valueToLeft = (value: number): number => Math.max(0, Math.min(100, ((value - scaleMin) / (scaleMax - scaleMin)) * 100));
  const markers = releaseTimes
    .map((releaseTime) => `<span class="timing-dot" style="left:${valueToLeft(releaseTime)}%"></span>`)
    .join('');
  const windowLeft = valueToLeft(config.goodWindowStartMs);
  const windowRight = valueToLeft(config.goodWindowEndMs);
  const targetLeft = valueToLeft(config.targetTimeMs);
  return `
    <div class="timing-line" aria-label="Timing line from early to late">
      <span class="timing-window" style="left:${windowLeft}%;width:${windowRight - windowLeft}%"></span>
      <span class="timing-window-label" style="left:${windowLeft + (windowRight - windowLeft) / 2}%">On Target</span>
      <span class="timing-target" style="left:${targetLeft}%"><span>Ideal Jump</span></span>
      ${markers}
    </div>
    <div class="timing-labels">
      <span>EARLY</span>
      <span>${config.goodWindowStartMs}-${config.goodWindowEndMs} ms window</span>
      <span>LATE</span>
    </div>
  `;
}

export function renderGame1Results(summary: Game1Summary, trials: TrialData[], config: GameConfig): string {
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
    ${timingLine(trials, config)}
  `;
}

export function renderGame2Results(summary: Game2Summary, comparison: GameComparisonSummary): string {
  const windowLabel = timingWindowLabel(comparison);
  return `
    <section class="result-grid">
      <article class="stat-primary">
        <span>INHIBITION ACCURACY</span>
        <strong>${summary.inhibitionSuccessPercent}%</strong>
        <small>${summary.inhibitionSuccesses} / ${summary.inhibitionTrials} STOP trials successfully inhibited</small>
      </article>
      <article><span>JUMP CONSISTENCY</span><strong>${formatMs(summary.goSummary.standardDeviationReleaseMs)}</strong><small>variation in GO jump timing (SD)</small></article>
      <article><span>STOP-CUE DELAY</span><strong>${formatMs(summary.meanStopCueDelayMs)}</strong><small>average falling-hurdle cue after run start</small></article>
      <article><span>JUMP TIMING BIAS</span><strong class="stat-value-compact">${formatBias(summary.goSummary.meanSignedErrorMs)}</strong><small>average early or late tendency</small></article>
    </section>
    <section class="comparison-panel">
      <h2>COMPARE YOUR PERFORMANCE</h2>
      <div class="comparison-stats">
        <article>
          <span>BEFORE FAKE-OUTS</span>
          <strong>${formatMs(comparison.baselineMeanAbsoluteErrorMs)}</strong>
          <small>mean absolute jump timing error</small>
          <small>${comparison.baselineAccuracyPercent}% on target - ${comparison.baselineOnTargetCount} / ${comparison.baselineCount} eligible GO trials</small>
          <small>${windowLabel}</small>
        </article>
        <article>
          <span>DURING FAKE-OUTS</span>
          <strong>${formatMs(comparison.fakeoutGoMeanAbsoluteErrorMs)}</strong>
          <small>mean absolute jump timing error</small>
          <small>${comparison.fakeoutGoAccuracyPercent}% on target - ${comparison.fakeoutOnTargetCount} / ${comparison.fakeoutGoCount} eligible GO trials</small>
          <small>${windowLabel}</small>
        </article>
        <article>
          <span>CHANGE WITH FAKE-OUTS</span>
          <strong>${formatSignedMs(comparison.differenceMs)}</strong>
          <small>${formatSignedPercentagePoints(comparison.accuracyDifferencePercentagePoints)} on-target accuracy</small>
          <small>change in performance</small>
        </article>
      </div>
      <p class="comparison-note">On target = jump executed within the acceptable timing window.</p>
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

function formatBias(value: number | null): string {
  if (value === null) return 'N/A';
  if (value === 0) return '0 ms (On target)';
  return `${value > 0 ? '+' : ''}${value} ms (${value < 0 ? 'Early' : 'Late'})`;
}

function formatSignedPercentagePoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${value} percentage points`;
}

function timingWindowLabel(comparison: GameComparisonSummary): string {
  return `Target: ${comparison.targetTimeMs} ms; window: ${comparison.windowStartMs}-${comparison.windowEndMs} ms`;
}
