import fs from 'node:fs';
import path from 'node:path';

// Le chemin du rapport a change trois fois : karma ecrivait sous
// coverage/<projet>/, vitest sous Angular 20 a la racine de coverage/, et
// Angular 21 est revenu a coverage/<projet>/.
//
// On ne choisit PAS par ordre de preference : un rapport perime laisse par une
// version precedente masquerait le rapport frais et le seuil serait verifie
// contre de vieux chiffres — panne silencieuse observee le 2026-07-30, ou le
// gate annoncait 86% alors que le run venait de mesurer 70%. On prend donc
// toujours le plus RECENT, et on dit lequel.
const candidates = [
  'coverage/pushit-frontend/coverage-summary.json',
  'coverage/coverage-summary.json',
];
const thresholds = {
  statements: 45,
  branches: 30,
  functions: 38,
  lines: 45,
};

const found = candidates
  .map((c) => path.resolve(c))
  .filter((p) => fs.existsSync(p))
  .map((p) => ({ p, mtime: fs.statSync(p).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (found.length === 0) {
  console.error(`Coverage report not found. Tried:\n  ${candidates.join('\n  ')}`);
  process.exit(1);
}

const reportPath = found[0].p;
if (found.length > 1) {
  console.warn(
    `Plusieurs rapports de couverture presents ; le plus recent est retenu :\n` +
      found.map((f) => `  ${f.p}  (${new Date(f.mtime).toISOString()})`).join('\n'),
  );
}
console.log(`Rapport de couverture lu : ${path.relative(process.cwd(), reportPath)}`);

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
