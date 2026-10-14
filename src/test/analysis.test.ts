import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../data/config';
import type { TrialData } from '../data/types';
import { completeGoTrial, scoreGoTrial, summarizeGame1 } from '../analysis/game1Analysis';
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
import { renderGame1Results, renderGame2Results, timingLine } from '../ui/results';

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

  it('reports null consistency when fewer than two jump attempts exist', () => {
    const summary = summarizeGame1([goTrial(800)], DEFAULT_CONFIG);
    expect(summary.standardDeviationReleaseMs).toBeNull();
  });

  it('uses the displayed point bands for normal jumps', () => {
    expect(scoreGoTrial(0)).toBe(100);
    expect(scoreGoTrial(10)).toBe(100);
    expect(scoreGoTrial(20)).toBe(75);
    expect(scoreGoTrial(30)).toBe(50);
    expect(scoreGoTrial(31)).toBe(0);
    expect(scoreGoTrial(undefined)).toBe(0);
  });

  it('counts no-response normal hurdles as incorrect without adding timing error', () => {
    const noResponse = noJumpGoTrial();
    expect(noResponse.jumped).toBe(false);
    expect(noResponse.correct).toBe(false);
    expect(noResponse.timingErrorMs).toBeNull();
    expect(noResponse.absoluteErrorMs).toBeUndefined();

    const summary = summarizeGame1([goTrial(800), goTrial(650), goTrial(950), noResponse], DEFAULT_CONFIG);
    expect(summary.count).toBe(4);
    expect(summary.jumpAttemptCount).toBe(3);
    expect(summary.noResponseCount).toBe(1);
    expect(summary.numberInTargetWindow).toBe(1);
    expect(summary.percentageInTargetWindow).toBe(25);
    expect(summary.meanAbsoluteErrorMs).toBe(100);
  });

  it('returns N/A-ready null timing values when there are no normal jump attempts', () => {
    const summary = summarizeGame1([noJumpGoTrial(), noJumpGoTrial()], DEFAULT_CONFIG);
    expect(summary.count).toBe(2);
    expect(summary.jumpAttemptCount).toBe(0);
    expect(summary.meanAbsoluteErrorMs).toBeNull();
    expect(summary.meanReleaseTimeMs).toBeNull();
    expect(summary.bestAbsoluteErrorMs).toBeNull();
    expect(summary.percentageInTargetWindow).toBe(0);
  });
});

describe('Game 2 inhibition calculations', () => {
  it('GO trials use the same timing analysis as Game 1', () => {
    const trial = goTrial(775, 2);
    expect(trial.signedErrorMs).toBe(-25);
    expect(trial.withinResearchSuccessWindow).toBe(true);
  });

  it('uses a centered 770-830 ms target zone around the 800 ms ideal jump', () => {
    expect(DEFAULT_CONFIG.targetTimeMs).toBe(800);
    expect(DEFAULT_CONFIG.goodWindowStartMs).toBe(770);
    expect(DEFAULT_CONFIG.goodWindowEndMs).toBe(830);
    expect(goTrial(770).withinResearchSuccessWindow).toBe(true);
    expect(goTrial(830).withinResearchSuccessWindow).toBe(true);
    expect(goTrial(760).withinResearchSuccessWindow).toBe(false);
    expect(goTrial(840).withinResearchSuccessWindow).toBe(false);
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
    expect(trial.jumped).toBe(true);
    expect(trial.correct).toBe(false);
    expect(trial.timingErrorMs).toBeNull();
    expect(trial.points).toBe(0);
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

  it('creates the fixed Game 2 falling-hurdle sequence', () => {
    const plan = createGame2Plan(6, 4, seededRandom(1));
    expect(plan).toHaveLength(10);
    expect(plan).toEqual(['go', 'go', 'inhibition', 'go', 'go', 'inhibition', 'inhibition', 'go', 'go', 'inhibition']);
    expect(plan.filter((trial) => trial === 'go')).toHaveLength(6);
    expect(plan.filter((trial) => trial === 'inhibition')).toHaveLength(4);
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

  it('includes successful inhibition rewards and gives failed inhibitions zero points', () => {
    const summary = summarizeGame2([goTrial(800, 2), stopTrial(undefined, 500), stopTrial(800, 500)], DEFAULT_CONFIG, 800);
    expect(summary.score).toBe(200);
    expect(summary.falseJumps).toBe(1);
  });

  it('calculates mean SSD and SSRT', () => {
    const summary = summarizeGame2([stopTrial(undefined, 550), stopTrial(650, 650), goTrial(820, 2)], DEFAULT_CONFIG, 820);
    expect(summary.meanSSDms).toBe(600);
    expect(summary.estimatedSSRTms).toBe(220);
    expect(estimateSSRT(814, 528)).toBe(286);
  });

  it('calculates stop-cue delay from actual cue timing when available', () => {
    const earlyCue = {
      ...stopTrial(undefined, 550),
      trialStartTimestamp: 1000,
      actualCuePresentationTime: 1532
    };
    const lateCue = {
      ...stopTrial(undefined, 650),
      trialStartTimestamp: 2000,
      actualCuePresentationTime: 2676
    };
    const summary = summarizeGame2([earlyCue, lateCue], DEFAULT_CONFIG, 800);
    expect(summary.meanStopCueDelayMs).toBe(604);
  });

  it('invalid trials are excluded from final summaries', () => {
    const invalid = { ...stopTrial(undefined, 500), valid: false };
    const summary = summarizeGame2([invalid], DEFAULT_CONFIG, 800);
    expect(summary.inhibitionTrials).toBe(0);
  });

  it('keeps falling hurdles out of normal jump timing and accuracy calculations', () => {
    const summary = summarizeGame2(
      [goTrial(800, 2), noJumpGoTrial(2), stopTrial(undefined, 550), stopTrial(700, 550)],
      DEFAULT_CONFIG,
      800
    );
    expect(summary.goSummary.count).toBe(2);
    expect(summary.goSummary.jumpAttemptCount).toBe(1);
    expect(summary.goSummary.meanAbsoluteErrorMs).toBe(0);
    expect(summary.goSummary.percentageInTargetWindow).toBe(50);
    expect(summary.inhibitionTrials).toBe(2);
    expect(summary.inhibitionSuccesses).toBe(1);
    expect(summary.inhibitionSuccessPercent).toBe(50);
    expect(summary.falseJumps).toBe(1);
  });
});

describe('hurdle collapse trial safety', () => {
  it('generates 6 GO and 4 inhibition trials for the default scored Game 2 plan', () => {
    const plan = createGame2Plan(DEFAULT_CONFIG.game2GoTrials, DEFAULT_CONFIG.game2InhibitionTrials, seededRandom(2));
    expect(plan).toHaveLength(10);
    expect(plan).toEqual(['go', 'go', 'inhibition', 'go', 'go', 'inhibition', 'inhibition', 'go', 'go', 'inhibition']);
    expect(plan.filter((trial) => trial === 'go')).toHaveLength(6);
    expect(plan.filter((trial) => trial === 'inhibition')).toHaveLength(4);
  });

  it('assigns null SSDs to every GO trial', () => {
    const engine = new TrialEngine(DEFAULT_CONFIG);
    const plan = createGame2Plan(DEFAULT_CONFIG.game2GoTrials, DEFAULT_CONFIG.game2InhibitionTrials, seededRandom(3));
    const trials = plan.map((trialType, index) =>
      engine.startTrial(index + 1, 2, trialType, false, 'keyboard', 0, trialType === 'inhibition' ? DEFAULT_CONFIG.initialSSDms : null)
    );
    const goTrials = trials.filter((trial) => trial.trialType === 'go');
    expect(goTrials).toHaveLength(6);
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
      expect(plan).toEqual(['go', 'go', 'inhibition', 'go', 'go', 'inhibition', 'inhibition', 'go', 'go', 'inhibition']);
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
    expect(comparison.baselineAccuracyPercent).toBe(100);
    expect(comparison.fakeoutGoAccuracyPercent).toBe(0);
    expect(comparison.accuracyDifferencePercentagePoints).toBe(-100);
    expect(comparison.targetTimeMs).toBe(800);
    expect(comparison.windowStartMs).toBe(770);
    expect(comparison.windowEndMs).toBe(830);
  });

  it('uses all normal hurdles for comparison accuracy but only jump attempts for timing error', () => {
    const comparison = calculateGameComparison(
      [goTrial(800, 1), noJumpGoTrial(1), goTrial(900, 2), noJumpGoTrial(2)],
      DEFAULT_CONFIG
    );

    expect(comparison.baselineMeanAbsoluteErrorMs).toBe(0);
    expect(comparison.fakeoutGoMeanAbsoluteErrorMs).toBe(100);
    expect(comparison.baselineCount).toBe(2);
    expect(comparison.fakeoutGoCount).toBe(2);
    expect(comparison.baselineAccuracyPercent).toBe(50);
    expect(comparison.fakeoutGoAccuracyPercent).toBe(0);
    expect(comparison.accuracyDifferencePercentagePoints).toBe(-50);
  });

  it('reports null timing differences when a comparison group has no jump attempts', () => {
    const comparison = calculateGameComparison([noJumpGoTrial(1), goTrial(800, 2)], DEFAULT_CONFIG);
    expect(comparison.baselineMeanAbsoluteErrorMs).toBeNull();
    expect(comparison.differenceMs).toBeNull();
  });
});

describe('Game 2 results display', () => {
  it('uses child-friendly labels while preserving Game 2 calculations', () => {
    const html = renderGame2Results(
      {
        goSummary: summarizeGame1([goTrial(800, 2), goTrial(760, 2)], DEFAULT_CONFIG),
        inhibitionTrials: 3,
        inhibitionSuccesses: 2,
        inhibitionSuccessPercent: 67,
        falseJumps: 1,
        meanStopCueDelayMs: 550,
        meanSSDms: 550,
        estimatedSSRTms: 250,
        score: 150,
        warnings: []
      },
      {
        targetTimeMs: 800,
        windowStartMs: 770,
        windowEndMs: 830,
        baselineMeanAbsoluteErrorMs: 20,
        fakeoutGoMeanAbsoluteErrorMs: 40,
        differenceMs: 20,
        baselineOnTargetCount: 8,
        fakeoutOnTargetCount: 2,
        baselineCount: 10,
        fakeoutGoCount: 7,
        baselineAccuracyPercent: 80,
        fakeoutGoAccuracyPercent: 29,
        accuracyDifferencePercentagePoints: -51
      },
      1625,
      2000
    );

    expect(html).toContain('STOP SCORE');
    expect(html).toContain('<strong>67%</strong>');
    expect(html).toContain('You stopped for 2 out of 3 falling hurdles!');
    expect(html).toContain('JUMP ACCURACY');
    expect(html).toContain('1 out of 2 normal jumps on target!');
    expect(html).toContain('STEADINESS');
    expect(html).toContain('GAME SCORE');
    expect(html).toContain('1,625 / 2,000 points');
    expect(html).toContain('NORMAL ROUND');
    expect(html).toContain('TRICK ROUND');
    expect(html).toContain('WHAT CHANGED?');
    expect(html).toContain('On target: 80% -> 29%');
  });

  it('displays N/A instead of 0 ms when a timing group has no jump attempts', () => {
    const html = renderGame2Results(
      {
        goSummary: summarizeGame1([noJumpGoTrial(2)], DEFAULT_CONFIG),
        inhibitionTrials: 1,
        inhibitionSuccesses: 1,
        inhibitionSuccessPercent: 100,
        falseJumps: 0,
        meanStopCueDelayMs: null,
        meanSSDms: 550,
        estimatedSSRTms: 250,
        score: 100,
        warnings: []
      },
      {
        targetTimeMs: 800,
        windowStartMs: 770,
        windowEndMs: 830,
        baselineMeanAbsoluteErrorMs: null,
        fakeoutGoMeanAbsoluteErrorMs: null,
        differenceMs: null,
        baselineOnTargetCount: 0,
        fakeoutOnTargetCount: 0,
        baselineCount: 2,
        fakeoutGoCount: 1,
        baselineAccuracyPercent: 0,
        fakeoutGoAccuracyPercent: 0,
        accuracyDifferencePercentagePoints: 0
      },
      100,
      2000
    );

    expect(html).toContain('<strong>N/A</strong>');
  });

  it('draws the timing graph on-target zone from the configured scoring window', () => {
    const html = timingLine([goTrial(700), goTrial(760), goTrial(900)], DEFAULT_CONFIG);
    expect(html).toContain('class="timing-window"');
    expect(html).toContain('Great Timing!');
    expect(html).toContain('left:42.5%;width:15%');
    expect(html).toContain('class="timing-target" style="left:50%"');
    expect(html).toContain('800 ms');
    expect(html).toContain('EARLIER');
    expect(html).toContain('LATER');
    expect(html).toContain('Closer to the middle line = better timing!');
  });

  it('keeps Stage 1 results simple for children', () => {
    const summary = summarizeGame1([goTrial(800), goTrial(760), noJumpGoTrial()], DEFAULT_CONFIG);
    const html = renderGame1Results(summary, [goTrial(800), goTrial(760), noJumpGoTrial()], DEFAULT_CONFIG);
    expect(html).toContain('YOUR TIMING');
    expect(html).toContain('20 ms off');
    expect(html).toContain('BEST JUMP');
    expect(html).toContain('0 ms off');
    expect(html).toContain('STEADINESS');
    expect(html).toContain('ON TARGET');
    expect(html).toContain('1 out of 3 jumps close to the middle line!');
    expect(html).toContain('ROUND 1 SCORE');
    expect(html).toContain('100 / 1,000 points');
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

function noJumpGoTrial(game: 1 | 2 = 1): TrialData {
  return completeGoTrial(
    {
      trialIndex: 1,
      game,
      trialType: 'go',
      practice: false,
      trialStartTimestamp: 0,
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
