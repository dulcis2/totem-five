// Minimal zero-dependency static server for production (Railway).
// Serves the Vite build in ./dist and falls back to index.html.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT) || 3000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

async function tryFile(path) {
  try {
    const s = await stat(path);
    return s.isFile() ? path : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('ok');
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    file = (await tryFile(file)) ?? (await tryFile(join(file, 'index.html'))) ?? join(root, 'index.html');
    const body = await readFile(file);
    const immutable = file.includes(`${join(root, 'assets')}`);
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal error');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Five Totems listening on http://0.0.0.0:${port}`);
});
