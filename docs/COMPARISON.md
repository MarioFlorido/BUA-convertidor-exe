# eXeConvert y BUA ConvertidoreXe — diferencias

BUA ConvertidoreXe nació como una herramienta específica para la Biblioteca Universitaria de la Universidad de Alicante, tomando como inspiración el trabajo de Juan José de Haro en eXeConvert. Aunque comparten el objetivo central de convertir documentos al formato eXeLearning, ambas herramientas han evolucionado con enfoques y prioridades distintas.

Este documento describe las diferencias sin establecer una jerarquía entre ellas: cada una responde a necesidades diferentes.

---

## Alcance y formatos soportados

**eXeConvert** es una herramienta generalista. Soporta múltiples formatos de entrada y salida: `.docx`, `.elpx`, `.elp`, `.md` y `.pdf`. Permite convertir en varias direcciones, incluyendo la exportación de proyectos ELPX existentes a Word o HTML, y la migración de proyectos `.elp` (formato antiguo) al formato `.elpx` moderno. Dispone además de una interfaz de línea de comandos (CLI) y paquetes de escritorio instalables. Esta diseñada para daar oporte y servir de ayuda a toda la comunidad de eXeLearning

**BUA ConvertidoreXe** se centra en un único flujo: DOCX → ELPX y DOCX → PDF. No contempla conversiones inversas ni otros formatos de entrada. Esta especialización es una decisión deliberada: los materiales de la Biblioteca Universitaria parten siempre de documentos Word, y el objetivo es transformarlos en recursos eXeLearning con la identidad visual institucional. Su objetivo es servir de herramienta al personal de la Biblioteca en la eleboración de los recursos docentes.

---

## Fórmulas matemáticas

**eXeConvert** incorpora soporte completo para expresiones matemáticas: convierte fórmulas OMML (Office Math Markup Language) a LaTeX, y renderiza LaTeX y MathML a SVG mediante MathJax. Es una funcionalidad relevante para contenidos técnicos y científicos.

**BUA ConvertidoreXe** no incluye procesamiento matemático. Los materiales de la Biblioteca Universitaria no contienen fórmulas, por lo que esta capacidad quedó fuera del alcance del proyecto desde el principio.

---

## Control sobre la estructura del documento

**eXeConvert** divide el documento automáticamente en páginas y bloques según la jerarquía de encabezados, sin intervención del usuario.

**BUA ConvertidoreXe** introduce un paso de configuración entre la carga del documento y la conversión: el usuario decide qué hace cada nivel de encabezado (página principal, subpágina, iDevice, acordeón, pestañas). Esto permite adaptar la estructura del ELPX resultante a documentos con organizaciones diversas, sin modificar el Word original. Además se pueden etiquetar elementos del word con corchetes para aplicar efectos, cajas semántias, etc definidas en los estilos

---

## Sistema de temas

**eXeConvert** genera ELPX con el tema por defecto de eXeLearning. La personalización visual queda en manos del usuario una vez abierto el proyecto en eXeLearning.

**BUA ConvertidoreXe** incorpora un sistema de control de temas institucionales en formato ZIP. El ELPX generado ya incluye el tema seleccionado (Doctorado, Doctorat, PhD u otros), con sus estilos CSS, tipografías, iconos y configuración. El recurso está listo para publicar sin necesidad de intervención posterior en eXeLearning.

---

## Exportación PDF

**eXeConvert** genera el PDF mediante `pdfmake` (navegador) o `puppeteer` (servidor), produciendo un documento funcional a partir del contenido del ELPX.

**BUA ConvertidoreXe** genera el PDF directamente desde el `SemanticDocument` mediante Paged.js y CSS Paged Media. Lo que confoiere mayor control editorial. El resultado incluye portada con imagen institucional, logos BUA y UA, índice con numeración automática de páginas, cabeceras y pies de página, y los estilos visuales del tema activo. El documento está pensado para ser entregado o impreso como material de apoyo.

---

## Arquitectura interna

**eXeConvert** construye el proyecto ELPX directamente a partir del HTML extraído del DOCX, sin un modelo de datos intermedio.

**BUA ConvertidoreXe** introduce `SemanticDocument` como capa central: un modelo agnóstico al formato de salida que representa el documento como páginas y bloques semánticos. Los renderers ELPX y PDF consumen este modelo de forma independiente, lo que facilita añadir nuevos formatos de salida sin modificar el pipeline de parsing.

---

## Despliegue

**eXeConvert** incluye un componente de servidor (Puppeteer) para la generación de PDF en Node.js, además de paquetes de escritorio para distintas plataformas.

**BUA ConvertidoreXe** es completamente estático: no requiere servidor, se despliega directamente en GitHub Pages y funciona en cualquier navegador moderno sin instalación.

---

## Resumen

| Característica | eXeConvert | BUA ConvertidoreXe |
|---|---|---|
| Formatos de entrada | DOCX, ELPX, ELP, MD | DOCX |
| Formatos de salida | ELPX, DOCX, HTML, PDF | ELPX, PDF |
| Fórmulas matemáticas | Sí | No |
| Configuración de estructura | Automática | Configurable por el usuario |
| Temas / estilos | No | Sí |
| PDF | Funcional | Con maquetación tomada de los temas |
| CLI / escritorio | Sí | No |
| Despliegue | Requiere Node.js | 100% estático |

Ambas herramientas son soluciones válidas para convertir documentos a eXeLearning. Sus diferencias reflejan contextos de uso distintos, no una relación de superioridad entre ellas. Para el autor de Juan Jose de HAro sigue siendo el auténtico gurú de eXeLearning y sus hacks
