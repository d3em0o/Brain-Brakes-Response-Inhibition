import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../data/config';
import type { TrialData } from '../data/types';
import { completeGoTrial, summarizeGame1 } from '../analysis/game1Analysis';
import { completeInhibitionTrial, estimateSSRT, nextSSD, summarizeGame2 } from '../analysis/inhibitionAnalysis';
import { createGame2Plan, createPracticePlan } from '../game/Randomisation';
import { TrialEngine } from '../game/TrialEngine';
import { COLLAPSE_DURATION_MS, collapseProgress, hurdleStateFromCue, triggerCollapse } from '../game/CollapseLogic';
import { SCENE_RATIOS, createSceneLayout } from '../rendering/Track';
import {
  LEFT_SHOULDER,
  RIGHT_SHOULDER,
  RUNNING_ARM_BASE_ANGLE,
  RUNNING_ARM_SWING,
  calculateArmSegment,
  calculateRunningArmPose
} from '../rendering/Runner';
import { calculateGameComparison } from '../analysis/gameComparison';
import { renderGame2Results } from '../ui/results';

describe('Game 1 timing calculations', () => {
  it('starts a trial and records release time from monotonic timestamps', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const trial = engine.startTrial(1, 1, 'go', false, 'keyboard', 1000);
    const released = engine.recordRelease(trial, 1800);
    expect(released.trialStartTimestamp).toBe(1000);
    expect(released.releaseTimestamp).toBe(1800);
    expect(released.releaseTimeMs).toBe(800);
  });

  it('treats 800 ms as zero timing error', () => {
    const trial = goTrial(800);
    expect(trial.signedErrorMs).toBe(0);
    expect(trial.absoluteErrorMs).toBe(0);
  });

  it('labels 760 ms as 40 ms early', () => {
    const trial = goTrial(760);
    expect(trial.signedErrorMs).toBe(-40);
    expect(trial.absoluteErrorMs).toBe(40);
  });

  it('labels 830 ms as 30 ms late', () => {
    const trial = goTrial(830);
    expect(trial.signedErrorMs).toBe(30);
    expect(trial.absoluteErrorMs).toBe(30);
  });

  it('excludes practice and invalid trials from summaries', () => {
    const trials = [goTrial(760), { ...goTrial(900), practice: true }, { ...goTrial(810), valid: false }];
    const summary = summarizeGame1(trials, DEFAULT_CONFIG);
    expect(summary.count).toBe(1);
    expect(summary.meanReleaseTimeMs).toBe(760);
  });

  it('calculates mean and standard deviation for valid scored releases', () => {
    const summary = summarizeGame1([goTrial(700), goTrial(800), goTrial(900)], DEFAULT_CONFIG);
    expect(summary.meanReleaseTimeMs).toBe(800);
    expect(summary.standardDeviationReleaseMs).toBe(82);
  });
});

describe('Game 2 inhibition calculations', () => {
  it('GO trials use the same timing analysis as Game 1', () => {
    const trial = goTrial(775, 2);
    expect(trial.signedErrorMs).toBe(-25);
    expect(trial.withinResearchSuccessWindow).toBe(true);
  });

  it('records scheduled and actual cue timing', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const trial = engine.startTrial(1, 2, 'inhibition', false, 'keyboard', 1000, 500);
    const cued = engine.markCuePresented(trial, 1508);
    expect(cued.scheduledSSDms).toBe(500);
    expect(cued.actualCuePresentationTime).toBe(1508);
    expect(cued.collapseTriggered).toBe(true);
    expect(cued.hurdleState).toBe('collapsing');
  });

  it('counts holding through 1000 ms as successful inhibition', () => {
    const trial = stopTrial(undefined, 500);
    expect(trial.inhibitionSuccess).toBe(true);
    expect(trial.points).toBe(100);
  });

  it('counts release after cue as failed inhibition', () => {
    const trial = stopTrial(650, 500);
    expect(trial.inhibitionSuccess).toBe(false);
    expect(trial.releasedBeforeCue).toBe(false);
  });

  it('subtracts points for failed inhibition without awarding jump timing points', () => {
    const trial = stopTrial(800, 500);
    expect(trial.inhibitionSuccess).toBe(false);
    expect(trial.points).toBe(-50);
    expect(trial.absoluteErrorMs).toBeUndefined();
  });

  it('logs release before cue', () => {
    const trial = stopTrial(450, 500);
    expect(trial.releasedBeforeCue).toBe(true);
  });

  it('moves the staircase up after success and down after failure', () => {
    expect(nextSSD(550, true, DEFAULT_CONFIG)).toBe(600);
    expect(nextSSD(550, false, DEFAULT_CONFIG)).toBe(500);
  });

  it('keeps SSD inside configured bounds', () => {
    expect(nextSSD(650, true, DEFAULT_CONFIG)).toBe(650);
    expect(nextSSD(450, false, DEFAULT_CONFIG)).toBe(450);
  });

  it('creates exactly 7 GO and 3 inhibition trials with two initial GO trials', () => {
    const plan = createGame2Plan(7, 3, seededRandom(1));
    expect(plan).toHaveLength(10);
    expect(plan.filter((trial) => trial === 'go')).toHaveLength(7);
    expect(plan.filter((trial) => trial === 'inhibition')).toHaveLength(3);
    expect(plan[0]).toBe('go');
    expect(plan[1]).toBe('go');
  });

  it('prevents more than two inhibition trials consecutively', () => {
    const plan = createGame2Plan(7, 3, () => 0);
    expect(plan.join('')).not.toContain('inhibitioninhibitioninhibition');
  });

  it('keeps Game 2 practice to five short attempts', () => {
    expect(createPracticePlan(DEFAULT_CONFIG.game2PracticeTrials)).toEqual(['go', 'go', 'inhibition', 'go', 'inhibition']);
  });

  it('resets staircase by using the configured initial SSD for a new trial', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const trial = engine.startTrial(1, 2, 'inhibition', false, 'keyboard', 0, DEFAULT_CONFIG.initialSSDms);
    expect(trial.scheduledSSDms).toBe(DEFAULT_CONFIG.initialSSDms);
  });

  it('keeps practice out of scored Game 2 summaries', () => {
    const scored = stopTrial(undefined, 500);
    const practice = { ...stopTrial(undefined, 500), practice: true };
    const summary = summarizeGame2([scored, practice], DEFAULT_CONFIG, 800);
    expect(summary.inhibitionTrials).toBe(1);
  });

  it('includes successful inhibition rewards and failed inhibition penalties in game score', () => {
    const summary = summarizeGame2([goTrial(800, 2), stopTrial(undefined, 500), stopTrial(800, 500)], DEFAULT_CONFIG, 800);
    expect(summary.score).toBe(150);
  });

  it('calculates mean SSD and SSRT', () => {
    const summary = summarizeGame2([stopTrial(undefined, 550), stopTrial(650, 650), goTrial(820, 2)], DEFAULT_CONFIG, 820);
    expect(summary.meanSSDms).toBe(600);
    expect(summary.estimatedSSRTms).toBe(220);
    expect(estimateSSRT(814, 528)).toBe(286);
  });

  it('invalid trials are excluded from final summaries', () => {
    const invalid = { ...stopTrial(undefined, 500), valid: false };
    const summary = summarizeGame2([invalid], DEFAULT_CONFIG, 800);
    expect(summary.inhibitionTrials).toBe(0);
  });
});

describe('hurdle collapse trial safety', () => {
  it('generates 7 GO and 3 inhibition trials for the default scored Game 2 plan', () => {
    const plan = createGame2Plan(DEFAULT_CONFIG.game2GoTrials, DEFAULT_CONFIG.game2InhibitionTrials, seededRandom(2));
    expect(plan).toHaveLength(10);
    expect(plan.filter((trial) => trial === 'go')).toHaveLength(7);
    expect(plan.filter((trial) => trial === 'inhibition')).toHaveLength(3);
  });

  it('assigns null SSDs to every GO trial', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const plan = createGame2Plan(DEFAULT_CONFIG.game2GoTrials, DEFAULT_CONFIG.game2InhibitionTrials, seededRandom(3));
    const trials = plan.map((trialType, index) =>
      engine.startTrial(index + 1, 2, trialType, false, 'keyboard', 0, trialType === 'inhibition' ? DEFAULT_CONFIG.initialSSDms : null)
    );
    const goTrials = trials.filter((trial) => trial.trialType === 'go');
    expect(goTrials).toHaveLength(7);
    expect(goTrials.every((trial) => trial.scheduledSSDms === null)).toBe(true);
    expect(goTrials.every((trial) => trial.collapseTriggered === false)).toBe(true);
    expect(goTrials.every((trial) => trial.hurdleState === 'upright')).toBe(true);
  });

  it('assigns allowed SSDs to inhibition trials', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const trial = engine.startTrial(1, 2, 'inhibition', false, 'keyboard', 0, DEFAULT_CONFIG.initialSSDms);
    expect(trial.scheduledSSDms).toBeGreaterThanOrEqual(DEFAULT_CONFIG.minSSDms);
    expect(trial.scheduledSSDms).toBeLessThanOrEqual(DEFAULT_CONFIG.maxSSDms);
  });

  it('keeps a GO hurdle upright beyond 1000 ms', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const go = engine.startTrial(1, 2, 'go', false, 'keyboard', 0, null);
    const afterAttemptedCollapse = triggerCollapse(go, 1100);
    expect(afterAttemptedCollapse.collapseTriggered).toBe(false);
    expect(afterAttemptedCollapse.hurdleState).toBe('upright');
    expect(collapseProgress(afterAttemptedCollapse, 1100)).toBe(0);
  });

  it('triggers collapse on an inhibition trial after the scheduled SSD', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const inhibition = engine.startTrial(1, 2, 'inhibition', false, 'keyboard', 0, 500);
    const cued = engine.markCuePresented(inhibition, 500);
    expect(cued.collapseTriggered).toBe(true);
    expect(cued.hurdleState).toBe('collapsing');
    expect(hurdleStateFromCue(cued, 600)).toBe('collapsing');
    expect(hurdleStateFromCue(cued, 650)).toBe('fallen');
  });

  it('keeps inhibition hurdles readable through the 140 ms collapse window at each outreach SSD', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    for (const ssd of [450, 550, 600, 650]) {
      const inhibition = engine.startTrial(1, 2, 'inhibition', false, 'keyboard', 0, ssd);
      const cued = engine.markCuePresented(inhibition, ssd);
      expect(collapseProgress(cued, ssd - 1)).toBe(0);
      expect(collapseProgress(cued, ssd)).toBeGreaterThan(0);
      expect(collapseProgress(cued, ssd + COLLAPSE_DURATION_MS)).toBe(1);
      expect(hurdleStateFromCue(cued, ssd + 80)).toBe('collapsing');
      expect(hurdleStateFromCue(cued, ssd + 150)).toBe('fallen');
    }
  });

  it('validates many generated short Game 2 sessions', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const plan = createGame2Plan(DEFAULT_CONFIG.game2GoTrials, DEFAULT_CONFIG.game2InhibitionTrials, seededRandom(seed));
      expect(plan).toHaveLength(10);
      expect(plan[0]).toBe('go');
      expect(plan[1]).toBe('go');
      expect(plan.filter((trial) => trial === 'go')).toHaveLength(7);
      expect(plan.filter((trial) => trial === 'inhibition')).toHaveLength(3);
      expect(plan.join('')).not.toContain('inhibitioninhibitioninhibition');
    }
  });

  it('does not carry an inhibition collapse into the next GO trial', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const inhibition = engine.startTrial(1, 2, 'inhibition', false, 'keyboard', 0, 450);
    const cued = engine.markCuePresented(inhibition, 450);
    expect(cued.collapseTriggered).toBe(true);

    const nextGo = engine.startTrial(2, 2, 'go', false, 'keyboard', 1000, null);
    const afterPreviousSSD = triggerCollapse(nextGo, 1450);
    expect(afterPreviousSSD.scheduledSSDms).toBeNull();
    expect(afterPreviousSSD.collapseTriggered).toBe(false);
    expect(afterPreviousSSD.hurdleState).toBe('upright');
  });
});

describe('visual geometry', () => {
  it('places the hurdle eight percent of canvas width after takeoff', () => {
    const layout = createSceneLayout(1280, 720);
    expect(SCENE_RATIOS.takeoffX).toBe(0.61);
    expect(SCENE_RATIOS.hurdleX).toBe(0.69);
    expect((layout.hurdleX - layout.takeoffX) / 1280).toBeCloseTo(0.08, 5);
  });

  it('anchors both arms at shoulder-height pivot points', () => {
    const pose = calculateRunningArmPose(0);
    expect(pose.left.shoulder).toEqual(LEFT_SHOULDER);
    expect(pose.right.shoulder).toEqual(RIGHT_SHOULDER);
    expect(LEFT_SHOULDER.y).toBeLessThan(-60);
    expect(RIGHT_SHOULDER.y).toBeLessThan(-60);
    expect(Math.abs(LEFT_SHOULDER.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(RIGHT_SHOULDER.x)).toBeLessThanOrEqual(3);
  });

  it('keeps the neutral running arm as a shoulder-pivoted simple arm', () => {
    const arm = calculateArmSegment(RIGHT_SHOULDER.x, RIGHT_SHOULDER.y, RUNNING_ARM_BASE_ANGLE);
    expect(arm.hand.y).toBeGreaterThan(arm.shoulder.y);
    expect(arm.hand.x).toBeGreaterThan(arm.shoulder.x);
  });

  it('uses a clearly visible arm swing in opposite phase', () => {
    expect((RUNNING_ARM_SWING * 180) / Math.PI).toBeGreaterThan(30);

    const forward = calculateRunningArmPose(1);
    const backward = calculateRunningArmPose(-1);
    expect(forward.left.angle - backward.left.angle).toBeCloseTo(RUNNING_ARM_SWING * 2, 5);
    expect(backward.right.angle - forward.right.angle).toBeCloseTo(RUNNING_ARM_SWING * 2, 5);
    expect(forward.left.angle + forward.right.angle).toBeCloseTo(RUNNING_ARM_BASE_ANGLE * 2, 5);
    expect(backward.left.angle + backward.right.angle).toBeCloseTo(RUNNING_ARM_BASE_ANGLE * 2, 5);
  });
});

describe('personal Game 1 vs Game 2 jump comparison', () => {
  it('compares only scored Game 1 jumps with scored Game 2 GO jumps', () => {
    const comparison = calculateGameComparison(
      [
        goTrial(780, 1),
        goTrial(820, 1),
        { ...goTrial(900, 1), practice: true },
        stopTrial(undefined, 550),
        goTrial(850, 2),
        goTrial(750, 2),
        { ...goTrial(600, 2), practice: true }
      ],
      DEFAULT_CONFIG
    );

    expect(comparison.baselineMeanAbsoluteErrorMs).toBe(20);
    expect(comparison.fakeoutGoMeanAbsoluteErrorMs).toBe(50);
    expect(comparison.differenceMs).toBe(30);
    expect(comparison.baselineCount).toBe(2);
    expect(comparison.fakeoutGoCount).toBe(2);
  });
});

describe('Game 2 results display', () => {
  it('labels inhibition accuracy separately and clarifies normal jump denominators', () => {
    const html = renderGame2Results(
      {
        goSummary: summarizeGame1([goTrial(800, 2), goTrial(760, 2)], DEFAULT_CONFIG),
        inhibitionTrials: 3,
        inhibitionSuccesses: 2,
        inhibitionSuccessPercent: 67,
        meanSSDms: 550,
        estimatedSSRTms: 250,
        score: 150,
        warnings: []
      },
      {
        baselineMeanAbsoluteErrorMs: 20,
        fakeoutGoMeanAbsoluteErrorMs: 40,
        differenceMs: 20,
        baselineOnTargetCount: 8,
        fakeoutOnTargetCount: 2,
        baselineCount: 10,
        fakeoutGoCount: 7
      }
    );

    expect(html).toContain('INHIBITION ACCURACY');
    expect(html).toContain('<strong>67%</strong>');
    expect(html).toContain('FALLING HURDLES');
    expect(html).toContain('<strong>2 / 3</strong>');
    expect(html).toContain('2 / 7 normal jumps on target');
  });
});

function goTrial(releaseTimeMs: number, game: 1 | 2 = 1): TrialData {
  return completeGoTrial(
    {
      trialIndex: 1,
      game,
      trialType: 'go',
      practice: false,
      trialStartTimestamp: 0,
      releaseTimestamp: releaseTimeMs,
      releaseTimeMs,
      scheduledSSDms: null,
      actualCuePresentationTime: null,
      collapseTriggered: false,
      hurdleState: 'upright',
      valid: true,
      inputMethod: 'keyboard',
      targetTimeMs: DEFAULT_CONFIG.targetTimeMs,
      points: 0
    },
    DEFAULT_CONFIG
  );
}

function stopTrial(releaseTimeMs: number | undefined, scheduledSSDms: number): TrialData {
  return completeInhibitionTrial(
    {
      trialIndex: 1,
      game: 2,
      trialType: 'inhibition',
      practice: false,
      trialStartTimestamp: 0,
      releaseTimestamp: releaseTimeMs,
      releaseTimeMs,
      scheduledSSDms,
      actualCuePresentationTime: scheduledSSDms,
      collapseTriggered: true,
      hurdleState: 'collapsing',
      valid: true,
      inputMethod: 'keyboard',
      targetTimeMs: DEFAULT_CONFIG.targetTimeMs,
      points: 0
    },
    DEFAULT_CONFIG,
    scheduledSSDms
  );
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
