# Guía de Uso: ConvertidoreXe

## Introducción

**ConvertidoreXe** es una herramienta que convierte documentos Word (DOCX) a proyectos eXeLearning (ELPX) con estilos visuales profesionales y estructura semántica. 

Con ConvertidoreXe puedes crear cursos digitales de forma rápida: prepara tu contenido en Word, carga el archivo aquí, elige un tema visual, y descarga el proyecto listo para editar en eXeLearning o exportar como PDF.

---

## 5 Pasos Principales

1. **Prepara tu documento Word** con estructura clara (encabezados, tablas, etc.)
2. **Sube el archivo DOCX** a ConvertidoreXe
3. **Configura opciones** (jerarquía de encabezados, tema visual)
4. **Usa etiquetas especiales** para cajas semánticas, tablas, acordeones
5. **Descarga como ELPX** (para editar en eXe) o **PDF** (para imprimir)

---

## Paso 1: Preparar el Documento Word

### Estructura de Encabezados

Los encabezados en Word definen la estructura de tu curso. ConvertidoreXe soporta 4 niveles:

| Encabezado | Qué genera |
|:---|:---|
| **Título 1** | Página principal, página secundaria o página de 3er nivel |
| **Título 2** | Un encabezado H2 para iniciar una sección dentro del iDevice // La cabecera de un acordeón o una pestaña // El nombre de un iDevice para remarcar un "para saber más", bibliografía, etc. |
| **Título 3 al 4** | Secciones dentro del contenido |

**Ejemplo de estructura:**
```
Encabezado 1: Unidad 1 - Introducción a JavaScript
    Encabezado 2: Conceptos básicos
        Encabezado 3: Variables y tipos de datos
        Encabezado 3: Operadores
    Encabezado 2: Ejemplos prácticos
        Encabezado 3: Hola mundo
```

### Estilos Recomendados

- **Párrafos normales** para contenido
- **Listas con viñetas o números** para instrucciones
- **Tablas simples** para datos tabulares
- **Imágenes centradas** para ilustraciones

### Imágenes

Las imágenes deben estar insertadas directamente en el DOCX. ConvertidoreXe las exporta centradas en el ELPX. Para el PDF, se recomienda:
- Máximo 800 px de ancho
- Formato JPG o PNG
- Comprimidas (< 500 KB por imagen)

---

## Paso 2: Subir y Configurar

### Subir el Archivo

1. Haz clic en el área **"Arrastra tu archivo DOCX aquí"** o selecciona el archivo desde tu computadora
2. ConvertidoreXe procesa el documento (puede tardar unos segundos si es grande)
3. Cuando esté listo, aparecerá un panel de configuración

### Configurar la Jerarquía

En el panel de configuración:

- **"Encabezado principal para:"** — Elige qué tipo de encabezado crea páginas principales (normalmente Encabezado 1)
- **"Encabezado secundario para:"** — Elige el encabezado para subpáginas (normalmente Encabezado 2)
- **Mostrar tabla de contenidos** — Marca si quieres un índice automático

Normalmente los valores por defecto están bien. Solo cambia si tu documento tiene una estructura especial.

---

## Paso 3: Etiquetas Semánticas

Las etiquetas semánticas se aplican escribiendo el nombre entre corchetes al inicio de un párrafo nuevo, y cerrando con `[fin]` al final.

### Las 3 Etiquetas Semánticas

**[ejemplo]**

En Word, en un párrafo nuevo:
```
[ejemplo]
Contenido del ejemplo...
[fin]
```

**[definición]**

En Word, en un párrafo nuevo:
```
[definición]
Contenido de la definición...
[fin]
```

**[importante]**

En Word, en un párrafo nuevo:
```
[importante]
Contenido importante...
[fin]
```

### Notas sobre Sintaxis

- Mayúsculas y minúsculas no importan: `[EJEMPLO]`, `[Ejemplo]`, `[ejemplo]` funcionan igual
- Acentos son opcionales: `[definición]` y `[definicion]` funcionan igual
- Obligatorio cerrar con `[fin]`
- No pueden anidarse

---

## Paso 4: Tablas

Las tablas organizan datos en filas y columnas. ConvertidoreXe soporta dos tipos.

### [horizontal] — Encabezado Horizontal

Usa cuando la primera fila contiene títulos de columna.

**En Word:**
```
[horizontal]
| Concepto | Definición | Ejemplo |
|----------|-----------|---------|
| Variable | Espacio de memoria | x = 5 |
| Función | Bloque de código | def hola() |
```

No incluyas `[fin]` después de la tabla.

### [vertical] — Encabezado Vertical

Usa cuando la primera columna contiene títulos de fila.

**En Word:**
```
[vertical]
| | JavaScript | Python | Java |
|-----------|-----------|--------|
| Tipado | Débil | Dinámico | Fuerte |
| Compilado | No | No | Sí |
```

No incluyas `[fin]` después de la tabla.

---

## Paso 5: Efectos Especiales - Acordeones y Pestañas

Un H2 dentro de una página puede actuar como iDevice de texto colapsable, útil para biografía, "para saber más" o información complementaria.

---

## Paso 6: Configuración de Opciones

### Elegir Tema Visual

Un **tema** es un conjunto de estilos (colores, fuentes, diseño) que se aplica a todo el documento.

**Dónde aparecen los temas:**
Después de subir el archivo, en el panel de configuración verás un selector de temas disponibles. Incluye:
- Temas oficiales — Diseñados profesionalmente
- Temas locales — Cargados en tu navegador

**Cargar un tema local:**
1. Haz clic en "Cargar tema personalizado"
2. Selecciona el archivo ZIP del tema
3. El tema se almacena en tu navegador

### ELPX vs PDF

| ELPX | PDF |
|:---|:---|
| Formato de eXeLearning | Documento estático |
| Editable en eXe | Solo lectura |
| Incluye tema y estilos | Estilos optimizados para impresión |
| Se puede exportar a web/SCORM | Se puede imprimir directamente |
| Interactivo en navegador | Mejor para distribución física |

**Usa ELPX si:** Quieres editar el contenido después en eXeLearning.
**Usa PDF si:** Quieres distribuir como documento final para imprimir o compartir.

---

## Paso 7: Descargar ELPX

1. En el selector de temas, haz clic en el tema que quieras
2. La vista previa se actualiza instantáneamente
3. Selecciona el que más te guste

### Cargar un Tema Local

Si tu institución tiene temas personalizados:

1. Haz clic en **"Cargar tema personalizado"**
2. Selecciona el archivo ZIP del tema
3. El tema se almacena en tu navegador (IndexedDB) para usarlo en futuras conversiones

### ELPX vs PDF

- **ELPX:** Abre el tema y sus estilos en eXeLearning. Puedes editar después
- **PDF:** Aplica el tema pero con estilos de impresión (algunos colores pueden variar)

Si notas diferencias de color entre ELPX y PDF, es normal — PDF usa estilos optimizados para impresión.

---

## Descargar ELPX

Un **ELPX** es el formato nativo de eXeLearning. Es un archivo comprimido con la estructura del curso.

### Pasos para Descargar

1. Haz clic en el botón **"Descargar proyecto eXeLearning"**
2. Se descarga un archivo `.elpx` a tu carpeta de descargas
3. Abre eXeLearning en tu computadora

### Abrir en eXeLearning

1. En eXeLearning, ve a **Archivo → Abrir**
2. Selecciona el archivo `.elpx` que descargaste
3. eXeLearning carga el proyecto completo con tu tema

### Edición Básica en eXe

Después de abrir el ELPX en eXeLearning, puedes:

- **Editar contenido:** Haz doble clic en cualquier iDevice (cajas de contenido)
- **Añadir iDevices:** Usa el panel izquierdo para insertar nuevas cajas de contenido
- **Reordenar:** Arrastra iDevices para cambiar el orden
- **Cambiar nombre:** Edita el título de cada página/sección

**Nota importante:** ConvertidoreXe es para **crear la estructura inicial**. Después, eXeLearning es tu herramienta principal para ajustes finos.

### Exportar desde eXe

Desde eXeLearning puedes exportar a:

- **Sitio web** — HTML estático para visualizar en navegador
- **PDF** — Documento imprimible
- **SCORM** — Paquete para LMS (Moodle, Canvas, etc.)
- **EPUB** — Libro digital

---

## Exportar como PDF

La opción **"Vista previa para imprimir / PDF"** genera un PDF profesional directamente desde ConvertidoreXe.

### Pasos para Generar PDF

1. Haz clic en **"Vista previa para imprimir / PDF"**
2. ConvertidoreXe genera el PDF (puede tardar unos segundos)
3. Se abre en una nueva pestaña del navegador

### Con Foto de Portada / Sin Foto de Portada

El **switch** permite elegir:

- **Con foto portada:** Incluye una portada visual con imagen, título, fecha
- **Sin foto portada:** Solo portada de texto simple

Usa "Con foto" para documentos formales. Usa "Sin foto" para contenido técnico.

### Convertir a PDF Definitivo

Una vez abierto en el navegador:

1. **En Chrome/Firefox:** Presiona `Ctrl+P` (Windows) o `Cmd+P` (Mac)
2. Selecciona **"Guardar como PDF"**
3. Elige ubicación y nombre
4. Listo para imprimir o compartir

### Qué Incluye el PDF

- **Portada** — Título, fecha, institución (opcional)
- **Tabla de contenidos** — Índice automático con hipervínculos
- **Contenido** — Todas las páginas con estilos y colores del tema
- **Pies y encabezados** — Número de página, título de sección
- **Enlaces internos** — Tabla de contenidos es clickeable

---

## Solución de Problemas

### "El documento es muy grande y es lento"

**Causa:** Imágenes sin comprimir o documento muy largo.

**Solución:**
1. Comprime las imágenes en Word (click derecho → Comprimir imagen)
2. Divide el documento en partes más pequeñas
3. Intenta subir solo una sección primero

### "No veo mi tema en la lista"

**Causa:** El tema no se cargó correctamente o el navegador no lo encontró.

**Solución:**
1. Abre las **Herramientas de Desarrollador** (F12)
2. Mira la consola para ver si hay errores
3. Intenta cargar el tema nuevamente (limpia caché del navegador si es necesario)
4. Verifica que el archivo ZIP sea un tema válido (debe tener `config.xml` y `style.css`)

### "Al editar el iDevice en eXe se vacía el contenido"

**Causa:** Conflicto de estilos CSS del tema con la interfaz de eXeLearning (raro, pero puede ocurrir con temas personalizados).

**Solución:**
1. Intenta con otro tema (ej: "Clásico")
2. Si funciona, el problema es el tema personalizado
3. Contacta al administrador para revisar el CSS del tema

### "Las tablas salen con dos cabeceras"

**Causa:** La tabla tiene encabezado en Word y ConvertidoreXe también lo marca.

**Solución:**
1. En Word, selecciona la tabla
2. Ve a **Herramientas de tabla → Diseño**
3. Desactiva **"Fila de encabezado"** si ya está marcada
4. Si no, marca la primera fila como encabezado y descarga nuevamente

### "Las imágenes no están centradas"

**Causa:** Configuración de alineación en Word.

**Solución:**
1. En Word, selecciona la imagen
2. Ve a **Inicio → Alinear** y elige **"Centrar"**
3. Sube el documento nuevamente

### "¿Cuál es la diferencia entre ELPX y PDF?"

| ELPX | PDF |
|:---|:---|
| Formato de eXeLearning | Documento estático |
| Editable en eXe | Solo lectura |
| Incluye tema y estilos | Estilos optimizados para impresión |
| Se puede exportar a web/SCORM | Se puede imprimir directamente |
| Interactivo en navegador | Mejor para distribución física |

**Usa ELPX si:** Quieres editar el contenido después en eXeLearning.
**Usa PDF si:** Quieres distribuir como documento final para imprimir o compartir.

### "El PDF no tiene los colores del tema"

**Causa:** Los estilos de impresión son diferentes a los estilos de pantalla.

**Solución:**
- Es normal que algunos colores cambien ligeramente en PDF
- Los colores de impresión se eligieron para que sean legibles impresos
- Si necesitas ciertos colores exactos, contacta al administrador

---

## Tips y Mejores Prácticas

### ✓ Estructura Clara

- Usa encabezados jerárquicos (H1 → H2 → H3)
- No saltes niveles (no vayas de H1 directamente a H3)
- Mantén títulos concisos (< 60 caracteres)

### ✓ Contenido

- Escribe párrafos cortos (3-4 líneas máximo)
- Usa listas para instrucciones paso a paso
- Inserta imágenes después de introducir el concepto

### ✓ Etiquetas Semánticas

- No abuses — 1-2 cajas por página es suficiente
- Usa `[ejemplo]` para código o demostraciones
- Usa `[definición]` solo para términos nuevos
- Usa `[importante]` para advertencias reales

### ✓ Tablas

- Evita tablas con > 5 columnas (usa listas en su lugar)
- Mantén encabezados cortos (1-2 palabras)
- Marca siempre el tipo `[horizontal]` o `[vertical]`

### ✓ Tema Visual

- Elige un tema coherente con tu institución
- Evita cambiar de tema entre documentos (mantén consistencia)
- Si diseñas un tema personalizado, úsalo en todos tus cursos

### ✓ Revisión Final

- Abre el PDF antes de compartirlo
- Verifica números de página y tabla de contenidos
- Comprueba que todas las imágenes se vean bien
- Prueba los acordeones/pestañas en el navegador

---

## Preguntas Frecuentes

**P: ¿Puedo editar el documento después de descargar el ELPX?**  
R: Sí. Abre el ELPX en eXeLearning y edita como necesites.

**P: ¿Se pierden mis cambios si genero el PDF después?**  
R: No. El PDF es una "foto" del contenido en ese momento. El ELPX es editable.

**P: ¿Mi documento Word debe tener estilos especiales?**  
R: No. ConvertidoreXe funciona con estilos estándar de Word (Encabezado 1, Encabezado 2, etc.).

**P: ¿Puedo tener múltiples imágenes en una página?**  
R: Sí, todas se centrarán automáticamente.

**P: ¿Qué pasa si tengo tablas complejas (celdas combinadas)?**  
R: ConvertidoreXe intenta mantener la estructura, pero es mejor simplificar tablas muy complejas.

**P: ¿Puedo usar ConvertidoreXe sin crear un ELPX?**  
R: Sí. Puedes generar solo el PDF si prefieres un documento de lectura.

**P: ¿Los acordeones funcionan en eXeLearning también?**  
R: Sí. Cuando exportas desde eXe a web, los acordeones son interactivos.

**P: ¿Puedo cambiar de tema después de descargar?**  
R: Sí, cuando abres el ELPX en eXe puedes cambiar el tema desde el panel de propiedades.

---

## Contacto y Soporte

Si encuentras problemas o tienes sugerencias:

- Contacta al administrador de tu institución
- O abre un reporte de bug en el proyecto

Gracias por usar **ConvertidoreXe** 🎉

---

**Última actualización:** Mayo 2026
