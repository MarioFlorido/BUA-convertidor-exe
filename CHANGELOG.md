# Changelog

## Sin publicar — Julio 2026

### Etiquetado semántico — robustez y validación
- **Resuelto el "misterio" de las etiquetas que fallan pese a estar bien escritas** (nueva `normalizeSemanticMarkers` en `HtmlTransformer`, compartida con el validador): Word deja formato invisible en los marcadores — parte de la etiqueta en negrita/cursiva (`<strong>[fin]</strong>`, `[f<em>in</em>]`), bookmarks, `<br/>` de Shift+Enter — y las regex no casaban; borrar y reescribir la etiqueta lo "arreglaba" porque limpiaba esos restos. Ahora se normalizan: se quita el formato dentro y alrededor del marcador (solo si el texto resultante es un marcador reconocido) antes de transformar y de validar.
- **Etiquetas que comparten párrafo con el contenido**: cada marcador al inicio o final de un `<p>` se aísla en su propio párrafo antes de transformar. Con ello funcionan los casos mixtos que antes fallaban (apertura en párrafo propio + `[fin]` inline, o al revés), el inline puro deja de generar HTML inválido (`<div>` dentro de `<p>`) — ahora produce el mismo HTML que el Caso A — y `[horizontal]`/`[vertical]` admiten texto delante en el mismo párrafo.
- **El validador usa la misma normalización que el transformador**: un documento que convierte bien nunca da aviso falso, y viceversa.
- **Validación de marcadores de tabla** (`semanticTagBalance.ts`, nuevo aviso `table-marker`): un `[horizontal]`/`[vertical]` que no esté solo en su párrafo inmediatamente antes de la `<table>` se avisa ANTES de convertir (antes se imprimía como texto literal sin ningún aviso). Replica la pre-normalización de `applyTableClasses` (bookmarks y `<br/>` de Word) para no dar falsos avisos.
- **Encabezado dentro de una caja** (nuevo aviso `heading-inside-box` + regex temperada en `HtmlTransformer`): una caja `[etiqueta]…[fin]` ya no puede atravesar un H1–H6. Antes el título quedaba envuelto en el `<div>` y desaparecía de la estructura del wizard en silencio; ahora la caja no se forma (los marcadores quedan visibles como texto) y el configurador avisa con el texto del encabezado afectado.
- **Ruta legacy (sin estructura del wizard) preserva el etiquetado**: la sanitización de `docxToSemanticDocument.ts` disolvía los `<div>` y reconstruía las `<table>` sin atributos, borrando las clases `bua_*` que `applyAllTransforms` acababa de crear. Ahora las clases `bua_*` sobreviven (cajas, tablas y vídeo), igual que en la ruta del wizard. Ruta no alcanzable desde la UI actual, pero coherente para tests y usos programáticos.
- **PDF, tabla vertical**: la cabecera de primera columna cubre también `th:first-child` (antes solo `td`), como ya hacía el CSS del tema.
- **PDF, extracción de estilos del tema** (`PrintThemeLoader.extractBuaStyles`): acepta colores `rgb()/rgba()/hsl()/hsla()` además de `#hex` en `border-left` y `background`; un tema con esos formatos ya no cae en silencio a los colores del fallback.
- Panel de avisos del configurador generalizado (ya no habla solo de cierres con `[fin]`).

### PDF — nitidez de imágenes (capturas de pantalla)
- **Política PNG-primero en `optimizeImagesForPrint.ts`**: las capturas de pantalla ya **no** se recomprimen a JPEG (que emborronaba el texto de menús y diálogos). El contenido se clasifica midiendo la fracción de píxeles «planos» (idénticos ±2 a su vecino): capturas y diagramas → PNG sin pérdida; solo lo fotográfico (fotos de cámara) → JPEG 0.82. Una PNG dentro de límites que se queda en PNG no se recodifica: conserva sus bytes originales.
- **Límites de redimensionado ampliados** de 1600×2200 a 2000×2800 px (~320 DPI a ancho útil de A4), y el reescalado se hace **por mitades sucesivas con `imageSmoothingQuality: 'high'`** (antes un único `drawImage` con suavizado por defecto, que emborronaba las capturas Retina).
- **Borde fino en lugar de `drop-shadow`** en las imágenes del PDF: cualquier `filter` CSS obliga a Chrome a rasterizar la imagen a ~300 DPI al imprimir (medido: una captura de 2880 px quedaba re-muestreada a 1893 px). Sin filtro, el PDF incrusta cada imagen a su resolución íntegra.
- **Corrección de transparencias**: la detección de alfa se aplica ahora a cualquier formato (antes solo PNG) y recorre todos los píxeles (antes muestreo 1/17). Un GIF/WebP transparente ya no puede acabar como JPEG con las zonas transparentes en negro.
- **Imágenes más altas que la página**: `max-height: 235mm` en `printStyles.css` — una captura vertical larga se reescala para caber en la página en lugar de recortarse por abajo.
- **Deduplicación y secuencialidad** en el optimizador: cada data URL única se procesa una sola vez (imágenes repetidas) y en secuencia (acota el pico de memoria con documentos muy fotográficos).

### URLs excesivamente largas (PDF y eXeLearning)
- Las URLs (o cualquier palabra sin espacios) que no caben en su contenedor ya **no se desbordan ni se pierden por el margen**: se parten en el punto necesario (`overflow-wrap: anywhere`, solo actúa cuando la palabra no cabe entera).
- Aplicado en los dos sitios: en el PDF (`printStyles.css`, regla heredada a todo el contenido) y en eXeLearning vía `pp_extraHeadContent` en el `content.xml` (`ElpxRenderer.ts`), el único vehículo de estilos que sobrevive al reexport desde eXeLearning — la propiedad ahora se emite siempre, con la regla del índice desplegado añadida cuando corresponde. Las páginas de preview del ZIP (`PreviewService.ts`) llevan la misma regla.

## v0.3.0 — Junio 2026

### PDF — motor y rendimiento
- **Paged.js embebido** (dep `pagedjs@0.4.3`, importado como `?raw`): el motor de paginación ya **no** se descarga de un CDN. El PDF se genera 100% offline. El polyfill va en su propio chunk lazy (carga diferida desde `DownloadButton`).
- **Optimización automática de imágenes** antes de generar el PDF (`optimizeImagesForPrint.ts`): redimensionado (máx. 1600×2200) y recompresión (JPEG 0.82; PNG si hay transparencia). Nunca empeora el original. Reduce el peso del PDF y acelera la paginación.

### PDF — maquetación
- Portada a una página exacta (`297mm`) sin página en blanco.
- Índice con puntos líderes + número de página (técnica flex, porque Paged.js 0.4.3 no soporta `leader()`).
- `break-inside` ajustado: iDevices, tablas, cajas y acordeones pueden partir entre páginas (sin huecos); imágenes y figuras se mantienen unidas. Protecciones para cabeceras y filas.
- Títulos de página uniformes: todos los niveles (página / subpágina / 3er nivel) se renderizan igual (20 pt, página nueva), ya que todos provienen de un H1 en Word. La jerarquía se conserva en el índice.
- Tablas horizontal/vertical: cabecera con fondo gris y borde mostaza, distinguible del cuerpo.
- iDevice con título: al partir entre páginas no se dibujan bordes en el punto de corte.

### Administración de temas oficiales
- **Panel de administración integrado en la app** (`OfficialThemeAdmin.tsx`, en «Estilos eXeLearning»): crear, actualizar y eliminar temas oficiales sin Terminal, autenticando con un token fine-grained de GitHub. Núcleo en `src/core/services/admin/`. El flujo por CLI queda como _fallback_.
- **Nombre pre-rellenado desde `<title>`** del `config.xml` al seleccionar la carpeta del tema (antes había que escribirlo a mano, y un desajuste con el XML producía temas con nombres inconsistentes). Sigue siendo editable.

### Selector y administración — agrupación por familias
- **Agrupación de temas por familia** (`themeGrouping.ts`): los temas que comparten el mismo curso en varios idiomas (castellano/valenciano/inglés) se presentan como una sola fila, con una variante seleccionable por idioma, en vez de tres entradas sueltas. Afecta a `ThemeSelector.tsx` (selección) y `ThemeManager.tsx` (reordenación, que ahora opera a nivel de familia).
- La familia se detecta quitando del nombre el idioma entre paréntesis (al final o en medio, como en el `<title>` de eXeLearning: `CURSO (CASTELLANO)` o `CURSO (CASTELLANO) 2026-27`). El idioma de cada variante se lee de forma fiable del `<language>` del `config.xml`, no del texto del nombre.
- **Importante:** el resto del nombre (fuera del paréntesis de idioma) debe coincidir **exactamente** entre las variantes para que se agrupen; un desajuste (p. ej. un año escrito de forma distinta) hace que esa variante aparezca como familia propia en vez de agruparse con las demás.

### Calidad
- Tests automatizados de `HtmlTransformer` (27 tests) con `node:test` vía `tsx` (`npm test`), sin dependencias nuevas.
- Consolidada `escapeHtml` en una única definición canónica (`src/core/utils/html.ts`).

### UX impresión
- Overlay «Preparando…» + barra con botón de impresión/guardado, fuera del DOM al imprimir para que no salgan en el PDF.

### UX — Ayuda contextual
- **Globo de ayuda por pantalla** (`WelcomeTour.tsx`): modal centrado con fondo
  oscurecido a pantalla completa (bloquea la interacción mientras está
  visible), uno por paso del asistente (subir / estructura / tema /
  resultado), con texto en varios párrafos independientes.
- **Switch «Ayuda» en la cabecera** (`AppHeader.tsx`): activado por defecto,
  preferencia persistida en `localStorage` (`bua-help-enabled`). Mientras está
  activo, el globo de cada pantalla reaparece en cada visita; el botón
  «Entendido» solo cierra esa visita concreta, no el conjunto.

### Contenido — Etiquetas semánticas
- **Cuarta etiqueta semántica: `[pie]`** — pie polivalente para ilustraciones,
  tablas y leyendas. Se aplica igual que `[ejemplo]`, `[definición]` e
  `[importante]` (envuelve contenido entre `[pie]` y `[fin]`). En el PDF se
  renderi­za como texto pequeño, cursiva, gris y centrado, sin recuadro de
  color. En el ELPX, se estiliza según la clase `.bua_pie` definida en cada
  tema. Validación: detecta `[pie]` sin cerrar igual que las demás cajas,
  avisa antes de convertir.

### Reorganización de carpetas (Fase 4)
- **Pipeline agrupado en `src/core/pipeline/`**: `docxToSemanticDocument.ts`,
  `parseStructure.ts`, `buildFromStructure.ts` y sus tests se movieron desde
  `src/core/` suelto a un subdirectorio propio.
- **Assets estáticos agrupados en `public/img/`**: `logo_BUA.png`, `logo_UA.png`,
  `logo_CID.png`, `docx.png`, `pdf.png`, `elpx-icon.png`, `minichrome.png` y
  `miniedge.png` se movieron desde `public/` suelto.
- Imports actualizados en `App.tsx`, `AppHeader.tsx`, `DownloadButton.tsx` y
  `UploadZone.tsx`; sin cambios de comportamiento. Esta fase se había marcado
  conscientemente como saltada (riesgo de romper rutas en producción vs.
  beneficio cosmético); se reevaluó y se ejecutó el 21 jun 2026 con verificación
  previa (tsc limpio, 108/108 tests, build OK).

### Auditoría y consolidación técnica (refactor P0/P1/P2)
- **Invariante posicional blindado con test** (`structureContentSymmetry.test.ts`,
  6 tests): `parseDocumentStructure` y `buildProjectFromStructure` deben ignorar
  los encabezados vacíos con idéntico criterio para que los ordinales (`h1-N`,
  `h2-X-M`) sigan alineados. El test verifica que el contenido sobrevive en su
  página aun con `<h1></h1>`/`<h2></h2>`/`&nbsp;` en posiciones que, de romperse
  el acoplamiento, lo desplazarían en silencio.
- **Helpers de string centralizados en `utils/html.ts`**: `escHtml` (unifica las
  3 copias de `html-print/`), `upperCaseH2` (unifica la regex de mayúsculas de
  H2 en `ElpxRenderer` y el renderer de impresión) y `stripDiacritics` (unifica
  la normalización NFD de `HtmlTransformer`, `PreviewService`, `themeGrouping` y
  `semanticTagBalance`). Salida idéntica; sin cambios de comportamiento.
- **Código muerto eliminado**: `BUA_CLASSES` (constante sin consumidores) y
  `ThemeService.loadThemeIfNeeded` (método sin llamadas).
- **`UploadZone`**: la validación de extensión al arrastrar es ahora
  *case-insensitive* (`INFORME.DOCX` ya no se rechaza).
- **Node alineado dev/CI** (`.nvmrc` + workflow a Node 24) e higiene de
  dependencias (`npm audit fix` sin *breaking*; las vulnerabilidades restantes
  son solo de la cadena de desarrollo, no del sitio desplegado).

---

## v0.2.0 — Mayo 2026

### Arquitectura
- Eliminado backend Express/Multer completamente
- Sistema de temas migrado a 100% client-side
- Introducido ThemeRegistry como fuente de verdad única
- Añadido ThemeClientService: carga ZIPs en navegador con fflate
- Añadido UserThemeProvider: persistencia de temas en IndexedDB
- Añadido BuiltInThemeProvider: carga temas predefinidos desde public/*.zip
- Boot sequence determinista en 10 fases (ThemeBoot.ts) antes de montar React
- ThemeService y PrintThemeLoader consultan ThemeRegistry antes de hacer fetch

### Despliegue
- Compatible con GitHub Pages (arquitectura 100% estática)
- Añadido GitHub Actions para CI/CD automático en push a main
- Añadido script `npm run deploy` (gh-pages)
- vite.config.ts: base path `/BUA-convertidor-exe/`

### Gestión de temas
- Solo el tema `base` es intocable; los temas institucionales son eliminables
- Subir un ZIP con el mismo ID reemplaza el tema existente (actualización de curso)
- Lista de temas unificada en ThemeManager

---

## v1.1 — Enero 2026

- Renderer HTML Print / PDF (Paged.js)
- Portada con imagen, logos BUA/UA y licencia CC multilingüe
- Índice con paginación automática via Paged.js
- Cabecera y pie de página con logos en PDF
- Metadatos ELPX: autoría BUA + licencia CC BY-NC-SA
- Detección de idioma del tema en 3 capas (CSS > ID > fallback)
- Opción H2 "Pestañas" en el configurador de estructura

---

## v1.0 — 2025

- Conversión DOCX → ELPX con SemanticDocument como modelo central
- Pipeline de 3 capas: Parser → SemanticDocument → Renderer
- Configurador de estructura H1/H2/H3 (iDevice / HTML / Acordeón)
- Sistema de temas ZIP con servidor Express
- Selector de tema visual con preview
