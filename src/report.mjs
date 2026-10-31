import { readFileSync, statSync } from 'node:fs';

export function validateRun(run) {
  const fail = message => { throw new Error(message); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
  const label = value => typeof value === 'string' && value.length >= 1 && value.length <= 120 && !/[\x00-\x1f\x7f]/u.test(value);
  if (!exact(run, ['schemaVersion', 'environment', 'cases']) || run.schemaVersion !== 1) fail('expected a version 1 benchmark run');
  const envKeys = ['runtime', 'platform', 'context', 'workload'];
  if (!exact(run.environment, envKeys) || !envKeys.every(k => label(run.environment[k]))) fail('environment needs runtime, platform, context and workload labels');
  if (!Array.isArray(run.cases) || run.cases.length < 1 || run.cases.length > 100) fail('expected 1..100 cases');
  const names = new Set();
  for (const entry of run.cases) {
    if (!exact(entry, ['name', 'iterations', 'samplesMs']) || !label(entry.name) || names.has(entry.name)) fail('case names must be unique nonempty labels');
    names.add(entry.name);
    if (!Number.isInteger(entry.iterations) || entry.iterations < 1 || entry.iterations > 1_000_000) fail('iterations must be in 1..1000000');
    if (!Array.isArray(entry.samplesMs)
        || entry.samplesMs.length < 5
        || entry.samplesMs.length > 1000
        || !entry.samplesMs.every(n => typeof n === 'number'
        && Number.isFinite(n)
        && n >= 0
        && n <= 3_600_000)) fail('expected 5..1000 finite batch timings in milliseconds (0..3600000)');
  }
  return run;
}

export function readRun(path) {
  if (statSync(path).size > 4_194_304) throw new Error('benchmark file exceeds 4 MiB');
  return validateRun(JSON.parse(readFileSync(path, 'utf8')));
}

export function stats(entry) {
  const samples = entry.samplesMs.map(ms => ms / entry.iterations).sort((a, b) => a - b);
  const n = samples.length;
  return {
    count: n,
    medianMs: n % 2 ? samples[(n - 1) / 2] : (samples[n / 2 - 1] + samples[n / 2]) / 2,
    p95Ms: samples[Math.ceil(n * 0.95) - 1],
    minMs: samples[0], maxMs: samples[n - 1],
  };
}

export function compare(before, after, maxRegression = 10, budgetMs = null) {
  validateRun(before); validateRun(after);
  if (!Number.isFinite(maxRegression)
      || maxRegression < 0
      || (budgetMs !== null
      && (!Number.isFinite(budgetMs)
      || budgetMs <= 0))) throw new Error('thresholds must be finite: regression >= 0, budget > 0');
  for (const key of Object.keys(before.environment)) {
    if (before.environment[key] !== after.environment[key]) throw new Error(`environment mismatch: ${key}`);
  }
  const prior = new Map(before.cases.map(entry => [entry.name, entry]));
  if (prior.size !== after.cases.length || after.cases.some(entry => !prior.has(entry.name))) throw new Error('case sets must match');
  return after.cases.map(entry => {
    const base = prior.get(entry.name);
    if (base.iterations !== entry.iterations) throw new Error(`iteration mismatch: ${entry.name}`);
    const previous = stats(base), current = stats(entry);
    const percent = previous.medianMs === 0 ? (current.medianMs === 0 ? 0 : null) : (current.medianMs / previous.medianMs - 1) * 100;
    return {
      name: entry.name, previous, current, changePercent: percent,
      failed: percent === null || current.medianMs > previous.medianMs * (1 + maxRegression / 100) || (budgetMs !== null && current.p95Ms > budgetMs),
    };
  });
}

const cell = text => String(text).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('`', '&#96;');
export function markdown(run) {
  validateRun(run);
  const lines = [
    '# Flash Bench report', '',
    ...Object.entries(run.environment).map(([key, value]) => `- ${key}: ${cell(value)}`),
    '',
    'All timings below are milliseconds per callback invocation, derived from batch timings.',
    '',
    '| Case | Samples | Median | P95 | Min | Max |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const entry of run.cases) {
    const s = stats(entry);
    lines.push(`| ${cell(entry.name)} | ${s.count} | ${s.medianMs.toFixed(6)} | ${s.p95Ms.toFixed(6)} | ${s.minMs.toFixed(6)} | ${s.maxMs.toFixed(6)} |`);
  }
  return lines.join('\n') + '\n';
}
