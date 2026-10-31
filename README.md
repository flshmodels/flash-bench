# Flash Bench

[![Tests](https://github.com/flshmodels/flash-bench/actions/workflows/test.yml/badge.svg)](https://github.com/flshmodels/flash-bench/actions/workflows/test.yml)

A small Luau timing runner and a JavaScript report tool for comparing Roblox test runs. Use it to check whether a change made a particular operation slower or faster.

## Try the report tool

Requires Node.js 22 or newer. There are no packages to install.

```sh
node src/cli.mjs summary examples/before.json
node src/cli.mjs compare examples/before.json examples/after.json --max-regression 10
npm test
```

The checked-in before/after files are **synthetic fixtures**, not measured Roblox performance claims. All commands run locally and exit when finished; nothing listens on a port.

## Record a Roblox run

1. In a separate Studio test place, create a **Runner** ModuleScript in ServerScriptService and paste `roblox/Runner.luau` into it.
2. Create a Script beside it using `roblox/Example.server.luau`.
3. Replace the callback with the operation you want to measure. Start small; a large synchronous workload can freeze the test.
4. Fill in the environment labels with your Studio version, OS/CPU, client or server context, and a workload version.
5. Play the test and copy only the JSON between the output markers into `before.json`. Repeat after your change for `after.json`.

Callbacks must finish synchronously, without yielding. Errors stop the run. Warmup calls mutate state too; reset state yourself when your test requires it. The runner does not subtract loop overhead, isolate garbage collection, or measure GPU/frame time. For a client test, use a LocalScript and put Runner somewhere the client can require it; the example is server-only.

## Input and output

| Input | Meaning |
| --- | --- |
| schemaVersion | Must be 1. |
| environment | runtime, platform, context, workload: nonempty labels up to 120 characters, with no control characters. Use honest, specific values. |
| cases | 1–100 cases with unique names. |
| name | Nonempty case label up to 120 characters. |
| iterations | Callback calls per batch, integer 1–1,000,000. |
| samplesMs | 5–1,000 finite batch durations in milliseconds, each 0–3,600,000. |

The Luau runner defaults to 100 iterations per batch, 30 samples and 10 warmup calls. It measures elapsed time using `os.clock()`. The report tool divides each batch duration by its iteration count, then calculates median, nearest-rank P95, minimum and maximum milliseconds per invocation. An invocation can itself contain multiple operations. Input files are limited to 4 MiB; unknown schema fields are rejected.

`summary` prints Markdown to stdout. `compare` prints JSON containing both sets of statistics, the median percentage change and a pass/fail flag. Redirect stdout to save a report.

Comparisons require matching environment labels, case names and iteration counts. Default failure threshold: median increase **greater than 10%**. `--max-regression 0` allows no median increase; optional `--budget-ms 1` also fails when current P95 exceeds 1 ms/invocation. A zero baseline followed by a positive median fails with a null percentage, because that percentage is undefined.

Exit codes: **0** success/pass, **1** regression or budget failure, **2** invalid input or usage. Five samples meet the format minimum but provide little evidence about tail latency. Repeat runs under similar conditions and inspect noise before treating a difference as meaningful. Matching labels cannot prove equivalent hardware or conditions.

## Design check

[nightcycle/roblox-benchmarks](https://github.com/nightcycle/roblox-benchmarks) is an existing benchmark suite with a runner and a results-processing stage. That separation is useful here too: Roblox collects samples, and an offline tool processes them. Flash Bench deliberately has a smaller scope and does not claim the coverage of that suite. No code was copied.

Roblox's [Script Profiler](https://create.roblox.com/docs/studio/optimization/scriptprofiler) is the better starting point when you need to discover which scripts consume CPU time. Flash Bench measures a callback you have already chosen.

Tests cover statistics, zero baselines, mismatched runs, malformed timings, budget checks and CLI exits. CI runs the Luau runner checks in Lune. Live Studio timing and performance validity still need a real test session.

MIT licensed. See [LICENSE](LICENSE).
