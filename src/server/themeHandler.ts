import fs from 'fs/promises';
import path from 'path';
import { unzip } from 'fflate';

interface ThemeConfig {
  id: string;
  name: string;
  activity: string;
  language: string;
  description: string;
  screenshot?: string | null;
}

interface ThemesConfig {
  themes: ThemeConfig[];
}

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const THEMES_DIR = path.join(PUBLIC_DIR, 'themes');
const THEMES_CONFIG_PATH = path.join(PUBLIC_DIR, 'themes-config.json');

export async function extractThemeZip(
  zipBuffer: Buffer,
  themeId: string
): Promise<ThemeConfig> {
  return new Promise((resolve, reject) => {
    unzip(zipBuffer as Uint8Array, async (err, files) => {
      if (err) {
        reject(new Error(`Error al descomprimir ZIP: ${err.message}`));
        return;
      }

      try {
        // Crear directorio del tema
        const themeDir = path.join(THEMES_DIR, themeId);
        await fs.mkdir(themeDir, { recursive: true });

        // Extraer archivos
        for (const [fileName, fileData] of Object.entries(files)) {
          const filePath = path.join(themeDir, fileName);
          const dirPath = path.dirname(filePath);

          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(filePath, fileData);
        }

        // Crear entrada de tema con valores por defecto
        const newTheme: ThemeConfig = {
          id: themeId,
          name: themeId.replace(/_/g, ' '),
          activity: '',
          language: 'es',
          description: '',
          screenshot: null,
        };

        // Actualizar themes-config.json
        let config: ThemesConfig = { themes: [] };
        try {
          const configContent = await fs.readFile(THEMES_CONFIG_PATH, 'utf-8');
          config = JSON.parse(configContent);
        } catch {
          // Si el archivo no existe, crear uno nuevo
          config = { themes: [] };
        }

        // Verificar si el tema ya existe
        const existingIndex = config.themes.findIndex((t) => t.id === themeId);
        if (existingIndex >= 0) {
          // Reemplazar tema existente
          config.themes[existingIndex] = newTheme;
        } else {
          // Agregar nuevo tema
          config.themes.push(newTheme);
        }

        // Guardar configuración
        await fs.writeFile(THEMES_CONFIG_PATH, JSON.stringify(config, null, 2));

        resolve(newTheme);
      } catch (error) {
        reject(
          new Error(
            `Error al procesar tema: ${error instanceof Error ? error.message : 'Error desconocido'}`
          )
        );
      }
    });
  });
}

export async function deleteTheme(themeId: string): Promise<void> {
  try {
    // Eliminar directorio del tema
    const themeDir = path.join(THEMES_DIR, themeId);
    await fs.rm(themeDir, { recursive: true, force: true });

    // Actualizar themes-config.json
    let config: ThemesConfig = { themes: [] };
    try {
      const configContent = await fs.readFile(THEMES_CONFIG_PATH, 'utf-8');
      config = JSON.parse(configContent);
    } catch {
      return;
    }

    // Eliminar tema de la configuración
    config.themes = config.themes.filter((t) => t.id !== themeId);

    // Guardar configuración
    await fs.writeFile(THEMES_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(
      `Error al eliminar tema: ${error instanceof Error ? error.message : 'Error desconocido'}`
    );
  }
}

export async function getAvailableThemes(): Promise<ThemeConfig[]> {
  try {
    const configContent = await fs.readFile(THEMES_CONFIG_PATH, 'utf-8');
    const config: ThemesConfig = JSON.parse(configContent);
    return config.themes;
  } catch {
    return [];
  }
}
