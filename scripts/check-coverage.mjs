import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve('coverage/pushit-frontend/index.html');
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

const html = fs.readFileSync(reportPath, 'utf8');
const metrics = {};

for (const metric of ['Statements', 'Branches', 'Functions', 'Lines']) {
  const pattern = new RegExp(
    `<span class="strong">\\s*([\\d.]+)%\\s*</span>\\s*<span class="quiet">${metric}</span>`,
    'i',
  );
  const match = html.match(pattern);
  if (!match) {
    console.error(`Coverage metric not found for ${metric}.`);
    process.exit(1);
  }

  metrics[metric.toLowerCase()] = Number.parseFloat(match[1]);
}

const failures = Object.entries(thresholds).filter(([metric, minimum]) => {
  return (metrics[metric] ?? 0) < minimum;
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
