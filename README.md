# BUA Convertidor eXe — DOCX → ELPX + PDF

**ConvertidoreXe v1.1** — Herramienta web para convertir documentos Word (DOCX) a formato eXeLearning (ELPX) con exportación a PDF/impresión.

**Desarrollado por:** Biblioteca Universitaria, Universidad de Alicante  
**Licencia:** CC BY-NC-SA 4.0 — Creative Commons Reconocimiento-NoComercial-CompartirIgual 4.0

---

## Descripción general

ConvertidoreXe es una **aplicación web** que funciona completamente en el navegador (sin procesamiento en servidor externo). Permite:

1. **Cargar** un documento Word (DOCX)
2. **Configurar** la estructura jerárquica (qué hace cada nivel de encabezado)
3. **Seleccionar** un tema visual de eXeLearning
4. **Generar** el archivo ELPX listo para abrir en eXeLearning
5. **Exportar** una vista previa de impresión / PDF con portada, índice y estilos BUA

---

## Arquitectura — pipeline de 3 capas

```
DOCX
  ↓
[Capa 1] docxToSemanticDocument.ts
          DocxParser  →  parseStructure  →  SemanticBuilder
  ↓
SemanticDocument        ← modelo agnóstico al formato de salida
  ↓                ↓
[Capa 2a]          [Capa 2b]
semanticDocumentToElpx  semanticDocumentToPrintHtml
ElpxRenderer            PrintThemeLoader + renderCoverPage
                        + renderTableOfContents + printStyles.css
  ↓                ↓
ELPX (ZIP)         HTML autónomo (Paged.js → PDF)
```

**SemanticDocument** es el núcleo arquitectónico: un modelo de datos puro y agnóstico que describe el documento como páginas y bloques semánticos. Los renderers de ELPX y de impresión son independientes entre sí y no se contaminan.

---

## Estructura del proyecto

```
src/
├── App.tsx                            # Orquestador UI (flujo de 5 pasos)
├── main.tsx
│
├── components/                        # Interfaz de usuario
│   ├── AppHeader.tsx                  # Cabecera y acceso a gestión de temas
│   ├── UploadZone.tsx                 # Carga drag-and-drop de DOCX
│   ├── StructureConfigurator.tsx      # Configurar H1/H2/H3 por encabezado
│   ├── ThemeSelector.tsx              # Elegir tema visual (con preview)
│   ├── ThemeManager.tsx               # Admin de temas (cargar/eliminar ZIP)
│   ├── DownloadButton.tsx             # Descargar ELPX y exportar PDF
│   └── ConfigPanel.tsx                # Opciones globales de conversión
│
├── types/
│   └── index.ts                       # Tipos compartidos
│
└── core/
    ├── models/
    │   └── SemanticDocument.ts        # Modelo central: SemanticDocument/Page/Block
    │
    ├── parsers/
    │   └── DocxParser.ts              # DOCX → HTML limpio (Mammoth)
    │
    ├── parseStructure.ts              # HTML → árbol H1/H2/H3/H4
    │
    ├── builders/
    │   └── SemanticBuilder.ts         # Árbol H1/H2/H3 → SemanticDocument
    │
    ├── transformers/
    │   └── HtmlTransformer.ts         # Limpieza y normalización de HTML
    │
    ├── docxToSemanticDocument.ts      # Orquestador Capa 1: DOCX → SemanticDocument
    │
    ├── converters/
    │   └── semanticDocumentToElpx.ts  # Orquestador Capa 2a: SemanticDoc → ELPX
    │
    ├── renderers/
    │   ├── ElpxRenderer.ts            # Genera content.xml del ELPX
    │   │
    │   └── html-print/                # Renderer Capa 2b: SemanticDoc → HTML Print/PDF
    │       ├── semanticDocumentToPrintHtml.ts  # Punto de entrada del renderer
    │       ├── PrintThemeLoader.ts             # Carga assets del tema para PDF
    │       ├── renderCoverPage.ts              # Portada (imagen + metadatos + CC)
    │       ├── renderTableOfContents.ts        # Índice con target-counter() Paged.js
    │       └── printStyles.css                 # CSS Paged Media (@page, running elements)
    │
    └── services/
        ├── ThemeService.ts            # Carga y gestión de temas ZIP
        └── PreviewService.ts          # Vista previa HTML en tiempo real

public/
├── base.elpx                          # Plantilla base eXeLearning (CRÍTICA)
├── themes-config.json                 # Catálogo de temas disponibles
├── Doctorado_26-27.zip                # Tema Doctorado (ES)
├── Doctorat_26-27.zip                 # Tema Doctorat (CA/valenciano)
├── PhD_26-27.zip                      # Tema PhD (EN)
└── themes/                            # Temas descomprimidos (generado automáticamente)
    ├── Doctorado_26-27/
    ├── Doctorat_26-27/
    └── PhD_26-27/

src/server/
├── themeServer.ts                     # Servidor Express (puerto 5175)
└── themeHandler.ts                    # Endpoints API de gestión de temas
```

---

## Flujo de la aplicación

```
1. UPLOAD       Cargar .docx
      ↓
2. STRUCTURE    Por cada H1 del documento, elegir para cada H2:
                  • Nombre de iDevice  → H2 como título del bloque eXeLearning
                  • H2 en HTML        → H2 como encabezado dentro del bloque (por defecto)
                  • Acordeón          → Agrupa H2 consecutivos en <div class="exe-fx exe-accordion">
                  • Pestañas          → Agrupa H2 consecutivos en <div class="exe-fx exe-tabs">
      ↓
3. THEME        Elegir tema visual (Doctorado / Doctorat / PhD / Base)
      ↓
4. CONVERT      DOCX → SemanticDocument → ELPX
      ↓
5. DOWNLOAD     • Descargar .elpx
                • Vista previa para imprimir / PDF (abre en nueva pestaña con Paged.js)
```

---

## Modelo SemanticDocument

```typescript
interface SemanticDocument {
  title: string;
  subtitle: string;
  pages: SemanticPage[];
}

interface SemanticPage {
  title: string;
  level: 1 | 2 | 3 | 4;
  parentIndex: number | null;
  blocks: SemanticBlock[];
}

interface SemanticBlock {
  title: string;   // 'Contenido' = bloque sin título de iDevice
  html: string;
}
```

---

## Renderer HTML Print / PDF

El renderer de impresión vive exclusivamente en `src/core/renderers/html-print/` y **no contamina** el pipeline DOCX → ELPX ni el modelo SemanticDocument.

### Características del PDF generado

| Elemento | Descripción |
|----------|-------------|
| **Portada** | Imagen del tema (`portada_pdf.*`), logo BUA, título, subtítulo, año, licencia CC BY-NC-SA |
| **Índice** | TOC con paginación automática vía `target-counter()` de Paged.js |
| **Encabezado de página** | Logo BUA (izquierda) + título del documento (derecha) |
| **Pie de página** | Logo UA (izquierda) + número de página (centro) |
| **iDevices con título** | Cabecera coloreada (`--color-primary`) + borde perimetral |
| **Cajas BUA** | `bua_ejemplo`, `bua_definicion`, `bua_importante` con colores y etiquetas extraídos del CSS del tema |
| **Tablas** | Cabecera con `--color-primary`/`--color-accent` del tema |
| **Acordeones** | `<details>` siempre expandidos en impresión |
| **Imágenes** | Centradas con `margin: auto` y `box-shadow` sutil |

### Detección de idioma

El idioma del tema se detecta en tres capas:
1. **Etiquetas BUA en el CSS** (`"Exemple"` → ca, `"Example"` → en, `"Ejemplo"` → es) — más fiable, funciona para cualquier nombre de tema
2. **Palabras clave del ID** (`PhD` → en, `Doctorat`/`Grau`/`Màster` → ca)
3. **Fallback** → `es`

### Licencia CC en portada

La licencia Creative Commons BY-SA 4.0 se muestra en el idioma del tema:
- ES: *"Esta obra está bajo una licencia Creative Commons Atribución-CompartirIgual 4.0 Internacional."*
- EN: *"This work is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License."*
- CA: *"Aquesta obra es troba sota una llicència Creative Commons Reconeixement-CompartirIgual 4.0 Internacional."*

---

## Metadatos del ELPX generado

Cada archivo `.elpx` incluye en su `content.xml`:

| Campo `pp_*` | Valor |
|---|---|
| `pp_title` | Título del documento importado |
| `pp_subtitle` | Subtítulo |
| `pp_author` | `Biblioteca de la Universidad de Alicante` |
| `pp_lang` | `es` |
| `pp_license` | `creative commons: attribution - non commercial - share alike 4.0` |
| `pp_licenseUrl` | `https://creativecommons.org/licenses/by-nc-sa/4.0/` |
| `pp_theme` | ID del tema seleccionado |

---

## Sistema de temas

### Estructura del ZIP de un tema

```
{ThemeId}.zip/
├── style.css          # Estilos CSS del tema (REQUERIDO)
│                      # Debe incluir:
│                      #   - Comentario "Paleta: #color1 · #color2 ..."
│                      #   - Clases .bua_ejemplo, .bua_definicion, .bua_importante
│                      #   - .bua_*::before { content: "Etiqueta" }
├── style.js           # Scripts JS (opcional)
├── config.xml         # Metadatos del tema
├── screenshot.png     # Preview para el selector
├── portada_pdf.png    # (o .jpg/.webp) Imagen de portada para PDF
└── img/
    ├── logo_BUA.png   # Logo BUA — encabezado de página en PDF y portada
    ├── logo_UA.png    # Logo UA — pie de página en PDF
    └── logo_CID.png   # Logo CID (opcional)
```

### Temas incluidos

| Tema | ID | Idioma | Descripción |
|------|-----|--------|-------------|
| Doctorado | `Doctorado_26-27` | ES | Doctorado UA 2026-27 |
| Doctorat | `Doctorat_26-27` | CA | Doctorat UA 2026-27 (valenciano) |
| PhD | `PhD_26-27` | EN | PhD UA 2026-27 |

### Cargar un tema nuevo

1. Ir a **"Gestión de temas"** en la aplicación (requiere servidor de temas)
2. Subir el archivo ZIP
3. El servidor descomprime en `public/themes/{id}/` y actualiza `themes-config.json`
4. El tema aparece inmediatamente en el selector

### `themes-config.json`

```json
{
  "themes": [
    {
      "id": "base",
      "name": "Base eXeLearning",
      "language": "es",
      "description": "Tema estándar",
      "screenshot": null
    },
    {
      "id": "Doctorado_26-27",
      "name": "Doctorado",
      "language": "es",
      "description": "Tema Doctorado UA 2026-27",
      "screenshot": "/themes/Doctorado_26-27/screenshot.png"
    }
  ]
}
```

---

## Instalación y uso

### Requisitos

- **Node.js** ≥ 18
- **npm** ≥ 9

### Instalación

```bash
git clone https://github.com/MarioFlorido/BUA-convertidor-exe.git
cd BUA-convertidor-exe
npm install
```

### Arranque

```bash
# Terminal 1: Servidor de temas (necesario para cargar/eliminar temas)
npm run theme-server     # puerto 5175

# Terminal 2: Aplicación Vite
npm run dev              # puerto 5174
```

Accede a: **http://localhost:5174**

### Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Vite en modo desarrollo (hot reload) |
| `npm run build` | Compilar para producción (`dist/`) |
| `npm run preview` | Previsualizar el build de producción |
| `npm run theme-server` | Servidor Express para gestión de temas |

---

## Dependencias principales

| Paquete | Uso |
|---------|-----|
| `mammoth` | Extrae HTML limpio de archivos DOCX |
| `fflate` | Compresión/descompresión ZIP (ELPX y temas) |
| `react` / `react-dom` | Framework UI |
| `express` + `multer` | Servidor de gestión de temas |
| `Paged.js` (CDN) | CSS Paged Media polyfill para PDF |

---

## Troubleshooting

### "No se pudo cargar la plantilla base"
`public/base.elpx` no existe. Restaurar con:
```bash
git checkout public/base.elpx
```

### "Tema no encontrado"
El ZIP existe en `public/` pero no está en `themes-config.json`, o viceversa. Verificar coherencia y recargar la página.

### "Error al conectar con el servidor de temas"
El servidor Express no está corriendo. Ejecutar `npm run theme-server` en una terminal separada.

### "El PDF no muestra el encabezado/pie"
Paged.js requiere conectividad para cargar desde CDN (`unpkg.com`). Si trabajas sin conexión, descargar Paged.js localmente y actualizar la URL en `semanticDocumentToPrintHtml.ts`.

### "Las cajas BUA no tienen colores del tema en el PDF"
El CSS del tema debe incluir las clases `.bua_ejemplo`, `.bua_definicion`, `.bua_importante` con `border-left: N solid #color` y los `::before { content: "Etiqueta" }`. Ver la sección "Estructura del ZIP de un tema".

---

## Notas de desarrollo

### Añadir una nueva opción de H2

1. Añadir el valor al tipo `H2StructureOption` en `src/types/index.ts`
2. Añadir el mismo al union en `src/core/models/SemanticDocument.ts`
3. Implementar la lógica en `SemanticBuilder.ts`
4. Añadir la etiqueta en `StructureConfigurator.tsx`

### Añadir un nuevo renderer de salida

1. Crear directorio `src/core/renderers/{nombre}/`
2. La función de entrada recibe `SemanticDocument` y devuelve el formato deseado
3. **No modificar** `SemanticDocument`, `docxToSemanticDocument.ts` ni el renderer ELPX

### Añadir nuevas clases BUA

1. En `src/core/transformers/HtmlTransformer.ts` — detección y asignación de clases
2. En el CSS del tema — estilos visuales
3. En `src/core/renderers/html-print/printStyles.css` — estilos equivalentes para PDF
4. En `PrintThemeLoader.ts` — extracción de colores/etiquetas si son semánticas

---

## Estado del proyecto

| Funcionalidad | Estado |
|---|---|
| Conversión DOCX → ELPX | ✅ Completado |
| Sistema de temas (cargar/eliminar) | ✅ Completado |
| Configurador de estructura H1/H2/H3 | ✅ Completado |
| Opciones H2: iDevice / HTML / Acordeón / Pestañas | ✅ Completado |
| Renderer HTML Print / PDF (Paged.js) | ✅ Completado |
| Portada con imagen y licencia CC multilingüe | ✅ Completado |
| Índice con numeración automática | ✅ Completado |
| Cabecera/pie de página con logos BUA/UA | ✅ Completado |
| Metadatos ELPX (Autoría, Licencia BY-NC-SA) | ✅ Completado |
| Detección de idioma del tema (ES/EN/CA) | ✅ Completado |

---

**Versión:** 1.1  
**Última actualización:** Mayo 2026  
**Repositorio:** https://github.com/MarioFlorido/BUA-convertidor-exe
