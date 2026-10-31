import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { validateRun, stats, compare, markdown } from '../src/report.mjs';

const run = samplesMs => ({ schemaVersion: 1, environment: { runtime: 'fixture', platform: 'synthetic', context: 'server', workload: 'v1' }, cases: [{ name: 'sum', iterations: 10, samplesMs }] });
const samples = [10, 20, 30, 40, 50];
test('statistics normalize batches and use nearest-rank p95', () => {
  assert.deepEqual(stats(run(samples).cases[0]), { count: 5, medianMs: 3, p95Ms: 5, minMs: 1, maxMs: 5 });
  assert.equal(stats(run([60, 10, 40, 30, 20, 50]).cases[0]).medianMs, 3.5);
});
test('rejects malformed schemas and timing values', () => {
  for (const value of [null, {}, { ...run(samples), extra: true }, { ...run(samples), schemaVersion: 2 }, { ...run(samples), cases: [] }]) assert.throws(() => validateRun(value));
  for (const value of [NaN, Infinity, -1, '5', 3600001]) assert.throws(() => validateRun(run([10, 20, 30, 40, value])));
  for (const iterations of [0, 1.5, 1000001, true]) {
    const r = run(samples); r.cases[0].iterations = iterations;
    assert.throws(() => validateRun(r));
  }
  const r = run(samples); r.cases.push(r.cases[0]);
  assert.throws(() => validateRun(r));
});
test('detects regressions, improvements and p95 budgets', () => {
  assert.equal(compare(run(samples), run(samples.map(n => n * 1.2)))[0].failed, true);
  assert.equal(compare(run(samples), run(samples.map(n => n * 0.9)))[0].failed, false);
  assert.equal(compare(run(samples), run(samples), 10, 4)[0].failed, true);
  assert.equal(compare(run(samples), run(samples), 0, 5)[0].failed, false);
  assert.equal(compare(run([100, 100, 100, 100, 100]), run([110, 110, 110, 110, 110]), 10)[0].failed, false);
});
test('zero baseline is explicit and fails when current is positive', () => {
  const zero = run([0, 0, 0, 0, 0]);
  assert.equal(compare(zero, zero)[0].changePercent, 0);
  const result = compare(zero, run(samples))[0];
  assert.equal(result.changePercent, null); assert.equal(result.failed, true);
});
test('refuses incompatible environments, iterations and case sets', () => {
  for (const mutate of [r => { r.environment.context = 'client'; }, r => { r.cases[0].iterations = 20; }, r => { r.cases[0].name = 'other'; }]) {
    const after = run(samples); mutate(after);
    assert.throws(() => compare(run(samples), after));
  }
});
test('validates thresholds and handles sample limits', () => {
  for (const threshold of [NaN, Infinity, -1]) assert.throws(() => compare(run(samples), run(samples), threshold));
  for (const budget of [0, -1, Infinity]) assert.throws(() => compare(run(samples), run(samples), 10, budget));
  assert.throws(() => validateRun(run([1, 2, 3, 4])));
  assert.throws(() => validateRun(run(Array(1001).fill(1))));
});
test('markdown escapes case labels', () => {
  const r = run(samples); r.cases[0].name = '<script>|`';
  const output = markdown(r);
  assert.ok(output.includes('&lt;script&gt;\\|&#96;'));
  assert.ok(!output.includes('<script>'));
});
test('CLI returns 0 for passing comparison, 1 for regression, 2 for usage error', () => {
  const cli = (...args) => spawnSync(process.execPath, ['src/cli.mjs', ...args], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(cli('summary', 'examples/before.json').status, 0);
  assert.equal(cli('compare', 'examples/before.json', 'examples/after.json').status, 0);
  assert.equal(cli('compare', 'examples/after.json', 'examples/before.json', '--max-regression', '0').status, 1);
  assert.equal(cli('compare', 'examples/before.json', 'examples/after.json', '--budget-ms', 'NaN').status, 2);
  assert.equal(cli('summary', 'missing.json').status, 2);
  assert.equal(cli('unknown').status, 2);
});
