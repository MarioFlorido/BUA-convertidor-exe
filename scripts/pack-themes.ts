/**
 * pack-themes — genera los ZIPs de temas oficiales desde public/themes/
 *
 * Uso directo:
 *   npm run pack-themes
 *
 * Se ejecuta automáticamente como hook de predev y prebuild.
 * Los ZIPs generados (public/*.zip) están en .gitignore — son artefactos de build.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THEMES_DIR = path.join(PUBLIC_DIR, 'themes');

function shouldExclude(name: string): boolean {
  return name.startsWith('.') || name === '__MACOSX' || name.startsWith('._');
}

function readDirRecursive(dir: string, base = ''): Record<string, Uint8Array> {
  const result: Record<string, Uint8Array> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (shouldExclude(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(result, readDirRecursive(full, rel));
    } else {
      result[rel] = new Uint8Array(fs.readFileSync(full));
    }
  }
  return result;
}

export function packThemeDir(id: string): void {
  const themeDir = path.join(THEMES_DIR, id);
  const files = readDirRecursive(themeDir);
  if (Object.keys(files).length === 0) return;
  const zipBytes = zipSync(files);
  fs.writeFileSync(path.join(PUBLIC_DIR, `${id}.zip`), zipBytes);
  console.log(`  packed: ${id}.zip`);
}

export function packAllThemes(): void {
  if (!fs.existsSync(THEMES_DIR)) return;
  let count = 0;
  for (const entry of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    packThemeDir(entry.name);
    count++;
  }
  if (count > 0) console.log(`✓ ${count} tema(s) empaquetado(s)`);
}

// Solo ejecutar cuando se llama directamente, no cuando se importa
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  packAllThemes();
}
