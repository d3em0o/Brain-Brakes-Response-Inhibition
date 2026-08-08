# Brain Brakes

Brain Brakes is a static browser game for an Exercise Science outreach activity. It contains two connected 2D Canvas mini-games:

- **Hurdle Timing:** hold Space to run, then release Space near the 800 ms take-off line.
- **Hurdle Fake-Out:** prepare the same release, but keep holding if the hurdle collapses before take-off.

The game is an educational adaptation of anticipated-response / response-inhibition paradigms. It does not collect identifying information, does not use analytics, and does not send results to a server.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Testing

```bash
npm run test
```

The tests cover the timing math, practice exclusion, trial randomisation, SSD staircase bounds, inhibition success/failure scoring, mean SSD, SSRT estimation, and summary exclusion of invalid trials.

## Build

```bash
npm run build
```

The Vite config uses `base: './'` so the built assets work from a GitHub Pages project subdirectory.

## Preview

```bash
npm run preview
```

## GitHub Deployment

1. Push this repository to GitHub.
2. Open the repository **Settings**.
3. Open **Pages**.
4. Set **Source** to **GitHub Actions** if GitHub asks.
5. Push to the `main` branch.
6. The `.github/workflows/deploy.yml` workflow runs tests and builds the site.
7. GitHub provides the Pages URL after the deployment finishes.

## Facilitator / Debug Mode

Open the game with:

```text
?debug=1
```

Debug mode adds:

- current game, trial type, state, elapsed time, release time, cue onset, SSD, staircase, input method, validity, and frame delta
- facilitator settings for trial counts, GO/inhibition counts, SSD values, staircase step, and target time
- anonymous session export as JSON or CSV
- timing diagnostics for frame intervals and scheduled-vs-rendered cue timing error

Normal gameplay does not show debug timing values.

## Timing Model

All trial timing is based on `performance.now()`. Rendering uses `requestAnimationFrame`, but recorded release times are calculated only from monotonic timestamps:

```text
releaseTimeMs = releaseTimestamp - trialStartTimestamp
```

The runner's position is visually synchronised to elapsed time, with the take-off line reached at 800 ms and the final inhibition checkpoint at 1000 ms. Frame drops affect only visual smoothness, not the recorded timing values.

## Inhibition Mechanic

In Game 2, inhibition trials look the same as GO trials until the scheduled stop-signal delay. At the SSD, the hurdle collapses. There is no stop sign and no warning text during the cue. If the player continues holding Space through 1000 ms, the trial counts as a successful cancellation. If they release after the hurdle falls, it is logged as a failed inhibition trial.

## Adaptive Staircase

The SSD starts at 500 ms by default:

- successful inhibition adds 50 ms, making the next falling hurdle later and harder
- failed inhibition subtracts 50 ms, making the next falling hurdle earlier and easier
- SSD is clamped between 300 ms and 700 ms

## SSRT Estimate

The educational stopping-time estimate is:

```text
estimatedSSRTms = mean GO release time - mean inhibition SSD
```

The result is labelled as an estimate. The game never describes a child as normal, abnormal, impaired, deficient, or diagnosed.

## Published Comparison Data

The included comparison values are stored in `src/data/referenceData.ts`:

- Gilbert et al. 2025
- typically developing children aged 8-12
- n = 38
- GO-only mean = 790 ms
- mixed GO mean = 814 ms
- SSRT mean = 284 ms
- SSRT SD = 48 ms
- mean stop cue = 528 ms
- stop success = 61.7%

These values are marked `validatedForCurrentGame: false` because Brain Brakes is a hurdle-themed educational adaptation, not the original task.

## Browser and Hardware Timing Limitations

Browser timing is good for outreach learning, but it is not laboratory hardware. Keyboard model, touchscreen latency, display refresh rate, operating system scheduling, tab focus, and browser throttling can all affect millisecond-level measurements. Touch results are still shown, but timing comparisons should be treated as especially approximate.
