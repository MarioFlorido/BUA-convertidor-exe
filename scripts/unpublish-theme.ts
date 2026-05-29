/**
 * unpublish-theme — retira un tema del repositorio (deja de estar disponible para todos)
 *
 * Uso:
 *   npm run unpublish-theme <id-del-tema>
 *
 * Qué hace:
 *   1. Borra public/<id>.zip
 *   2. Borra public/themes/<id>/
 *   3. Quita la entrada de public/themes-config.json
 *
 * No hace commit ni push: te muestra el comando para hacerlo cuando quieras.
 * El tema "base" no se puede retirar.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THEMES_DIR = path.join(PUBLIC_DIR, 'themes');
const CONFIG_PATH = path.join(PUBLIC_DIR, 'themes-config.json');

function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Uso: npm run unpublish-theme <id-del-tema>');
    process.exit(1);
  }
  if (id === 'base') {
    console.error('✗ El tema "base" no se puede retirar (es fijo del sistema)');
    process.exit(1);
  }

  const themeDir = path.join(THEMES_DIR, id);
  const config: { themes: Array<{ id: string }> } = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const entryIdx = config.themes.findIndex((t) => t.id === id);

  if (!fs.existsSync(themeDir) && entryIdx === -1) {
    console.error(`✗ No se encontró nada relacionado con "${id}"`);
    process.exit(1);
  }

  if (fs.existsSync(themeDir)) {
    fs.rmSync(themeDir, { recursive: true });
    console.log(`✓ Eliminado public/themes/${id}/`);
  }
  if (entryIdx !== -1) {
    config.themes.splice(entryIdx, 1);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
    console.log(`✓ Entrada retirada de themes-config.json`);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tema "${id}" retirado localmente. Para propagar:`);
  console.log('');
  console.log(`  git add -u public/`);
  console.log(`  git commit -m "feat(themes): retirar ${id}"`);
  console.log(`  git push`);
}

main();
