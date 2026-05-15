import express from 'express';
import multer from 'multer';
import path from 'path';
import { extractThemeZip, deleteTheme, getAvailableThemes } from './themeHandler.js';

const app = express();
const PORT = 5175;

// Configurar multer para manejo de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos ZIP'));
    }
  },
});

// Middleware
app.use(express.json());

// Habilitar CORS para requests desde Vite
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('  → OPTIONS preflight OK');
    return res.sendStatus(200);
  }
  next();
});

// Endpoint: GET /api/themes - obtener lista de temas
app.get('/api/themes', async (_req, res) => {
  try {
    const themes = await getAvailableThemes();
    res.json({ success: true, themes });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

// Endpoint: POST /api/upload-theme - subir nuevo tema
app.post('/api/upload-theme', upload.single('theme'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se subió ningún archivo',
      });
    }

    // Obtener el ID del tema del nombre del archivo (sin extensión .zip)
    const themeId = path.basename(req.file.originalname, '.zip');

    if (!themeId) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de archivo inválido',
      });
    }

    // Procesar el ZIP
    const theme = await extractThemeZip(req.file.buffer, themeId);

    res.json({
      success: true,
      message: `Tema "${themeId}" cargado correctamente`,
      theme,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

// Endpoint: DELETE /api/themes/:id - eliminar tema
app.delete('/api/themes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`  → DELETE /api/themes/${id}`);

    if (!id) {
      console.log('    ✗ ID no proporcionado');
      return res.status(400).json({
        success: false,
        error: 'ID de tema no proporcionado',
      });
    }

    console.log(`    ⏳ Eliminando tema "${id}"...`);
    await deleteTheme(id);
    console.log(`    ✓ Tema "${id}" eliminado`);

    res.json({
      success: true,
      message: `Tema "${id}" eliminado correctamente`,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.log(`    ✗ Error: ${errorMsg}`);
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎨 Servidor de temas escuchando en http://localhost:${PORT}`);
  console.log(`📤 Endpoint: POST /api/upload-theme`);
  console.log(`📋 Endpoint: GET /api/themes`);
  console.log(`🗑️  Endpoint: DELETE /api/themes/:id\n`);
});
