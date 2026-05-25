# BUA ConvertidoreXe — DOCX → eXeLearning + PDF

**ConvertidoreXe v0.2.0** — Aplicación web 100% cliente que convierte documentos Word (DOCX) a proyectos eXeLearning (ELPX) y los exporta a PDF con tema visual institucional.

**Desarrollado por:** Biblioteca Universitaria, Universidad de Alicante
**Licencia:** GNU GPL v3.0
**Demo:** https://marioflorido.github.io/BUA-convertidor-exe/

---

## ✨ Qué hace

1. **Sube** un documento Word (DOCX) — el proceso ocurre completamente en tu navegador
2. **Configura** la jerarquía (qué hace cada encabezado H1 y H2)
3. **Elige** un tema visual con colores, tipografías y logos institucionales
4. **Descarga** el `.elpx` listo para abrir en eXeLearning
5. **Exporta a PDF** con portada, índice, encabezados/pies y estilos del tema

> 🔒 **Privacidad total**: no hay servidor backend. Ni tu DOCX ni el ELPX salen nunca de tu navegador.

---

## 🏗️ Arquitectura — pipeline de 3 capas

```
DOCX
  ↓
[Capa 1] docxToSemanticDocument.ts
          DocxParser (Mammoth) → parseStructure → SemanticBuilder
  ↓
SemanticDocument        ← núcleo: modelo agnóstico al formato de salida
  ↓                ↓
[Capa 2a]          [Capa 2b]
semanticDocumentToElpx       semanticDocumentToPrintHtml
ElpxRenderer                 PrintThemeLoader + renderCoverPage
                             + renderTableOfContents + printStyles.css
  ↓                ↓
ELPX (ZIP)         HTML autónomo (Paged.js → PDF)
```

El **SemanticDocument** es el corazón de la arquitectura: un modelo de datos puro y agnóstico que describe el documento como páginas y bloques. Los renderers ELPX y PDF son intercambiables — añadir un nuevo formato (SCORM, EPUB, etc.) solo requiere un renderer adicional sin tocar el resto del pipeline.

---

## 🚀 Inicio rápido

### Requisitos
- **Node.js** ≥ 18
- **npm** ≥ 9

### Instalación

```bash
git clone https://github.com/MarioFlorido/BUA-convertidor-exe.git
cd BUA-convertidor-exe
npm install
```

### Desarrollo

```bash
npm run dev          # Vite dev server con HMR
```

Accede a `http://localhost:5173/BUA-convertidor-exe/`

### Build

```bash
npm run build        # Compilación de producción → dist/
npm run preview      # Previsualizar el build
npm run deploy       # Publicar en GitHub Pages
```

---

## 📁 Estructura del proyecto

```
src/
├── App.tsx                            # Orquestador del wizard (5 pasos)
├── main.tsx                           # Entry point: arranca ThemeBoot → React
│
├── components/                        # Interfaz de usuario
│   ├── AppHeader.tsx                  # Cabecera con logo BUA + botón Temas
│   ├── StepIndicator.tsx              # Indicador de progreso del wizard
│   ├── UploadZone.tsx                 # Carga drag-and-drop del DOCX
│   ├── StructureConfigurator.tsx      # Configurar nivel de H1 y opción de H2
│   ├── ThemeSelector.tsx              # Elegir tema visual
│   ├── ThemeManager.tsx               # Administrar temas (cargar/eliminar)
│   ├── DownloadButton.tsx             # Descargar ELPX + exportar PDF + switch portada
│   └── ConfigPanel.tsx                # Opciones globales
│
├── core/
│   ├── boot/
│   │   └── ThemeBoot.ts               # Secuencia de arranque del sistema de temas
│   │
│   ├── models/
│   │   └── SemanticDocument.ts        # Modelo central agnóstico al formato
│   │
│   ├── parsers/
│   │   └── DocxParser.ts              # DOCX → HTML (Mammoth)
│   │
│   ├── parseStructure.ts              # HTML → árbol H1/H2/H3/H4
│   │
│   ├── builders/
│   │   └── SemanticBuilder.ts         # Árbol H1/H2 → SemanticDocument
│   │
│   ├── transformers/
│   │   └── HtmlTransformer.ts         # Aplica clases BUA: [importante]/[ejemplo]/[definición]
│   │
│   ├── docxToSemanticDocument.ts      # Orquestador Capa 1
│   │
│   ├── converters/
│   │   └── semanticDocumentToElpx.ts  # Orquestador Capa 2a
│   │
│   ├── renderers/
│   │   ├── ElpxRenderer.ts            # Genera content.xml del .elpx
│   │   │
│   │   └── html-print/                # Renderer Capa 2b (PDF)
│   │       ├── semanticDocumentToPrintHtml.ts
│   │       ├── PrintThemeLoader.ts    # Carga assets (logos, colores, portada)
│   │       ├── renderCoverPage.ts     # Portada con imagen + licencia CC
│   │       ├── renderTableOfContents.ts
│   │       └── printStyles.css        # CSS Paged Media (@page, running elements)
│   │
│   └── services/                      # Sistema de temas 100% client-side
│       ├── ThemeRegistry.ts           # Fuente de verdad única (singleton)
│       ├── ThemeBundle.ts             # Tipos de los temas
│       ├── ThemeValidator.ts          # Validación + filtrado de archivos sistema
│       ├── BuiltInThemeProvider.ts    # Temas built-in desde public/*.zip
│       ├── UserThemeProvider.ts       # Temas de usuario (IndexedDB)
│       ├── ThemeClientService.ts      # Carga ZIPs en el cliente con fflate
│       ├── ThemeCssManager.ts         # Inyecta CSS del tema activo en <head>
│       ├── BlobUrlRegistry.ts         # Gestión de blob: URLs (screenshots, etc.)
│       └── ThemeService.ts            # Facade legacy del sistema de temas
│
├── styles/
│   └── globals.css                    # Tokens de diseño + estilos UI
│
└── types/
    └── index.ts                       # Tipos compartidos

public/
├── base.elpx                          # Plantilla base eXeLearning
├── themes-config.json                 # Catálogo de temas built-in
├── Doctorado_26-27.zip                # Tema Doctorado (ES)
├── Doctorat_26-27.zip                 # Tema Doctorat (CA/valenciano)
├── PhD_26-27.zip                      # Tema PhD (EN)
├── logo_BUA.png · logo_UA.png · logo_CID.png
└── themes/                            # Carpetas descomprimidas servidas en dev

docs/
├── architecture/ARCHITECTURE.md       # Documentación técnica detallada
├── COMPARISON.md                      # Comparación con otras herramientas
└── ACKNOWLEDGEMENTS.md                # Agradecimientos
```

---

## 🎯 Flujo del wizard (5 pasos)

```
1. UPLOAD       Cargar .docx
2. STRUCTURE    Por cada H1, elegir su nivel jerárquico (página principal /
                subpágina / sub-subpágina). Por cada H2, elegir:
                  • Nombre de iDevice  → título del bloque
                  • H2 en HTML        → encabezado dentro del bloque
                  • Acordeón          → agrupa H2s consecutivos en exe-fx exe-accordion
                  • Pestañas          → agrupa H2s consecutivos en exe-fx exe-tabs
3. THEME        Elegir tema visual
4. CONVERT      DOCX → SemanticDocument → ELPX (en cliente)
5. DOWNLOAD     • Descargar .elpx
                • Vista previa PDF (Paged.js) con opción de incluir imagen
                  de portada del tema (switch)
```

---

## 🏷️ Etiquetas semánticas BUA en el DOCX

Dentro del documento Word puedes marcar cajas semánticas:

```
[Importante]
Contenido del bloque importante.
[fin]

[ejemplo]
Texto del ejemplo.
[fin]

[definición]
Texto de la definición.
[fin]
```

Y clases de tabla aplicadas a la siguiente tabla:

```
[horizontal]   →  tabla horizontal estilizada
[vertical]     →  tabla vertical estilizada
```

Los colores, etiquetas (multilingües) y estilos vienen del CSS del tema activo. Soporta:
- Case-insensitive: `[IMPORTANTE]`, `[Importante]`, `[importante]`
- Tildes: `[definición]` ≡ `[definicion]`
- Bookmarks invisibles de Word (`<a></a>`) dentro de los corchetes — se limpian automáticamente

---

## 🎨 Sistema de temas

### Estructura de un tema (ZIP)

```
{ThemeId}.zip/
├── style.css           # CSS del tema (REQUERIDO)
│                       # Debe incluir comentario "Paleta: #color1 · #color2 ..."
│                       # y clases .bua_ejemplo, .bua_definicion, .bua_importante
│                       # con ::before { content: "Etiqueta" }
├── style.js            # JavaScript del tema (opcional)
├── config.xml          # Metadatos
├── screenshot.png      # Preview para el selector
├── portada_pdf.png     # (opcional) Imagen A4 para portada PDF
└── img/
    ├── logo_BUA.png    # Encabezado del PDF + portada
    ├── logo_UA.png     # Pie del PDF
    └── logo_CID.png    # (opcional)
```

### Temas incluidos

| Tema | ID | Idioma |
|------|-----|--------|
| Doctorado | `Doctorado_26-27` | ES |
| Doctorat | `Doctorat_26-27` | CA |
| PhD | `PhD_26-27` | EN |

### Cargar un tema nuevo

1. Pulsar **Temas** en la cabecera
2. Arrastrar el ZIP al área de carga (o pulsar para seleccionar)
3. El tema se valida, se persiste en **IndexedDB** y queda inmediatamente disponible
4. Para actualizar (nuevo curso), cargar un ZIP con el mismo ID → reemplaza al anterior

---

## 📄 Características del PDF generado

| Elemento | Descripción |
|----------|-------------|
| **Portada** | Imagen `portada_pdf.*` (opcional, con switch ON/OFF) + logo BUA + título + año + licencia CC |
| **Índice** | TOC paginado automáticamente vía `target-counter()` de Paged.js |
| **Encabezado** | Logo BUA (izquierda) + título del documento (derecha) en cada página de contenido |
| **Pie de página** | Logo UA (izquierda) + número de página (centro) |
| **Cajas BUA** | `bua_ejemplo`, `bua_definicion`, `bua_importante` con colores y etiquetas del tema |
| **iDevices con título** | Cabecera coloreada + borde perimetral |
| **Tablas** | Cabecera coloreada con los tokens del tema |
| **Imágenes** | Centradas con sombra sutil |
| **Acordeones/Pestañas** | Expandidos en impresión, sin solapamiento |

### Detección de idioma del tema (3 capas)

1. **Etiquetas BUA del CSS**: `"Exemple"`→CA · `"Example"`→EN · `"Ejemplo"`→ES (más fiable)
2. **Palabras clave del ID**: `PhD`→EN · `Doctorat`/`Grau`/`Màster`→CA
3. **Fallback**: `es`

---

## 🌐 Despliegue

El proyecto se publica automáticamente en GitHub Pages mediante GitHub Actions cada vez que hay push a `main`. Configuración:

- `vite.config.ts` → `base: '/BUA-convertidor-exe/'`
- `.github/workflows/deploy.yml` → build + deploy automático
- Branch `gh-pages` → contiene el build estático

Para desplegar manualmente:

```bash
npm run deploy
```

---

## 📚 Dependencias principales

| Paquete | Uso |
|---------|-----|
| `mammoth` | DOCX → HTML |
| `fflate` | Compresión/descompresión ZIP (ELPX y temas) |
| `idb` | Wrapper de IndexedDB para persistir temas de usuario |
| `react` + `react-dom` | UI |
| `Paged.js` (CDN) | CSS Paged Media polyfill para PDF |

---

## 🛠️ Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Vite + HMR) en puerto 5173 |
| `npm run build` | Build de producción (TypeScript + Vite) → `dist/` |
| `npm run preview` | Previsualizar el build de producción |
| `npm run lint` | ESLint con reporte de directivas no usadas |
| `npm run deploy` | Build + publicación en `gh-pages` |

---

## ❓ Troubleshooting

**"No se pudo cargar la plantilla base"**
Falta `public/base.elpx`. Restaurar con `git checkout public/base.elpx`.

**"Error al cargar idb"**
Falta la dependencia. Ejecuta `npm install`.

**"El tema no aparece en el selector tras subirlo"**
La validación falló (ZIP sin `style.css` o con estructura inválida). Mira la consola del navegador.

**"El PDF no muestra encabezados/pies"**
Paged.js requiere conectividad para cargar desde CDN (`unpkg.com`). Para entornos offline, descarga Paged.js localmente y actualiza la URL en `semanticDocumentToPrintHtml.ts`.

**"Las cajas BUA no tienen colores en el PDF"**
El `style.css` del tema debe declarar `.bua_ejemplo`, `.bua_definicion`, `.bua_importante` con `border-left: Npx solid #color` y `::before { content: "Etiqueta" }`.

**"Página en blanco antes/entre secciones del PDF"**
Si modificas la posición de los running elements en `semanticDocumentToPrintHtml.ts`, debes mantenerlos DENTRO de `<section class="cover-page">` — fuera, generan páginas anónimas por la transición de named-pages.

---

## 🤝 Inspiración y agradecimientos

Inspirado en el trabajo de [Juanjo de Haro](https://hackexe.tiddlyhost.com/#HACKeXe:HACKeXe) sobre HACKeXe. Consulta [docs/COMPARISON.md](docs/COMPARISON.md) para una comparación detallada entre ambas herramientas.

---

## 📋 Estado del proyecto

| Funcionalidad | Estado |
|---|---|
| Conversión DOCX → ELPX | ✅ |
| Sistema de temas client-side con IndexedDB | ✅ |
| Configurador de estructura H1/H2 | ✅ |
| Opciones H2: iDevice / HTML / Acordeón / Pestañas | ✅ |
| Etiquetas semánticas [importante]/[ejemplo]/[definición] | ✅ |
| Robustez frente a bookmarks de Word en etiquetas | ✅ |
| Renderer PDF (Paged.js) con portada/índice/encabezado/pie | ✅ |
| Switch para activar/desactivar imagen de portada | ✅ |
| Detección automática de idioma del tema (ES/EN/CA) | ✅ |
| Despliegue automático en GitHub Pages | ✅ |
| Metadatos ELPX (autoría BUA, licencia CC BY-NC-SA) | ✅ |

---

**Repositorio:** https://github.com/MarioFlorido/BUA-convertidor-exe
**Documentación técnica:** [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
**Changelog:** [CHANGELOG.md](CHANGELOG.md)
