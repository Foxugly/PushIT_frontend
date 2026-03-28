import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';

const port = 4200;
const root = normalize(join(process.cwd(), 'dist', 'pushit-frontend', 'browser'));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolvePath(urlPath) {
  const safePath = urlPath.split('?')[0].replace(/^\/+/, '');
  const candidate = normalize(join(root, safePath));
  if (!candidate.startsWith(root)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return join(root, 'index.html');
}

createServer((req, res) => {
  const filePath = resolvePath(req.url || '/');
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const extension = extname(filePath);
  res.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`Static SPA server running on http://127.0.0.1:${port}`);
});
