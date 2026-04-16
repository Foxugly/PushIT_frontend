import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve('coverage/pushit-frontend/coverage-summary.json');
const thresholds = {
  statements: 45,
  branches: 30,
  functions: 38,
  lines: 45,
};

if (!fs.existsSync(reportPath)) {
  console.error(`Coverage report not found: ${reportPath}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const totals = summary.total;

if (!totals) {
  console.error('Coverage summary missing "total" key.');
  process.exit(1);
}

const metrics = {
  statements: totals.statements?.pct ?? 0,
  branches: totals.branches?.pct ?? 0,
  functions: totals.functions?.pct ?? 0,
  lines: totals.lines?.pct ?? 0,
};

const failures = Object.entries(thresholds).filter(([metric, minimum]) => {
  return metrics[metric] < minimum;
});

if (failures.length) {
  for (const [metric, minimum] of failures) {
    console.error(
      `Coverage threshold not met for ${metric}: ${metrics[metric]}% < ${minimum}%`,
    );
  }
  process.exit(1);
}

console.log(
  `Coverage OK: statements ${metrics.statements}%, branches ${metrics.branches}%, functions ${metrics.functions}%, lines ${metrics.lines}%`,
);
