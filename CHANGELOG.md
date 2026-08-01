# Changelog

## Sin publicar — Julio-Agosto 2026

### Arranque: de 22,7 MB a 4 KB (los temas se descargan al usarlos)
- **La aplicación ya no espera a los temas para pintarse.** `main.tsx` bloqueaba el render de React hasta que `bootThemeSystem()` terminaba, y ese boot descargaba los **ocho ZIP de temas (22,7 MB)** y los descomprimía antes de mostrar nada. Toda esa espera transcurría bajo el cartel «Cargando temas...», con la pestaña congelada, en **cada** arranque. El síntoma que lo destapó: la app tardaba mucho en cargar, de forma irregular según la conexión y la caché.
- **El catálogo ya no trae los ZIP, solo los metadatos.** Todo lo que la interfaz necesita para listar y elegir un estilo —nombre, actividad, idioma, descripción y miniatura— está en `themes-config.json`, que pesa 4 KB. `BuiltInThemeProvider` registra ahora cada tema con `files: {}` y el ZIP se descarga la primera vez que ese tema se usa de verdad (generar el ELPX o el PDF). Antes se pagaban los ocho ZIP siempre, aunque solo se usara uno.
- **La descarga bajo demanda no hubo que inventarla**: `ThemeService.loadTheme` y `PrintThemeLoader.fetchAndUnzip` ya tenían el fallback de `fetch` por URL para cuando el bundle del registry venía sin ficheros, y ambos cachean el resultado. Solo hubo que dejar de precargar y relajar la guarda de `semanticDocumentToElpx`, que exigía ficheros ya cargados y por tanto rechazaba un tema perfectamente válido.
- **Arranque en dos tiempos** (`ThemeBoot`): `bootEssential()` es síncrono y sin red —registra el tema base y devuelve—, así que React monta de inmediato; `loadThemeCatalog()` pide el catálogo y abre IndexedDB después de pintar. El usuario puede subir su DOCX y configurar la estructura mientras tanto; solo la pantalla de selección de estilo necesita el catálogo, y consulta `getCatalogStatus()`.
- **`ThemeRegistry` pasa a ser observable** (`subscribe`/`notify`): como los temas llegan después del primer render, `ThemeSelector` y `ThemeManager` se suscriben y van mostrando las opciones según se registran. `ThemeSelector` avisa con «Cargando estilos disponibles…» mientras faltan, y la restauración del último tema usado se movió a un efecto: al montar, el tema guardado en `localStorage` puede no haber llegado aún al registry.
- **Las miniaturas se quedan como estaban.** Salen de `public/themes/<id>/screenshot.png`, servidas como archivo estático y con `loading="lazy"`: solo baja la de los estilos que el usuario llega a ver. Nunca dependieron del ZIP —el código ya prefería la ruta estática—, así que la interfaz no pierde nada. Se añadió un `onError` que oculta la imagen si algún día se publica un tema sin ella.
- **Corrige de paso una caché obsoleta en el PDF**: `PrintThemeLoader` pedía `<id>.zip` sin el `?v=updatedAt`, así que tras republicar un tema el PDF podía seguir usando la versión vieja guardada en caché. Ahora usa `themeZipUrl`, como el resto.
- Se retiran de `BuiltInThemeProvider` el unzip, la validación en arranque y los Object URLs de miniaturas (con su revocación), que ya no tienen función: −150 líneas. El pipeline, los renderers y el PDF no se tocan.
- **Medido en el navegador**: 0 ZIP y ~4 KB de catálogo en el arranque (antes 8 ZIP y 22,7 MB); conversión completa de `multipage.docx` con tema Doctorado en 1,0 s **incluyendo** la descarga del ZIP, con un único ZIP pedido y el `?v=` correcto; vista previa de PDF sin errores. Nota: un mismo tema se descarga dos veces si se genera ELPX y luego PDF, porque `ThemeService` y `PrintThemeLoader` mantienen cachés separadas (`ThemeService` prefija con `theme/`); la segunda la sirve la caché del navegador, así que no hay tráfico extra.

### Etiquetas de recurso: `[vídeo:]` · `[documento:]` · `[enlace:]`
- **Tres etiquetas nuevas para señalar los enlaces a recursos.** Escribiendo `[vídeo:] Título del recurso` al principio de la línea, el convertidor sustituye la etiqueta por el icono del tipo de recurso y pone la línea en cursiva. El material BUA enlaza constantemente a vídeos, PDF y webs, y todos esos enlaces se veían igual que cualquier otro enlace del texto: el lector no sabía qué le esperaba al otro lado hasta hacer clic.
- **No llevan cierre**, a diferencia de las cajas: afectan a su línea y a nada más, así que no hay `[fin]` que olvidar. `applyResourceLinks` (HtmlTransformer) las reconoce al principio de un párrafo o de un ítem de lista —una lista de recursos es lo natural— y deja en el contenido solo la clase `bua_recurso bua_recurso_video|documento|enlace`.
- **Los dos puntos son obligatorios**, y son lo único que no admite variantes. El material puede ser un curso sobre IA en el que se transcriban prompts con corchetes —«resume el [texto]», «pega aquí el [enlace]»—, y ese literal tiene que llegar intacto al curso: sin los dos puntos no es una etiqueta, así que ni se transforma ni genera aviso.
- **Del resto da igual cómo se escriban**: `[Vídeo:]`, `[VIDEO:]`, `[ enlace : ]`… mayúsculas, tildes y espacios son indiferentes, como en el resto de etiquetas. También sobreviven al formato accidental de Word alrededor del marcador (negrita, bookmarks, `<br/>`), porque entran en la normalización compartida `normalizeSemanticMarkers` — salvo en el paso que aísla el marcador en su propio párrafo, del que se quedan fuera a propósito: van pegadas al texto que etiquetan. Si el autor separó las líneas con Shift+Enter, cada una pasa a su propio párrafo.
- **Iconos en la paleta BUA, por CSS y no como contenido** (mismo criterio que el icono de «enlace externo» de los títulos): lo que el autor edita después en eXeLearning sigue siendo su texto limpio. Nuevo `src/core/utils/resourceIcons.ts` con los tres dibujos y la regla en un único sitio, usado por el `content.xml` vía `pp_extraHeadContent` (`ElpxRenderer`, sin republicar los temas) y por las páginas de vista previa del ZIP (`PreviewService`); el PDF lleva su copia en `printStyles.css`, que siendo un `.css` no puede importar del módulo. Son máscaras pintadas con `var(--color-primary, #135d87)`: en el PDF resuelve al color real del tema, y en el ELPX —donde los temas de eXeLearning no declaran variables CSS— cae en el primario de la paleta BUA, el que declaran los ocho temas publicados. Mismo azul en las tres salidas.
- **Viaje de vuelta reversible**: `elpToDocx` reescribe `bua_recurso_*` como su etiqueta `[vídeo:]` al principio del párrafo (sin `[fin]`, que aquí sería un error), igual que ya hacía con las cajas. La cursiva no se reconstruye porque la pone el CSS de cada salida: en Word vuelve a ser texto normal precedido de su etiqueta, tal y como se escribió.
- **Aviso antes de convertir si la etiqueta está mal puesta** (`semanticTagBalance`, nuevo `resource-marker`): un marcador en mitad del párrafo o sin ningún recurso detrás no lo reconoce la transformación y acabaría impreso como texto literal, sin más pista. Mismo fallo silencioso que ya cubría `[horizontal]`/`[vertical]`.
- 20 tests nuevos (12 en `HtmlTransformer.test.ts`, 8 en `semanticTagBalance.test.ts`) y 1 en `elpToDocx.test.ts` para el viaje de vuelta. Entre ellos, dos que fijan que `[texto]`, `[enlace]` o `[enlace]:` sin los dos puntos dentro de los corchetes llegan intactos.

### Encabezados que además son un enlace
- **El hiperenlace de un título ya no se pierde en la conversión.** `SemanticBuilder` reconstruía los encabezados desde `escapeHtml(texto)` — solo texto plano —, así que un H2/H3/H4 que el autor había enlazado en Word llegaba al curso y al PDF como texto muerto. Nueva `extractHeadingTextHtml` en `buildFromStructure.ts`: guarda el título con sus `<a href>` intactos (y el resto de etiquetas disuelto; las imágenes siguen viajando por `extractHeadingMedia`, que ya existía, para que un logo enlazado no se duplique). Conserva enlaces parciales: si el autor enlazó dos palabras del título, solo esas dos quedan enlazadas.
- **Salida idéntica cuando no hay enlaces**: la función devuelve `''` si el encabezado no lleva ningún enlace con texto, y el encabezado se escribe por el camino de siempre. Los documentos sin títulos enlazados salen byte a byte como antes.
- **Icono de «enlace externo» en superíndice detrás del título enlazado** (H2 en modo HTML, H3, H4): dentro de un título grande, en negrita y en mayúsculas, el color de enlace se confunde con el color propio del título y el lector no llega a saber que ahí hay algo que abrir. Se dibuja por CSS —no como etiqueta dentro del contenido— para no ensuciar lo que el autor edita después en eXeLearning. Nuevo `src/core/utils/externalLinkIcon.ts` con el dibujo y la regla en un único sitio, usado por el `content.xml` vía `pp_extraHeadContent` (`ElpxRenderer`, sin republicar los temas) y por las páginas de vista previa del ZIP (`PreviewService`); el PDF lleva su copia en `printStyles.css`, que siendo un `.css` no puede importar del módulo. Es una máscara pintada con `currentColor`, así que toma el color del enlace en cualquier tema; el SVG va percent-encodeado para atravesar intacto el escapado XML del `content.xml`. Solo marca los enlaces `http(s)`: `mailto:` y las anclas internas se conservan sin icono.
- **Los títulos que el `content.xml` guarda como texto plano siguen perdiendo el enlace** (nombre de página desde H1, título de iDevice, paneles de acordeón/pestañas): ahí eXeLearning solo admite texto y no hay dónde ponerlo. Decisión consciente, con test que lo deja documentado.
- 8 tests nuevos en `buildFromStructure.test.ts` (título entero enlazado, enlace parcial, `mailto:`, adornos disueltos, logo y texto bajo el mismo enlace, título de iDevice, control sin enlace).

### Caja de búsqueda activada de serie en los ELPX
- **Los cursos exportados desde eXeLearning ya incluyen buscador sin configurar nada**: `ElpxRenderer` escribe `pp_addSearchBox` a `true` en el `content.xml` del ELPX (antes `false`). eXeLearning lee esa propiedad al importar el paquete, así que la casilla «Añadir caja de búsqueda» de las propiedades del proyecto llega ya marcada y el sitio web resultante sale con el buscador.
- **No hace falta tocar nada más.** Analizando dos exportaciones reales de eXeLearning v4.0.2 (con y sin la opción) se comprobó que el motor de búsqueda viaja **siempre** en toda exportación: `$exeExport.searchBar` en `libs/exe_export.js` (búsqueda sin distinción de tildes, resaltado con `<mark>`, deep-linking), los estilos `#exe-client-search-*` de `theme/style.css` y el botón de lupa que inyecta `theme/style.js`. Lo único condicional es el disparador: el contenedor `#exe-client-search` en cada página y el índice `search_index.js`, que genera el propio eXeLearning al exportar. Sin ese contenedor, `searchBar.init()` sale sin hacer nada y el CSS mantiene la lupa oculta (`display: none` salvo `body.exe-search-on`).
- **Los 8 temas oficiales de la BUA ya lo soportan** (CID_es, CID_va, Ciencia_abierta, Ciencia_oberta, Doctorado, Doctorat, Open_Science, PhD): todos traen las 14 reglas CSS y las 4 referencias JS de `#exe-client-search`. Cero trabajo de tema.
- **Coste en peso: ~1,5 KB comprimidos** (el `search_index.js` de un curso pequeño). La **barra de accesibilidad** (`pp_addAccessibilityToolbar`) se dejó deliberadamente en `false`: arrastra `libs/exe_atools/` con fuentes OpenDyslexic/Atkinson en `.woff` sin comprimir, unos **650 KB por curso**. Queda anotada en el `ROADMAP.md` como decisión pendiente.
- **Las páginas de vista previa del ZIP no llevan el buscador, y da igual**: eXeLearning las regenera y descarta al exportar. Lo que sobrevive al viaje es el `content.xml`.
- 2 tests nuevos en `ElpxRenderer.test.ts`: uno fija el buscador en `true`, otro deja constancia de que el resto de extras de exportación siguen desactivados (para que un cambio accidental salte).

### Auditoría de diseño (impeccable): 26 avisos → 0
- **Contraste WCAG AA de los chips del Limpiador corregido** (incumplían la Regla del Contraste No Negociable del propio DESIGN.md): texto naranja de `[importante]` #C2410C→`#B53B0B` (4.30→4.85:1 sobre su fondo) y verde de `[ejemplo]` #1E8A43→`#1B7E3D` (3.99→4.64:1). Oscurecimientos mínimos del mismo matiz, verificados también sobre blanco y sobre el fondo institucional.
- **`[tabla]` recoloreado de violeta #7C3AED a teal `#0F766E`/`#D5F0EC`** (decisión de Mario): el violeta invadía la Regla del Morado Único, que reserva el morado en exclusiva para el badge de tema Local. El teal es el único matiz sin significado previo en el sistema; contraste 4.56:1.
- **Sombra del pulgar del toggle** pasada de `rgba(0,0,0,0.2)` literal a `var(--shadow-xs)`: cumplía a medias la Regla de la Sombra Ambiental (máx. 0.14 de opacidad).
- **DESIGN.md ampliado** para que el frontmatter (lo que valida el detector) recoja lo que la prosa ya documentaba o el código ya usaba: paleta de Etiquetas semánticas del Limpiador, `feedback-success-text`, `feedback-warning-border`, `overlay-scrim`, rol tipográfico `code` (editor del admin + marcadores del Limpiador) y radio `xs: 4px` (chips, swatches, miniaturas). Prosa nueva: §2 «Etiquetas semánticas» y §5 «Chips y distintivos».
- **Sidecar `.impeccable/design.json` regenerado** (estaba desactualizado respecto a DESIGN.md) y **4 excepciones registradas con motivo** en `.impeccable/config.json`: el cubic-bezier del pop de éxito (documentado en §Status & Feedback), el radio 12px de la píldora del toggle (documentado en `components.toggle-track`) y los radios 2px/3px de detalles de 3-4px de grosor.

### Conversor de elp antiguo a docx
- **Nueva utilidad en el menú lateral**: convierte paquetes `.elp` del eXeLearning clásico (2.x, probado con 2.9) en un documento Word editable, como paso previo al flujo normal Word → curso. Todo se procesa en local, como el resto de la app.
- **Distintivo «NEW» en superíndice** en las dos utilidades recién estrenadas del menú lateral (Limpiador de Word y este conversor), con el idioma visual de los chips existentes; retirarlo cuando dejen de ser novedad. El badge se eleva con `position/top` y no infla la caja de línea, y la acción del menú tiene interlínea holgada: cuando la etiqueta larga se parte en dos líneas, el badge ya no se superpone al texto de la línea superior.
- **La pantalla del conversor deja claro que es una herramienta básica**: su único objetivo es trasladar el texto y las imágenes a un Word para poder trabajar con el contenido; no reproduce el diseño ni la interactividad del curso original.
- **Parser propio mínimo** (`src/core/elp/elpParser.ts`): lee el `contentv3.xml` (serialización «jelly» de eXe) sin dependencias nuevas — fflate + `DOMParser`. Formato implementado usando como especificación el importador oficial del nuevo eXeLearning (consultado como documentación; sin copiar código, para mantener la licencia GPL limpia).
- **Generador Word** (`src/core/elp/elpToDocx.ts`, librería `docx` MIT): páginas → Título 1–4 según su profundidad en el árbol, texto con formato básico, listas con viñetas/numeración, tablas, enlaces externos e imágenes incrustadas desde el propio paquete (dimensiones leídas de la cabecera PNG/JPEG/GIF/BMP cuando el HTML no las trae). La librería va en un chunk propio con `import()` dinámico (411 KB min / 118 KB gzip) que solo se descarga al usar la utilidad: el bundle principal no crece más que el propio código del conversor.
- **Degradación con avisos, nunca en silencio**: iframes/vídeo/actividades interactivas → nota visible en el propio Word + resumen ámbar en pantalla; enlaces internos de eXe (`exe-node:`) → texto plano; adjuntos del paquete (PDF…) → texto con nota `[adjunto: …]`.
- **Zona principal del paso 1**: al soltar un `.elp` se explica qué es y se ofrece saltar al conversor (antes decía solo «El archivo debe ser .docx»; de paso, el selector de archivo no validaba la extensión — ahora sí).
- **Validado con el corpus real de la BUA** (3 cursos 2025-26: 27 páginas, 50 iDevices, 70 recursos): estructura íntegra, imágenes incluidas y round-trip verificado — el Word generado se re-importa limpio en el propio convertidor (mammoth). 12 tests nuevos con fixture sintético de eXe 2.9 (`elpFixture.ts`; sin materiales reales en el repo).

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
