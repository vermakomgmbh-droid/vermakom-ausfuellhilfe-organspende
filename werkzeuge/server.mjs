// Lokaler Testserver ohne Abhängigkeiten: liefert site/ aus und setzt die Header aus site/_headers (wie Cloudflare Pages).
// Start: node werkzeuge/server.mjs [port]   -> http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = fileURLToPath(new URL('../site/', import.meta.url));
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Liest _headers (nur Block „/*“, wie er hier verwendet wird). */
export async function headerLesen() {
  const zeilen = (await readFile(join(WURZEL, '_headers'), 'utf8')).split('\n');
  const h = {}; let aktiv = false;
  for (const z of zeilen) {
    if (!z.trim() || z.trim().startsWith('#')) continue;
    if (!/^\s/.test(z)) { aktiv = z.trim() === '/*'; continue; }
    if (aktiv) { const i = z.indexOf(':'); h[z.slice(0, i).trim()] = z.slice(i + 1).trim(); }
  }
  return h;
}

export async function serverStarten(port = 8080) {
  const header = await headerLesen();
  const server = createServer(async (req, res) => {
    try {
      let pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (pfad.endsWith('/')) pfad += 'index.html';
      const datei = normalize(join(WURZEL, pfad));
      if (!datei.startsWith(WURZEL) || pfad.split('/').some((t) => t.startsWith('_'))) throw new Error('verboten');
      if (!(await stat(datei)).isFile()) throw new Error('kein File');
      const inhalt = await readFile(datei);
      res.writeHead(200, { ...header, 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch {
      res.writeHead(404, { ...header, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Nicht gefunden');
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2]) || 8080;
  await serverStarten(port);
  console.log(`Ausfüllhilfe läuft auf http://localhost:${port}  (Beenden: Strg+C)`);
}
