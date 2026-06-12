import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { zipSync } from 'fflate';

/**
 * Middleware de desarrollo: sirve temas como ZIPs dinámicos.
 * Solo activo en dev (`apply: 'serve'`).
 * En producción los ZIPs ya existen en public/ y se sirven estáticos.
 */
function themeZipMiddleware() {
  return {
    name: 'theme-zip-middleware',
    apply: 'serve' as const,
    configureServer(server: any) {
      return () => {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          if (!req.url.endsWith('.zip')) return next();

          const match = req.url.match(/\/([^\/]+)\.zip(?:\?|$)/);
          if (!match) return next();

          const themeName = match[1];
          const themeDir = path.join(process.cwd(), 'public', 'themes', themeName);

          if (fs.existsSync(themeDir) && fs.statSync(themeDir).isDirectory()) {
            try {
              const files: Record<string, Uint8Array> = {};

              function readDirRecursive(dir: string, prefix: string = '') {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                  if (entry.name === '__MACOSX' || entry.name === '.DS_Store') continue;
                  const fullPath = path.join(dir, entry.name);
                  const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
                  if (entry.isDirectory()) {
                    readDirRecursive(fullPath, relativePath);
                  } else {
                    files[relativePath] = new Uint8Array(fs.readFileSync(fullPath));
                  }
                }
              }

              readDirRecursive(themeDir);
              const zipData = zipSync(files, { level: 0 });
              const buffer = Buffer.from(zipData);

              res.setHeader('Content-Type', 'application/zip');
              res.setHeader('Content-Length', buffer.length);
              res.setHeader('Cache-Control', 'no-cache, must-revalidate');
              res.end(buffer);
              return;
            } catch (error) {
              console.error(`Error creating ZIP for theme ${themeName}:`, error);
              return next();
            }
          }

          next();
        });
      };
    },
  };
}

export default defineConfig({
  // Base path para GitHub Pages
  base: '/BUA-convertidor-exe/',

  plugins: [react(), themeZipMiddleware()],

  server: {
    // PORT lo inyectan herramientas (p. ej. el preview de Claude) para no
    // chocar con el dev server habitual de 5173; sin PORT todo sigue igual.
    port: Number(process.env.PORT) || 5173,
    open: !process.env.PORT,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
