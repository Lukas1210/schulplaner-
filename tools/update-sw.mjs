// Aktualisiert die CORE-Liste in app/sw.js (alles, was die App offline braucht).
// Aufruf: node tools/update-sw.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const rel = (p) => relative(root, p).split('\\').join('/');

const files = [
  ...walk(join(root, 'js')).filter((f) => f.endsWith('.js')),
  ...walk(join(root, 'css')).filter((f) => f.endsWith('.css')),
  ...['index.html', 'config.js', 'manifest.webmanifest'].map((f) => join(root, f)),
  ...['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon.svg'].map((f) => join(root, 'assets/icons', f)),
  // supabase.min.js wird nur mit eingerichtetem Sync geladen und dann zur Laufzeit zwischengespeichert
].map(rel).sort();

const list = ["  './',", ...files.map((f) => `  '${f}',`)].join('\n');
const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
writeFileSync(swPath, sw.replace(/const CORE = \[[\s\S]*?\n\];/, `const CORE = [\n${list}\n];`));
console.log(`CORE: ${files.length + 1} Dateien`);
