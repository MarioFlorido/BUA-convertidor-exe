# Agradecimientos
 
## eXeConvert — Juanjo de Haro
 
Este proyecto no existiría sin **Juanjo de Haro** y **eXeConvert**.
 
eXeConvert hizo algo que parecía imposible: convertir documentos Word a formato eXeLearning sin instalar nada, sin servidores, sin complicaciones. Todo en el navegador, arquitectura limpia client-side. Esa idea fue el punto de partida de **BUA ConvertidoreXe**.
 
El código de eXeConvert es abierto y está bien pensado. Estudiar cómo resolvía el problema DOCX → ELPX es lo que me decidió a intentar este proyecto

 
**BUA ConvertidoreXe** es un desarrollo independiente para las necesidades específicas de la Biblioteca Universitaria de la Universidad de Alicante. Pero la deuda con eXeConvert es real.

Debido a su especificidad, la arquitectura interna de *BUA ConvertidoreXe* es diferente. Mientras *eXeConvert* construye el ELPX directo del HTML extraído del DOCX. Sin modelos intermedios, *BUA ConvertidoreXe* introduce `SemanticDocument` en el medio. Un modelo independiente del formato que representa el documento como páginas y bloques semánticos. Los renderers de ELPX y PDF consumen este modelo. Si mañana queremos añadir un nuevo formato, migrar de tecnología no haría falta tocar el parser.
 
---
 
# eXeConvert y BUA ConvertidoreXe — diferencias
 
Ambas herramientas comparten el mismo objetivo: convertir documentos a eXeLearning. Pero han tomado caminos distintos según sus contextos de uso. Aquí van las diferencias.
 
---
 
## Alcance y formatos soportados
 
**eXeConvert** es agnóstica. Soporta múltiples entrada/salida: `.docx`, `.elpx`, `.elp`, `.md`, `.pdf`. Convierte en varias direcciones. Exportas un ELPX existente a Word. Migras un proyecto antiguo `.elp` al formato moderno. Incluso tiene CLI e instalables de escritorio. Es herramienta para toda la comunidad eXeLearning.
 
**BUA ConvertidoreXe** hace una sola cosa: DOCX → ELPX y DOCX → PDF. Nada de conversiones al revés. Los materiales de la Biblioteca salen siempre de Word y necesitan convertirse a recursos eXeLearning con la identidad visual institucional. Es una herramienta para el personal de la Biblioteca, nada más.
 
---
 
## Fórmulas matemáticas
 
**eXeConvert** las maneja completas. Convierte OMML (Office Math Markup Language) a LaTeX, renderiza LaTeX y MathML a SVG mediante MathJax.
 
**BUA ConvertidoreXe** no toca matemáticas. Los materiales de BUA no las tienen, así que decidimos no complicarnos.
 
---
 
## Control sobre la estructura del documento
 
**eXeConvert** divide el documento automáticamente. Lee la jerarquía de encabezados y genera páginas y bloques sin que hagas nada.
 
**BUA ConvertidoreXe** ofrece un paso intermedio: configuración. Antes de convertir, sé decide qué hace cada nivel de encabezado. Uno puede ser página principal, otro subpágina, otro iDevice. Si necesitas un acordeón, lo defines. Si quieres pestañas, también. Todo sin tocar el Word original. Además, puedes etiquetar elementos con corchetes para aplicar efectos semánticos: [Definición], [Importante], [Ejemplo]. Los estilos se encargan del resto.
 
---
 
## Sistema de temas
 
**eXeConvert** genera ELPX con el tema por defecto de eXeLearning. La personalización visual corre por tu cuenta una vez lo abres en eXeLearning.
 
**BUA ConvertidoreXe** viene con temas institucionales en ZIP. El ELPX que genera ya incluye el tema seleccionado (Doctorado, CID, Ciencia Abierta u otros). Estilos CSS, tipografías, iconos, todo. El recurso está listo para publicar.
 
---
 
## Exportación PDF
 
**eXeConvert** usa `pdfmake` (navegador) o `puppeteer` (servidor). Genera un PDF funcional del contenido del ELPX.
 
**BUA ConvertidoreXe** lo hace directo desde el `SemanticDocument` con Paged.js y CSS Paged Media. Eso nos ofrece un control editorial muchísimo mejor. El resultado lleva portada con imagen institucional, logos BUA y UA, índice con numeración automática, cabeceras, pies de página, así como parte de los estilos del tema activo. Es material que puedes entregar o imprimir.
 
---
 
## Despliegue
 
**eXeConvert** tiene servidor (Puppeteer) para PDF en Node.js, además de instalables de escritorio.
 
**BUA ConvertidoreXe** no requiere servidor. Se despliega en GitHub Pages. Funciona en cualquier navegador moderno. Nada de instalar.
 
---
 
## Resumen
 
| Característica | eXeConvert | BUA ConvertidoreXe |
|---|---|---|
| Formatos de entrada | DOCX, ELPX, ELP, MD | DOCX |
| Formatos de salida | ELPX, DOCX, HTML, PDF | ELPX, PDF |
| Fórmulas matemáticas | Sí | No |
| Configuración de estructura | Automática | Por el usuario |
| Temas / estilos | No | Sí |
| PDF | Funcional | Con maquetación |
| CLI / escritorio | Sí | No |
| Despliegue | Node.js | 100% estático |
 
Para mí, Juanjo sigue siendo el auténtico gurú de eXeLearning.
Gracias por tu código abierto. Gracias por hacerlo bien.
