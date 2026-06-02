// Pré-compression statique des assets texte du build Angular.
//
// Génère, à côté de chaque asset compressible, un `<f>.br` (brotli niveau 11)
// et un `<f>.gz` (gzip niveau 9), que nginx sert directement via
// `brotli_static on;` / `gzip_static on;` (aucune recompression à la volée).
//
// Lancé en CI APRÈS `ng build` et AVANT le rsync vers l'EC2 (cf. deploy.yml) —
// pas dans `npm run build`, car brotli q11 est lent et inutile en dev/e2e.
//
// Règles :
//   - seules les extensions texte sont compressées (.js .css .html .json .svg
//     .xml .ico) ; jamais .woff2 / images / vidéos (déjà compressés) ;
//   - on n'écrit `.br`/`.gz` que s'ils sont PLUS PETITS que l'original (sinon
//     servir un pré-compressé plus gros serait contre-productif) ;
//   - idempotent : ré-exécutable, écrase les sorties précédentes.
//
// Node pur (zlib intégré) — aucune dépendance.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BROWSER_DIR = path.resolve('dist/pushit-frontend/browser');
const COMPRESSIBLE = new Set(['.js', '.css', '.html', '.json', '.svg', '.xml', '.ico']);

function brotli(buffer) {
  return zlib.brotliCompressSync(buffer, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
    },
  });
}

function gzip(buffer) {
  return zlib.gzipSync(buffer, { level: 9 });
}

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main() {
  try {
    await fs.access(BROWSER_DIR);
  } catch {
    console.error(`precompress: build output not found at ${BROWSER_DIR} — run \`ng build\` first.`);
    process.exit(1);
  }

  let files = 0;
  let rawTotal = 0;
  let brTotal = 0;
  let gzTotal = 0;

  for await (const file of walk(BROWSER_DIR)) {
    // Ne jamais traiter nos propres sorties.
    if (file.endsWith('.br') || file.endsWith('.gz')) continue;
    if (!COMPRESSIBLE.has(path.extname(file).toLowerCase())) continue;

    const buffer = await fs.readFile(file);
    if (buffer.length === 0) continue;

    const br = brotli(buffer);
    const gz = gzip(buffer);

    // N'écrire que si le pré-compressé est réellement plus petit.
    if (br.length < buffer.length) {
      await fs.writeFile(`${file}.br`, br);
      brTotal += br.length;
    }
    if (gz.length < buffer.length) {
      await fs.writeFile(`${file}.gz`, gz);
      gzTotal += gz.length;
    }

    files += 1;
    rawTotal += buffer.length;
  }

  const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;
  console.log(
    `precompress: ${files} assets — raw ${kib(rawTotal)} → br ${kib(brTotal)} / gz ${kib(gzTotal)}`,
  );
}

main().catch((err) => {
  console.error('precompress: failed:', err);
  process.exit(1);
});
