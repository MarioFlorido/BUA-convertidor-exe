/**
 * publish-theme — publica un tema en el repositorio para que todos los usuarios lo vean
 *
 * Uso:
 *   npm run publish-theme <ruta/al/tema.zip> [--activity "Doctorado"] [--description "..."]
 *
 * Qué hace:
 *   1. Valida el ZIP (debe contener config.xml + style.css)
 *   2. Lee <language> del config.xml
 *   3. Descomprime el ZIP en public/themes/<id>/
 *   4. Genera public/<id>.zip desde esa carpeta (artefacto local, no va a git)
 *   5. Añade/actualiza la entrada en public/themes-config.json
 *
 * No hace commit ni push: te muestra el comando para hacerlo cuando quieras.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { packThemeDir } from './pack-themes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THEMES_DIR = path.join(PUBLIC_DIR, 'themes');
const CONFIG_PATH = path.join(PUBLIC_DIR, 'themes-config.json');

interface ThemeEntry {
  id: string;
  name: string;
  activity?: string;
  language?: string;
  description?: string;
  screenshot?: string | null;
}
interface ThemesConfig { themes: ThemeEntry[] }

function parseArgs(argv: string[]): { zipPath: string; activity?: string; description?: string } {
  const args = argv.slice(2);
  if (args.length === 0 || args[0].startsWith('--')) {
    console.error('Uso: npm run publish-theme <ruta/al/tema.zip> [--activity "..."] [--description "..."]');
    process.exit(1);
  }
  const result: { zipPath: string; activity?: string; description?: string } = { zipPath: args[0] };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--activity') result.activity = args[++i];
    else if (args[i] === '--description') result.description = args[++i];
  }
  return result;
}

function extractLanguage(configXml: string): 'es' | 'en' | 'ca' | null {
  const match = configXml.match(/<language>\s*([a-z]{2})\s*<\/language>/i);
  if (!match) return null;
  const v = match[1].toLowerCase();
  return v === 'es' || v === 'en' || v === 'ca' ? v : null;
}

function main() {
  const { zipPath, activity, description } = parseArgs(process.argv);

  if (!fs.existsSync(zipPath)) {
    console.error(`✗ No existe: ${zipPath}`);
    process.exit(1);
  }
  if (!zipPath.toLowerCase().endsWith('.zip')) {
    console.error('✗ Debe ser un archivo .zip');
    process.exit(1);
  }

  const id = path.basename(zipPath, '.zip');
  const zipBytes = new Uint8Array(fs.readFileSync(zipPath));

  // Descomprimir y validar
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes);
  } catch (err) {
    console.error(`✗ ZIP corrupto: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Filtrar archivos de sistema (__MACOSX, ._*, .DS_Store)
  for (const name of Object.keys(files)) {
    if (name.startsWith('__MACOSX/') || name.includes('/._') || name.endsWith('/.DS_Store') || name === '.DS_Store') {
      delete files[name];
    }
  }

  // Validar archivos mínimos
  const required = ['config.xml', 'style.css'];
  const missing = required.filter((f) => !files[f]);
  if (missing.length > 0) {
    console.error(`✗ Faltan archivos requeridos: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Detectar idioma
  const configXmlText = new TextDecoder().decode(files['config.xml']);
  const language = extractLanguage(configXmlText) ?? 'es';
  console.log(`  Idioma detectado: ${language}`);

  // 1. Extraer a public/themes/<id>/
  const destDir = path.join(THEMES_DIR, id);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  for (const [name, bytes] of Object.entries(files)) {
    if (name.endsWith('/')) continue;
    const filePath = path.join(destDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, bytes);
  }
  console.log(`✓ Extraído en public/themes/${id}/`);

  // 2. Generar ZIP local (artefacto de build, no va a git)
  packThemeDir(id);

  // 3. Actualizar themes-config.json
  const config: ThemesConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const existing = config.themes.find((t) => t.id === id);
  const entry: ThemeEntry = {
    id,
    name: existing?.name ?? id.replace(/_/g, ' '),
    activity: activity ?? existing?.activity ?? '',
    language,
    description: description ?? existing?.description ?? '',
    screenshot: null,
  };

  if (existing) {
    Object.assign(existing, entry);
    console.log(`✓ Entrada actualizada en themes-config.json`);
  } else {
    config.themes.push(entry);
    console.log(`✓ Entrada añadida a themes-config.json`);
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

  // Resumen
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tema "${id}" preparado para publicación.`);
  console.log('Para distribuirlo a todos los compañeros:');
  console.log('');
  console.log(`  git add public/themes/${id}/ public/themes-config.json`);
  console.log(`  git commit -m "feat(themes): publicar ${id}"`);
  console.log(`  git push`);
  console.log('');
  console.log('GitHub Pages se redespliega en 1-2 minutos.');
}

main();
