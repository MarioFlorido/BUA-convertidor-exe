/**
 * themes — gestión interactiva de temas oficiales
 *
 * Uso: npm run themes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { packThemeDir } from './pack-themes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THEMES_DIR = path.join(PUBLIC_DIR, 'themes');
const CONFIG_PATH = path.join(PUBLIC_DIR, 'themes-config.json');

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ThemeEntry {
  id: string;
  name: string;
  activity?: string;
  language?: string;
  description?: string;
  screenshot?: string | null;
}

// ── Utilidades ─────────────────────────────────────────────────────────────

function readConfig(): ThemeEntry[] {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')).themes as ThemeEntry[];
}

function writeConfig(themes: ThemeEntry[]): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ themes }, null, 2) + '\n');
}

function extractLanguage(xml: string): string {
  const m = xml.match(/<language>\s*([a-z]{2})\s*<\/language>/i);
  const v = m?.[1]?.toLowerCase();
  return v === 'es' || v === 'en' || v === 'ca' ? v : 'es';
}

function filterSystemFiles(files: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [name, bytes] of Object.entries(files)) {
    if (name.startsWith('__MACOSX/') || name.includes('/._') ||
        name.endsWith('/.DS_Store') || name === '.DS_Store') continue;
    out[name] = bytes;
  }
  return out;
}

function pickZipFile(): string | null {
  const r = spawnSync('osascript', [
    '-e',
    'POSIX path of (choose file with prompt "Selecciona el ZIP del tema:" of type {"zip"})',
  ], { encoding: 'utf-8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function gitPush(filesToAdd: string[], message: string): void {
  try {
    execSync(`git -C "${ROOT}" add ${filesToAdd.map(f => `"${f}"`).join(' ')}`, { stdio: 'pipe' });
    execSync(`git -C "${ROOT}" commit -m "${message}"`, { stdio: 'pipe' });
    execSync(`git -C "${ROOT}" push origin main`, { stdio: 'pipe' });
    console.log('\n✓ Publicado. GitHub Pages se actualiza en 1-2 minutos.');
  } catch {
    console.log('\n⚠ Push automático fallido. Ejecuta manualmente:');
    console.log(`  git add ${filesToAdd.map(f => `"${f}"`).join(' ')}`);
    console.log(`  git commit -m "${message}"`);
    console.log(`  git push origin main`);
  }
}

function sep(): void {
  console.log('\n' + '─'.repeat(50));
}

// ── Acciones ───────────────────────────────────────────────────────────────

async function publishTheme(rl: ReturnType<typeof createInterface>): Promise<void> {
  sep();
  console.log('PUBLICAR TEMA\n');

  // 1. Seleccionar ZIP
  console.log('Abriendo selector de archivo…');
  const zipPath = pickZipFile();
  if (!zipPath) { console.log('Cancelado.'); return; }
  console.log(`  Archivo: ${path.basename(zipPath)}`);

  // 2. Leer y validar
  let raw: Uint8Array;
  try { raw = new Uint8Array(fs.readFileSync(zipPath)); }
  catch { console.error('✗ No se pudo leer el archivo.'); return; }

  let files: Record<string, Uint8Array>;
  try { files = filterSystemFiles(unzipSync(raw)); }
  catch { console.error('✗ ZIP corrupto.'); return; }

  const missing = ['config.xml', 'style.css'].filter(f => !files[f]);
  if (missing.length) {
    console.error(`✗ Faltan archivos requeridos: ${missing.join(', ')}`);
    return;
  }

  const id       = path.basename(zipPath, '.zip');
  const language = extractLanguage(new TextDecoder().decode(files['config.xml']));
  const existing = readConfig().find(t => t.id === id);

  // 3. Metadatos
  console.log('');
  const defaultName = existing?.name ?? id.replace(/_/g, ' ');
  const nameInput   = await rl.question(`  Nombre visible [${defaultName}]: `);
  const name        = nameInput.trim() || defaultName;

  const defaultActivity = existing?.activity ?? '';
  const actInput        = await rl.question(`  Actividad [${defaultActivity || 'ninguna'}]: `);
  const activity        = actInput.trim() || defaultActivity;

  const defaultDesc = existing?.description ?? '';
  const descInput   = await rl.question(`  Descripción [${defaultDesc || 'ninguna'}]: `);
  const description = descInput.trim() || defaultDesc;

  // 4. Extraer a public/themes/<id>/
  const destDir = path.join(THEMES_DIR, id);
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true });
  for (const [name_, bytes] of Object.entries(files)) {
    if (name_.endsWith('/')) continue;
    const fp = path.join(destDir, name_);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, bytes);
  }
  console.log(`\n✓ Extraído en public/themes/${id}/`);

  // 5. Generar ZIP local
  packThemeDir(id);

  // 6. Actualizar themes-config.json
  const themes  = readConfig();
  const idx     = themes.findIndex(t => t.id === id);
  const entry: ThemeEntry = { id, name, activity, language, description, screenshot: null };
  if (idx >= 0) themes[idx] = entry;
  else themes.push(entry);
  writeConfig(themes);
  console.log('✓ themes-config.json actualizado');

  // 7. Git
  const confirm = await rl.question('\n¿Hacer commit y push ahora? (S/n): ');
  if (confirm.trim().toLowerCase() !== 'n') {
    gitPush(
      [`public/themes/${id}/`, 'public/themes-config.json'],
      `feat(themes): publicar ${id}`,
    );
  }
}

async function downloadTheme(rl: ReturnType<typeof createInterface>): Promise<void> {
  sep();
  console.log('DESCARGAR TEMA\n');

  const themes = readConfig().filter(t => t.id !== 'base');
  if (!themes.length) { console.log('No hay temas oficiales.'); return; }

  themes.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} (${t.id})`));
  const input = await rl.question('\nNúmero del tema: ');
  const idx   = parseInt(input.trim()) - 1;
  if (isNaN(idx) || idx < 0 || idx >= themes.length) {
    console.log('Opción inválida.');
    return;
  }

  const theme   = themes[idx];
  const themeDir = path.join(THEMES_DIR, theme.id);
  if (!fs.existsSync(themeDir)) {
    console.error(`✗ No existe public/themes/${theme.id}/`);
    return;
  }

  packThemeDir(theme.id);
  const zipPath = path.join(PUBLIC_DIR, `${theme.id}.zip`);
  console.log(`\n✓ ZIP generado: ${zipPath}`);

  spawnSync('open', ['-R', zipPath]);
}

async function deleteTheme(rl: ReturnType<typeof createInterface>): Promise<void> {
  sep();
  console.log('ELIMINAR TEMA\n');

  const themes = readConfig().filter(t => t.id !== 'base');
  if (!themes.length) { console.log('No hay temas eliminables.'); return; }

  themes.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} (${t.id})`));
  const input = await rl.question('\nNúmero del tema: ');
  const idx   = parseInt(input.trim()) - 1;
  if (isNaN(idx) || idx < 0 || idx >= themes.length) {
    console.log('Opción inválida.');
    return;
  }

  const theme = themes[idx];
  const confirm = await rl.question(`\n¿Eliminar "${theme.name}"? Esta acción no se puede deshacer. (s/N): `);
  if (confirm.trim().toLowerCase() !== 's') { console.log('Cancelado.'); return; }

  const themeDir = path.join(THEMES_DIR, theme.id);
  if (fs.existsSync(themeDir)) fs.rmSync(themeDir, { recursive: true });

  const all    = readConfig();
  const filtered = all.filter(t => t.id !== theme.id);
  writeConfig(filtered);
  console.log(`\n✓ "${theme.name}" eliminado`);

  const pushConfirm = await rl.question('¿Hacer commit y push ahora? (S/n): ');
  if (pushConfirm.trim().toLowerCase() !== 'n') {
    try {
      execSync(`git -C "${ROOT}" add -u public/`, { stdio: 'pipe' });
      execSync(`git -C "${ROOT}" commit -m "feat(themes): retirar ${theme.id}"`, { stdio: 'pipe' });
      execSync(`git -C "${ROOT}" push origin main`, { stdio: 'pipe' });
      console.log('\n✓ Eliminado. GitHub Pages se actualiza en 1-2 minutos.');
    } catch {
      console.log('\n⚠ Push automático fallido. Ejecuta manualmente:');
      console.log(`  git add -u public/`);
      console.log(`  git commit -m "feat(themes): retirar ${theme.id}"`);
      console.log(`  git push origin main`);
    }
  }
}

// ── Menú principal ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    console.log('\n' + '═'.repeat(50));
    console.log('  GESTIÓN DE TEMAS OFICIALES');
    console.log('═'.repeat(50));
    console.log('  1. Publicar tema nuevo');
    console.log('  2. Descargar tema existente');
    console.log('  3. Eliminar tema');
    console.log('  Q. Salir');
    console.log('─'.repeat(50));

    const choice = await rl.question('  Opción: ');

    switch (choice.trim().toLowerCase()) {
      case '1': await publishTheme(rl); break;
      case '2': await downloadTheme(rl); break;
      case '3': await deleteTheme(rl); break;
      case 'q':
      case 'Q':
        rl.close();
        process.exit(0);
      default:
        console.log('Opción no válida.');
    }

    await rl.question('\nPulsa Enter para continuar…');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
