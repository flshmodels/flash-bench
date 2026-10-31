import { readRun, compare, markdown } from './report.mjs';

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'summary' && args.length === 1) {
    process.stdout.write(markdown(readRun(args[0])));
  } else if (command === 'compare' && args.length >= 2) {
    const [before, after, ...options] = args;
    let maxRegression = 10, budgetMs = null;
    const seen = new Set();
    for (let i = 0; i < options.length; i += 2) {
      const flag = options[i], raw = options[i + 1];
      if (!['--max-regression', '--budget-ms'].includes(flag) || seen.has(flag) || raw === undefined || !/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(raw)) throw new Error('invalid or duplicate comparison option');
      seen.add(flag);
      if (flag === '--max-regression') maxRegression = Number(raw);
      else budgetMs = Number(raw);
    }
    const results = compare(readRun(before), readRun(after), maxRegression, budgetMs);
    console.log(JSON.stringify({ passed: results.every(result => !result.failed), results }, null, 2));
    if (results.some(result => result.failed)) process.exitCode = 1;
  } else {
    throw new Error('Usage: node src/cli.mjs summary run.json | compare before.json after.json [--max-regression 10] [--budget-ms 1]');
  }
} catch (error) {
  console.error(`flash-bench: ${error.message}`);
  process.exitCode = 2;
}
