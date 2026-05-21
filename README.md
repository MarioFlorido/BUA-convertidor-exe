# 📚 BUA Convertidor eXe - Word → eXeLearning

**ConvertidoreXe v1.0** - Herramienta para convertir documentos Word (DOCX) a formato eXeLearning (ELPX) con soporte para múltiples temas visuales.

**Desarrollado por:** Biblioteca Universitaria, Universidad de Alicante

---

## 🎯 Descripción General

ConvertidoreXe es una **aplicación web moderna** que permite:

1. **Cargar documentos Word** (DOCX)
2. **Configurar estructura** (elegir niveles H1, H2, H3)
3. **Seleccionar tema visual** (Doctorado, PhD, etc.)
4. **Generar eXeLearning** (formato ELPX)
5. **Descargar** el archivo ELPX generado

### Características principales

✅ **Conversión DOCX → ELPX**
- Preserva contenido, estructura y formato
- Soporte para encabezados, párrafos, tablas, imágenes
- Procesamiento en el cliente (privado, sin servidor central)

✅ **Sistema de temas**
- Temas visuales personalizables (Doctorado, PhD, Base, etc.)
- Carga/eliminación dinámica de temas via admin panel
- Estilos CSS aplicados automáticamente

✅ **Interfaz intuitiva**
- Flujo paso a paso guiado
- Vista previa en tiempo real
- Mensajes de progreso detallados

✅ **Configuración flexible**
- Elegir niveles de encabezados (H1→página, H2→sección, H3→bloque)
- Procesamiento automático de tablas y listas
- Manejo inteligente de imágenes incrustadas

---

## 📁 Estructura del Proyecto

```
BUA-convertidor-exe/
├── src/                          # Código fuente (React + TypeScript)
│   ├── App.tsx                   # Componente raíz (flujo principal)
│   ├── main.tsx                  # Punto de entrada
│   │
│   ├── components/               # Componentes React (UI)
│   │   ├── AppHeader.tsx         # Encabezado (logo, navegación, botón admin)
│   │   ├── UploadZone.tsx        # Zona drag-and-drop de carga DOCX
│   │   ├── StructureConfigurator.tsx  # Configurar H1→página, H2→sección, H3→bloque
│   │   ├── ThemeSelector.tsx     # Seleccionar tema visual (con preview)
│   │   ├── ThemeManager.tsx      # Admin de temas (cargar/eliminar ZIP)
│   │   ├── ConfigPanel.tsx       # Panel de configuración y opciones
│   │   └── DownloadButton.tsx    # Botón descargar ELPX generado
│   │
│   ├── core/                     # Lógica de negocio (conversión)
│   │   ├── docxToElpx.ts         # NÚCLEO: Conversión DOCX → ELPX
│   │   │                         #   - Extrae HTML con Mammoth
│   │   │                         #   - Construye estructura XML
│   │   │                         #   - Combina tema + contenido
│   │   │                         #   - Genera ZIP final (ELPX)
│   │   ├── buildFromStructure.ts # Construcción de estructura XML
│   │   │                         #   - Mapea contenido a páginas/bloques
│   │   │                         #   - Aplica clases CSS BUA
│   │   └── parseStructure.ts     # Análisis de jerarquía H1/H2/H3
│   │
│   ├── server/                   # Servidor Node.js (Temas)
│   │   ├── themeServer.ts        # Servidor Express (puerto 5175)
│   │   │                         #   - Endpoints API de temas
│   │   │                         #   - Manejo de uploads
│   │   └── themeHandler.ts       # Handlers de API
│   │                             #   - POST /api/upload-theme
│   │                             #   - DELETE /api/themes/:id
│   │                             #   - GET /api/themes
│   │
│   ├── styles/                   # Estilos CSS
│   │   └── globals.css           # Estilos globales (colores, tipografía, layout)
│   │
│   └── types/                    # Tipos TypeScript (interfases)
│       └── index.ts              # Tipos compartidos (DocxImportOptions, etc)
│
├── public/                       # Archivos estáticos (servidor Vite)
│   ├── base.elpx                 # Plantilla base eXeLearning (CRÍTICA)
│   │                             # - XML structure
│   │                             # - Content template
│   │                             # - Default theme
│   ├── Doctorado_26-27.zip       # Tema: Doctorado 2026-27
│   ├── Doctorat_26-27.zip        # Tema: Doctorat (Catalán) 2026-27
│   ├── PhD_26-27.zip             # Tema: PhD 2026-27
│   └── themes-config.json        # Configuración de temas disponibles
│                                 # { "themes": [ { "id", "name", ... } ] }
│
├── index.html                    # Punto de entrada HTML
├── vite.config.ts                # Configuración Vite (builder)
├── tsconfig.json                 # Configuración TypeScript
├── package.json                  # Dependencias npm
├── package-lock.json             # Lock file de dependencias
└── README.md                     # Este archivo

```

---

## 🔄 Flujo de la Aplicación

### Vista General del Flujo

```
┌─────────────────────────────────────────────────────────┐
│                    USUARIO FINAL                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  UPLOAD ZONE: Cargar documento Word (.docx)             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  STRUCTURE CONFIGURATOR: Elegir H1/H2/H3                │
│  - H1 → página / bloque                                  │
│  - H2 → página / bloque                                  │
│  - H3 → bloque                                           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  THEME SELECTOR: Elegir tema visual                      │
│  - Doctorado, PhD, Doctorat, Base                        │
│  - Preview de screenshot                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  CONVERSIÓN (docxToElpx.ts)                             │
│  ├─ Extraer HTML del DOCX (Mammoth)                    │
│  ├─ Analizar estructura H1/H2/H3                        │
│  ├─ Cargar plantilla base (base.elpx)                  │
│  ├─ Cargar tema personalizado                          │
│  ├─ Aplicar estructura y contenido                     │
│  └─ Generar ELPX (ZIP)                                 │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  DOWNLOAD BUTTON: Descargar archivo.elpx               │
│  - Muestra estadísticas (páginas, bloques, etc)        │
└─────────────────────────────────────────────────────────┘
                           ↓
                    ¡ARCHIVO DESCARGADO!
```

---

## 🔧 Componentes Detallados

### `src/components/` (Interfaz de Usuario)

| Componente | Función | Puerto |
|-----------|---------|--------|
| **AppHeader.tsx** | Encabezado, logo, botón admin | Vite (5174) |
| **UploadZone.tsx** | Drag-and-drop para cargar DOCX | Vite (5174) |
| **StructureConfigurator.tsx** | Elegir H1/H2/H3 niveles | Vite (5174) |
| **ThemeSelector.tsx** | Elegir tema + preview | Vite (5174) |
| **ThemeManager.tsx** | Admin temas (cargar/eliminar) | Express (5175) |
| **ConfigPanel.tsx** | Opciones de configuración | Vite (5174) |
| **DownloadButton.tsx** | Descarga de ELPX | Vite (5174) |

#### Detalles por componente:

**UploadZone.tsx**
- Interfaz drag-and-drop para archivos DOCX
- Validación de tipo: solo `.docx`
- Inicia el procesamiento del documento
- Emite evento `onFileSelect(file)`

**StructureConfigurator.tsx**
- Permite configurar niveles de encabezados
- Opciones disponibles:
  - H1 → `page` (nueva página en eXeLearning)
  - H1 → `block` (bloque dentro de página)
  - H2 → `page` o `block`
  - H3 → `block`
- Vista previa de estructura resultante
- Emite `onConfirm(structure)` cuando está configurado

**ThemeSelector.tsx**
- Lista de temas cargados desde `themes-config.json`
- Muestra nombre, actividad, idioma, descripción
- Mostrador de screenshot/vista previa
- Selecciona tema para aplicar al ELPX
- Emite `onConfirm(themeId)` al continuar

**ThemeManager.tsx**
- **⚠️ REQUIERE servidor ejecutándose:** `npm run theme-server`
- Permite:
  - Cargar temas (ZIP → `/public/themes/`)
  - Eliminar temas existentes
  - Auto-actualiza `themes-config.json`
- Endpoints API (en puerto 5175):
  - `POST /api/upload-theme` → Cargar tema ZIP
  - `DELETE /api/themes/:id` → Eliminar tema
  - `GET /api/themes` → Listar temas actuales

**DownloadButton.tsx**
- Botón principal para descargar ELPX generado
- Muestra información de conversión:
  - Nombre archivo
  - Cantidad de páginas
  - Cantidad de bloques
- Genera blob del ELPX y dispara descarga

**AppHeader.tsx**
- Encabezado visual de la aplicación
- Logo y branding
- Botón para acceder a ThemeManager

**ConfigPanel.tsx**
- Panel secundario de opciones/configuración
- Ajustes globales de conversión
- Preferencias de usuario

---

## 🔧 Módulos Core (Lógica de Conversión)

### `src/core/docxToElpx.ts` (⭐ ARCHIVO CRÍTICO)

**El núcleo de toda la conversión DOCX → ELPX**

#### Arquitectura:

```
DOCX input
    ↓
convertDocxToElpx()
    ├─ extractDocxHtml()          → Mammoth extrae HTML
    ├─ buildProjectFromHtml()     → Estructura XML
    ├─ loadBaseTemplate()         → base.elpx
    ├─ loadThemeEntries()         → Tema personalizado
    └─ buildElpxFromTemplate()    → ZIP final
    ↓
ELPX output
```

#### Funciones principales:

**`convertDocxToElpx(file, options, structure, onProgress)`**
- **Punto de entrada principal** de la conversión
- Pasos:
  1. Leer buffer del archivo DOCX
  2. Extraer HTML usando Mammoth
  3. Si tema ≠ 'base': cargar tema personalizado
  4. Construir estructura y contenido
  5. Generar ELPX final
- **Retorna:** `ImportToElpxResult` (blob + metadatos)

**`extractDocxHtml(buffer)`**
- Usa librería `mammoth`
- Convierte DOCX binario → HTML limpio
- Preserva: párrafos, encabezados, tablas, imágenes

**`buildProjectFromHtml(html, filename, options, structure)`**
- Analiza el HTML extraído
- Construye objeto `ImportedProject` con estructura interna
- Asigna contenido a páginas y bloques según H1/H2/H3
- **Clases BUA aplicadas:**
  - `.bua_ejemplo` → Ejemplos
  - `.bua_definicion` → Definiciones
  - `.bua_importante` → Contenido importante
  - `.horizontal-table` / `.vertical-table` → Tablas

**`loadBaseTemplate()`**
- Carga `/public/base.elpx` desde servidor Vite
- Extrae con `unzipSync` todos los archivos internos
- Valida: must contain `content.xml`
- **⚠️ CRÍTICA:** Si falta base.elpx, la conversión FALLA

**`loadThemeEntries(themeId)`**
- Carga tema personalizado de `/public/{themeId}.zip`
- Extrae archivos del ZIP
- **Prefija con `theme/`** para insertar correctamente en ELPX
- Retorna: `Record<string, Uint8Array>` de archivos

**`convertProjectToElpx(project, filename, extraEntries, onProgress, themeId)`**
- Combina:
  - Plantilla base (base.elpx)
  - Contenido del proyecto
  - Archivos del tema personalizado
- Generador final del ZIP
- **Retorna:** `ImportToElpxResult` con blob descargable

**`buildElpxFromTemplate(template, project, themeId)`**
- Construye estructura XML interna del ELPX
- Inserta contenido en `content.xml`
- Aplica metadata
- Genera ZIP final con `zipSync`

---

### `src/core/buildFromStructure.ts`

**Construye la estructura XML interna de eXeLearning**

#### Funciones:

**`buildProjectFromStructure(structure, html, options)`**
- Procesa HTML según estructura configurada (H1/H2/H3)
- Crea páginas y bloques en eXeLearning
- Mapea contenido a la estructura jerárquica
- **Retorna:** `ImportedProject` (objeto XML)

**`applyTableClasses(html)`**
- Detecta elementos `<table>` en HTML
- Analiza estructura (filas, columnas)
- Agrega clases CSS BUA:
  - `.horizontal-table` → Tabla horizontal (más columnas)
  - `.vertical-table` → Tabla vertical (más filas)

**`applyDivClasses(html)`**
- Detecta divisores y elementos especiales en HTML
- Identifica patrones (párrafos especiales, cajas, etc)
- Agrega clases CSS BUA:
  - `.bua_ejemplo` → Para ejemplos
  - `.bua_definicion` → Para definiciones
  - `.bua_importante` → Para contenido importante

---

### `src/core/parseStructure.ts`

**Análisis de la jerarquía H1/H2/H3**

**`parseDocumentStructure(htmlContent)`**
- Extrae todos los encabezados del documento
- Detecta jerarquía: H1 > H2 > H3
- Construye árbol de estructura
- **Retorna:** `DocumentStructure` (para preview y análisis)

---

## 🌐 Sistema de Temas

### ¿Qué es un tema?

Un **tema** es un archivo ZIP que contiene:
- **Estilos CSS** personalizados
- **Configuración** (metadata)
- **Recursos** (imágenes, fuentes, iconos)

### Estructura de un tema ZIP

```
tema-name.zip/
├── config.xml          # Metadatos (ID, nombre, descripción)
├── style.css           # Estilos CSS principales
├── style.js            # Scripts JavaScript (opcional)
├── screenshot.png      # Captura para preview
├── fonts/              # Fuentes customizadas (opcional)
├── icons/              # Iconos personalizados (opcional)
└── img/                # Imágenes de recursos
```

### Temas incluidos

| Tema | Archivo | Descripción | Idioma |
|------|---------|-------------|--------|
| **Base** | (integrado en base.elpx) | Plantilla estándar eXeLearning | ES |
| **Doctorado** | Doctorado_26-27.zip | Tema Doctorado Universidad de Alicante | ES |
| **Doctorat** | Doctorat_26-27.zip | Doctorat (Versión en Catalán) | CA |
| **PhD** | PhD_26-27.zip | Tema PhD | ES |

### Cargar nuevo tema

1. En la aplicación, ir a **"Administrador de Temas"**
2. Seleccionar archivo ZIP
3. Sistema auto-extrae a `/public/themes/`
4. Auto-actualiza `themes-config.json`
5. Tema disponible inmediatamente en selector

### `themes-config.json`

Define los temas disponibles:

```json
{
  "themes": [
    {
      "id": "base",
      "name": "Base eXeLearning",
      "activity": "Por defecto",
      "language": "es",
      "description": "Tema estándar de eXeLearning",
      "screenshot": null
    },
    {
      "id": "Doctorado_26-27",
      "name": "Doctorado",
      "activity": "Doctorado",
      "language": "es",
      "description": "Tema Doctorado Universidad de Alicante 2026-27",
      "screenshot": "/Doctorado_26-27/screenshot.png"
    }
  ]
}
```

---

## 🚀 Instalación y Uso

### Requisitos previos

- **Node.js** >= 16
- **npm** >= 8

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/MarioFlorido/BUA-convertidor-exe.git
cd BUA-convertidor-exe

# Instalar dependencias
npm install
```

### Uso

#### Opción 1: Con servidor de temas (RECOMENDADO)

```bash
# Terminal 1: Servidor de temas (puerto 5175)
npm run theme-server

# Terminal 2: Aplicación Vite (puerto 5174)
npm run dev
```

Accede a: **http://localhost:5174**

#### Opción 2: Sin servidor (solo lectura de temas)

```bash
# Solo aplicación (sin admin de temas)
npm run dev
```

Accede a: **http://localhost:5174**

---

### Puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| Vite (Aplicación) | 5174 | http://localhost:5174 |
| Express (Temas) | 5175 | http://localhost:5175 |

---

## 📦 Comandos npm

```bash
npm run dev           # Inicia Vite (aplicación)
npm run build         # Compilar para producción
npm run preview       # Vista previa de build producción
npm run theme-server  # Iniciar servidor de temas (Express)
npm run type-check    # Verificar tipos TypeScript
```

---

## 🔗 Dependencias Principales

### Frontend (Vite + React)
- **React 18** - Framework UI
- **TypeScript** - Tipado estático fuerte
- **Vite** - Build tool ultra-rápido

### Conversión DOCX
- **mammoth** (^1.6.0) - Extrae HTML limpio de DOCX

### Compresión/Descompresión
- **fflate** (^0.8.0) - ZIP/DEFLATE nativo

### Backend (Servidor de temas)
- **Express.js** (^4.x) - Framework HTTP
- **multer** - Middleware para uploads de archivos

### Desarrollo
- **TypeScript** - Tipado para TypeScript
- **Vite** - Hot reload y bundling

---

## 🔐 Seguridad & Consideraciones

### Privacidad

✅ **Procesamiento en cliente (Vite)**
- Archivo DOCX procesado EN el navegador
- NO se envía a servidor externo
- NO se guarda en servidor

✅ **Archivos temporales**
- Se almacenan solo en memoria
- Se limpian automáticamente al terminar

### Validaciones

- ✅ Solo archivos `.docx` en upload
- ✅ Solo archivos `.zip` en tema manager
- ✅ Validación de estructura ZIP/ELPX
- ✅ Validación MIME type
- ✅ Límites de tamaño configurables

### Consideraciones especiales

⚠️ **Temas en `/public/`**
- Son accesibles directamente vía HTTP
- Es por diseño (necesario para cargar)
- No contienen datos sensibles

⚠️ **base.elpx crítica**
- DEBE existir en `/public/`
- Es la plantilla por defecto
- Sin ella, NO funciona la aplicación

---

## 🐛 Troubleshooting

### "No se pudo cargar la plantilla base"

**Causa:** Falta `/public/base.elpx`

**Solución:**
```bash
# Verificar que existe
ls -la public/base.elpx

# Si no existe, restaurar desde git
git checkout public/base.elpx

# Reiniciar servidor
npm run dev
```

---

### "Tema no encontrado"

**Causa:** Tema en `themes-config.json` pero no existe archivo ZIP

**Solución:**
1. Verificar `/public/{tema}.zip` existe
2. Verificar `themes-config.json` incluye el tema
3. Recargar página en navegador
4. Revisar console para errores

---

### "Error de servidor 5175"

**Causa:** Servidor de temas no está ejecutándose

**Solución:**
```bash
# Iniciar servidor temas en otra terminal
npm run theme-server

# Verificar puerto no está en uso
lsof -i :5175

# Si está en uso, cambiar puerto en themeServer.ts
```

---

### "ELPX generado pero vacío/incompleto"

**Causa:** Estructura H1/H2/H3 no configurada o DOCX sin contenido

**Solución:**
1. Verificar estructura está configurada en paso 2
2. Verificar DOCX tiene contenido en los niveles especificados
3. Revisar console para warnings
4. Ver logs en ThemeManager si hay errores de tema

---

### "Tema no se aplica al ELPX"

**Causa:** Tema no está bien formado o no se cargó correctamente

**Solución:**
1. Verificar estructura ZIP del tema
2. Verificar `themes-config.json` está actualizado
3. Eliminar tema y recargarlo
4. Usar tema 'base' para verificar flujo

---

## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| Componentes React | 7 |
| Módulos Core | 3 |
| Archivos TypeScript | 15+ |
| Líneas de código (core) | ~5000+ |
| Temas incluidos | 4 (Base + 3 personalizados) |
| Soporte de idiomas | 2 (ES, CA) |
| Navegadores soportados | Todos (ES6+) |

---

## 📝 Guía de Desarrollo

### Agregar nuevo tema

1. Preparar ZIP con estructura correcta
2. Guardar en `/public/{nombre}.zip`
3. Agregar entrada a `themes-config.json`
4. Iniciar servidor y recargar página

### Modificar flujo UI

1. Editar componentes en `src/components/`
2. Si afecta flujo principal: modificar `App.tsx`
3. Ejecutar `npm run dev` para live reload

### Agregar nuevas clases BUA

1. Modificar `applyDivClasses()` en `buildFromStructure.ts`
2. Agregar estilos CSS en tema
3. Testear con DOCX de prueba

### Debug de conversión

1. Abrir DevTools (F12)
2. Pestaña Console para logs
3. Logs tienen prefijo `[PDF-DEBUG]` o `[DEBUG]`

---

## 📚 Referencias Externas

- **eXeLearning:** https://exelearning.net/
- **Mammoth.js:** https://github.com/mwilson/mammoth.js/
- **Vite:** https://vitejs.dev/
- **React:** https://react.dev/
- **TypeScript:** https://www.typescriptlang.org/

---

## 📄 Licencia

Este proyecto está bajo licencia **GPL-3.0** (ver archivo LICENSE)

```
Creative Commons Attribution-Share Alike 4.0
Biblioteca Universitaria, Universidad de Alicante
```

---

## ✅ Estado del Proyecto

### Phase 1: DOCX → ELPX
- ✅ **COMPLETADO Y FUNCIONAL**
- Cargar DOCX
- Configurar estructura H1/H2/H3
- Seleccionar temas
- Generar ELPX
- Descargar archivo
- Sistema de temas (cargar/eliminar)

### Phase 2: DOCX → PDF
- ⏸️ **PAUSADO - En evaluación**
- Investigación completada
- Decisión: Requiere enfoque diferente (Backend)
- Ver: `INFORME_PDF_EXPORT_PHASE2.md` (en la rama)

---

## 📞 Soporte

Para problemas o sugerencias:
1. Revisar sección **Troubleshooting**
2. Verificar console del navegador (F12)
3. Revisar logs del servidor
4. Contactar a Biblioteca Universitaria

---

**Última actualización:** Mayo 2026  
**Versión:** 1.0.0  
**Desarrollado por:** Biblioteca Universitaria, Universidad de Alicante  
**Repositorio:** https://github.com/MarioFlorido/BUA-convertidor-exe
