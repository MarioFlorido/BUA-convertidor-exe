# ConvertidoreXe

Transforma documentos Word en cursos eXeLearning listos para usar. Sin servidores ni subidas a la nube.

**Versión:** 0.3.0  
**Licencia:** GNU GPL v3.0  
**Desarrollado por:** Biblioteca Universitaria de la Universidad de Alicante  
**Acceso:** https://marioflorido.github.io/BUA-convertidor-exe/

---

## Qué hace

1. Subes un Word (DOCX)
2. Configuras la estructura: qué hace cada encabezado
3. Eliges un tema visual
4. Descargas el proyecto (.elpx) para eXeLearning o un PDF

El documento nunca sale de tu navegador. ConvertidoreXe procesa todo localmente.

¿Tienes cursos del **eXeLearning clásico** (archivos `.elp` de la versión 2.x)? La utilidad
**Conversor de eXe antiguo** (menú lateral) los convierte en un Word con su texto e imágenes,
listo para revisarlo y pasarlo por este mismo flujo. Lo que Word no puede representar
(vídeos incrustados, actividades interactivas) queda anotado en el documento y en un
resumen de avisos.

---

## Etiquetas semánticas

Dentro de tu Word puedes marcar bloques especiales:

```
[Importante]
Tu contenido aquí
[fin]

[ejemplo]
Tu ejemplo
[fin]

[definición]
Tu definición
[fin]
```

También puedes marcar tablas antes de insertarlas:

```
[horizontal]    → tabla con encabezado en filas
[vertical]      → tabla con encabezado en columnas
```

El tema que elijas aporta los colores y las etiquetas. ConvertidoreXe es bastante robusto: no le importan mayúsculas/minúsculas, tildes o cosas raras que Word inserta. Funciona.

---

## Sistema de temas

### Dos tipos

**Temas oficiales** — Los que ves todos. Están centralizados y aparecen igual para cualquiera que use ConvertidoreXe.

**Temas locales** — Solo en tu navegador. Subes un ZIP, se guarda en tu máquina, y lo usas cuando quieras. Si subes otro ZIP con el mismo nombre, reemplaza el anterior.

Para cargar un tema local, pulsa "Importar estilo local" en la cabecera. Arrastra el ZIP o abre el selector de archivos. Listo.

### Publicar temas oficiales (administración)

Los temas oficiales se gestionan desde el propio Convertidor, en **«Estilos eXeLearning» → «Administración de temas oficiales»** — sin Terminal. Requiere un *token de acceso de GitHub* (fine-grained PAT limitado a este repo, con permiso `Contents: Read and write`). El panel lee la carpeta del tema, la valida, la previsualiza y publica/actualiza/elimina commiteando a `main` vía la API de GitHub; el CI reconstruye y despliega solo en 1-2 minutos.

Guía detallada: [Gestionar estilos oficiales](public/docs/gestionar-temas-oficiales.html). El antiguo flujo por Terminal (`npm run publish-theme` / `unpublish-theme`) queda como _fallback_.

### Agrupación por familias (idioma)

Cuando varios temas oficiales son el mismo curso traducido (castellano, valenciano, inglés), el selector los junta en **una sola fila** con una variante seleccionable por idioma, en vez de mostrarlos como entradas sueltas.

La agrupación se basa en el nombre (`<title>` del `config.xml`): se le quita el idioma entre paréntesis —al final (`CURSO 26-27 (CASTELLANO)`) o en medio (`CURSO (CASTELLANO) 26-27`)— y lo que queda debe **coincidir exactamente** entre las variantes. Si un nombre tiene una errata o un dato distinto (un año escrito de otra forma, por ejemplo), esa variante no se agrupa y aparece como familia propia. El idioma de cada variante no depende del nombre: se lee del `<language>` del `config.xml`.

### Reordenar temas

En el selector de temas hay un icono (≡) a la izquierda de cada uno. Arrastra para cambiar el orden (a nivel de familia, si los temas están agrupados). Se guarda automáticamente.

### Estructura de un ZIP de tema

El ZIP debe tener:

```
tu-tema.zip/
├── style.css               (obligatorio)
├── config.xml              (obligatorio)
├── screenshot.png          (recomendado — para la miniatura)
├── portada_pdf.png         (opcional — imagen para portada PDF)
├── style.js                (opcional — lógica del tema)
└── img/
    ├── logo_BUA.png
    ├── logo_UA.png
    └── logo_CID.png        (opcional)
```

El `style.css` debe incluir clases para las cajas semánticas:
- `.bua_importante`
- `.bua_ejemplo`
- `.bua_definicion`

Cada clase puede tener un `border-left`, colores, y un `::before` con la etiqueta.

---

## El PDF generado

Cuando exportas a PDF, ConvertidoreXe añade:

- **Portada** (opcional, desactivada por defecto) con logo BUA, título y licencia
- **Índice** — Paginado automáticamente
- **Encabezado** — Logo BUA a la izquierda, título del documento a la derecha
- **Pie de página** — Logo UA a la izquierda, número de página en el centro
- **Cajas semánticas** — Con los colores y etiquetas del tema
- **Tablas** — Encabezado coloreado
- **Imágenes** — Centradas con borde fino; nunca más altas que la página (sin recortes)
- **Acordeones y pestañas** — Expandidos en impresión (sin solapamientos)

Las imágenes se optimizan automáticamente antes de generar el PDF priorizando la nitidez de las capturas de pantalla: se quedan en PNG (sin pérdida) salvo el contenido claramente fotográfico, que se recomprime a JPEG; solo se redimensionan por encima de 2000×2800 px. Nunca se empeora el original.

Todo el proceso es **offline**: el motor de paginación (Paged.js) va embebido en la app, no se descarga de ningún CDN. El PDF se genera aunque no tengas conexión.

Los idiomas se detectan automáticamente desde el tema. Si algo falla, usa español como fallback.

---

## Problemas habituales

**"No se pudo cargar la plantilla base"**  
Falta `public/base.elpx`. Si estás usando la versión web, recarga la página. Si compilaste localmente, ejecuta `git checkout public/base.elpx`.

**"El tema no aparece después de subirlo"**  
Probablemente le falta `style.css` o la estructura es inválida. Abre la consola del navegador (F12) para ver el error exacto.

**"Subo el ZIP pero no veo miniatura"**  
El ZIP no incluye `screenshot.png` en la raíz. El tema funciona igual, solo que sin imagen en el selector.

**"La interfaz dice [ES] pero el tema es en inglés"**  
El `config.xml` del tema necesita `<language>en</language>` o `<language>ca</language>`. Sin eso, asume español.

**"Un tema sale solo, separado de sus otros idiomas"**  
Su nombre no coincide exactamente con el de las otras variantes fuera del paréntesis de idioma. Edita el nombre en el panel de administración (Administración de temas oficiales) hasta que el texto sea idéntico al de los demás, y vuelve a publicar.

**"El PDF no tiene encabezados ni pies"**  
Revisa que el tema defina sus *running elements*. El PDF funciona sin conexión: Paged.js va embebido en la propia app (no se descarga de ningún CDN), así que la exportación funciona aunque no tengas internet.

**"Las cajas no tienen colores en el PDF"**  
El `style.css` del tema no define `.bua_ejemplo`, `.bua_definicion` o `.bua_importante`. Añade esas clases con colores y `border-left`.

**"El PDF tiene páginas en blanco entre secciones"**  
Algo en el CSS está forzando saltos de página. Revisa los estilos de sección y los running elements del tema.

---

## Metadatos del proyecto ELPX

Cuando generas un proyecto eXeLearning, ConvertidoreXe rellena automáticamente:

- **Título** — Del nombre de tu documento
- **Subtítulo** — "Biblioteca Universitaria" (por defecto)
- **Autoría** — Biblioteca de la Universidad de Alicante
- **Idioma** — Español
- **Licencia** — Creative Commons: Reconocimiento - No comercial - Compartir igual 4.0

Puedes editar todo esto después en eXeLearning si lo necesitas.

---

## Estado del proyecto

Lo que está hecho:

-  Convertir Word a eXeLearning
-  Sistema de temas (oficiales y locales)
-  Configurador de estructura
-  Opciones para H2 (iDevice, HTML, acordeón, pestañas)
-  Cajas semánticas ([importante], [ejemplo], [definición])
-  Tablas horizontal y vertical
-  Manejo de Iframes de medios embebidos.
-  PDF con portada, índice, encabezados y pies
-  Detección de idioma del tema
-  Reordenación de temas (drag-and-drop)
-  Guía de usuario integrada
-  Despliegue automático en GitHub Pages
-  Panel de administración de temas oficiales (publicar/actualizar/eliminar desde el navegador, sin Terminal)
-  PDF 100% offline (Paged.js embebido) + optimización automática de imágenes
-  Tests automatizados de la capa de transformación HTML (`npm test`)
-  Agrupación de temas por familia/idioma en selector y administración

Para la versión 2:

- Vista previa en tiempo real con editor de estructura tipo arbol. Despues de parsear con las utilidades de: drag & drop, mover secciones y cambiar niveles

---

**Documentación (web):** https://marioflorido.github.io/BUA-convertidor-exe/docs/arquitectura.html  
**Comparación con eXeConvert:** https://marioflorido.github.io/BUA-convertidor-exe/docs/comparacion.html  
**Repositorio:** https://github.com/MarioFlorido/BUA-convertidor-exe
