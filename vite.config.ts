import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { zipSync } from 'fflate'

/**
 * Middleware para servir temas como ZIPs dinámicos
 * Permite cargar temas desde carpetas en public/themes/
 */
function themeZipMiddleware() {
  return {
    name: 'theme-zip-middleware',
    apply: 'serve',
    configResolved() {
      // Noop
    },
    configureServer(server: any) {
      return () => {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          // Interceptar requests a *.zip que no sean archivos reales
          if (!req.url.endsWith('.zip')) {
            return next()
          }

          // Extraer nombre del tema
          const match = req.url.match(/\/([^\/]+)\.zip(?:\?|$)/)
          if (!match) {
            return next()
          }

          const themeName = match[1]
          const themeDir = path.join(process.cwd(), 'public', 'themes', themeName)

          // Si la carpeta existe, comprimirla y servirla
          if (fs.existsSync(themeDir) && fs.statSync(themeDir).isDirectory()) {
            try {
              const files: Record<string, Uint8Array> = {}

              // Recursively read all files from theme directory
              function readDirRecursive(dir: string, prefix: string = '') {
                const entries = fs.readdirSync(dir, { withFileTypes: true })

                for (const entry of entries) {
                  // Skip macOS artifacts
                  if (entry.name === '__MACOSX' || entry.name === '.DS_Store') {
                    continue
                  }

                  const fullPath = path.join(dir, entry.name)
                  const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

                  if (entry.isDirectory()) {
                    readDirRecursive(fullPath, relativePath)
                  } else {
                    const content = fs.readFileSync(fullPath)
                    files[relativePath] = new Uint8Array(content)
                  }
                }
              }

              readDirRecursive(themeDir)

              // Create ZIP
              const zipData = zipSync(files, { level: 0 })
              const buffer = Buffer.from(zipData)

              // Send as downloadable ZIP
              res.setHeader('Content-Type', 'application/zip')
              res.setHeader('Content-Length', buffer.length)
              res.setHeader('Cache-Control', 'no-cache, must-revalidate')
              res.end(buffer)
              return
            } catch (error) {
              console.error(`Error creating ZIP for theme ${themeName}:`, error)
              res.status(500).end(`Error creating ZIP: ${error}`)
              return
            }
          }

          next()
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), themeZipMiddleware()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
