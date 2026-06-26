---
name: ConvertidoreXe
description: Herramienta institucional para convertir documentos Word a cursos eXeLearning—minimalista, eficiente, transparente.
colors:
  primary-blue: "#1560D8"
  primary-blue-hover: "#0F4BA0"
  primary-blue-active: "#0A3A7F"
  primary-blue-light: "#E8F1FF"
  primary-blue-border: "#B3D9FF"
  text-primary: "#1D1D1F"
  text-secondary: "#4A4A50"
  text-tertiary: "#626268"
  border-standard: "#D2D2D7"
  border-light: "#E8E8ED"
  switch-track: "#C7CBD3"
  switch-track-border: "#7D8497"
  surface-default: "#FFFFFF"
  background-institutional: "#EDF1F7"
  feedback-success: "#34C759"
  feedback-success-light: "#E3F9EB"
  feedback-error: "#D92B2B"
  feedback-error-light: "#FFF0F0"
  feedback-warning: "#8A5A00"
  feedback-warning-light: "#FFF8E6"
  theme-badge-local: "#6A1B9A"
  theme-badge-local-light: "#F3E5F5"
  theme-badge-local-border: "#CE93D8"
typography:
  heading-1:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  heading-2:
    fontFamily: "Inter"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  heading-3:
    fontFamily: "Inter"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Inter"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter"
    fontSize: "0.72rem"
    fontWeight: 500
    letterSpacing: "0.04em"
    textTransform: "uppercase"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "44px"
components:
  button-primary:
    backgroundColor: "{colors.primary-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "0.575rem 1.375rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-blue-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0.575rem 1.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary-blue}"
    rounded: "{rounded.sm}"
  input-default:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.75rem"
  card-default:
    backgroundColor: "{colors.surface-default}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  toggle-track:
    backgroundColor: "{colors.switch-track}"
    rounded: "12px"
    width: "44px"
    height: "24px"
  toggle-track-on:
    backgroundColor: "{colors.primary-blue}"
---

# Design System: ConvertidoreXe

## 1. Overview

**Creative North Star: "La Herramienta Institucional Confiable"**

ConvertidoreXe es el intermediario invisible entre la tarea y la intención del usuario. Su diseño refleja la seriedad y el rigor de una institución pública (Universidad de Alicante) manteniendo una interfaz que se retrae: los componentes son funcionales, no decorativos; el color es contenido, no llamativo; la tipografía es clara, nunca juguetona.

El sistema rechaza explícitamente (como se establece en PRODUCT.md):
- Ornamentación lúdica o decorativa (elementos gamificados, etiquetas con emoji, encanto innecesario)
- Animaciones complejas que ralentizan la interacción
- Ambigüedad sobre dónde van los datos o qué está ocurriendo
- Condescendencia hacia el usuario o su documento

**Características clave:**
- Navegación lateral persistente (sidebar) con pipeline de pasos vertical, marca y acciones en una sola columna
- Minimalismo sin frialdad: cada elemento comunica o actúa
- Paleta institucional azul grisácea, con un azul primario vibrante y seguro de sí mismo
- Tipografía única (Inter): coherencia total, sin pares complejos
- Separación limpia por tono de fondo, no por ornamento visual
- Sombras sutiles solo cuando hay cambio de estado
- Contraste de texto verificado, no asumido: cada gris se mide contra 4.5:1 antes de entrar al sistema

## 2. Colors: Paleta Institucional Azul Grisácea

La paleta es restringida e institucional. El azul domina las acciones primarias; los grises neutros sostienen la jerarquía de legibilidad. Los colores de retroalimentación (verde, rojo, ámbar) son precisos y accesibles. Un único morado, reservado a un solo propósito, completa el sistema.

### Primary
- **Azul Corporativo** (#1560D8): Acento primario para botones CTA, estados activos, paso actual del pipeline, y elementos de enfoque. Vibrante y audaz sin perder seriedad institucional. Usado en menos del 10% de cualquier pantalla.
- **Azul Corporativo Hover** (#0F4BA0): Variación más oscura aplicada en hover/active de botones primarios. Proporciona retroalimentación clara sin sorpresas.
- **Azul Corporativo Activo** (#0A3A7F): Variación aún más oscura para estados presionados. Nunca se usa en reposo.
- **Azul Claro** (#E8F1FF): Fondo de contenedores sutil cuando el azul requiere contexto sin peso. Estados completados, badges informativos, fondo del paso activo del pipeline.
- **Azul Borde** (#B3D9FF): Borde sutil para enfoque y separación cuando el azul es necesario. Nunca más oscuro que el contenido que envuelve.

### Neutral
- **Texto Primario** (#1D1D1F): Cuerpo de texto, etiquetas de formulario, encabezados. Alto contraste contra cualquier fondo. 4.5:1 mínimo garantizado.
- **Texto Secundario** (#4A4A50): Ayuda contextual, subencabezados, metadatos. Menos peso visual pero aún legible (4.5:1 contra blanco).
- **Texto Terciario** (#626268): Placeholder de entrada, texto deshabilitado, notas muy reducidas. Calibrado para alcanzar 4.5:1 sobre blanco (6.06:1 real) y sobre el fondo institucional (5.34:1 real) — ver Regla del Contraste No Negociable.
- **Borde Estándar** (#D2D2D7): Bordes de entrada, separadores moderados, estructura. Visible sin dominar.
- **Borde Claro** (#E8E8ED): Divisores sutiles, líneas dentro de tarjetas, separadores de bajo peso. Apenas visible pero define estructura.
- **Switch Apagado** (#C7CBD3 relleno / #7D8497 borde): Neutros propios del componente toggle en estado apagado. El borde alcanza ≥3:1 sobre blanco para cumplir WCAG 1.4.11 (contorno de componente de UI); el estado activo usa el azul corporativo.
- **Superficie Predeterminada** (#FFFFFF): Blanco puro para contenido, tarjetas, paneles. Máxima legibilidad.
- **Fondo Institucional** (#EDF1F7): Azul grisáceo muy suave como fondo de página y del área de contenido. No es un neutral puro; retiene un matiz institucional sin ser saturado.

### Feedback
- **Éxito: Verde** (#34C759): Confirmación, completado, válido. Se usa en checkmarks, badges de éxito, fondos de estado completado.
- **Éxito Claro** (#E3F9EB): Fondo para alertas/notificaciones de éxito. Contraste suficiente contra verde.
- **Error: Rojo** (#D92B2B): Validación fallida, destructivo, advertencia bloqueante. Nunca se usa en hover pasivo.
- **Error Claro** (#FFF0F0): Fondo para alertas de error. Alto contraste manteniendo la suavidad.
- **Advertencia: Ámbar** (#8A5A00 sobre #FFF8E6, borde `rgba(183,121,31,.3)`): Avisos **no bloqueantes** — p. ej. etiquetas semánticas (`[importante]`, `[ejemplo]`) sin cerrar correctamente en el documento original. El usuario puede continuar; la advertencia informa, no impide. No confundir con Error: el ámbar nunca detiene un flujo.

### Distintivo de un solo uso
- **Morado de Tema Local** (#6A1B9A sobre #F3E5F5, borde #CE93D8): Existe exclusivamente para distinguir a simple vista un tema **local/subido por el usuario** (no auditado, no centralizado) de un tema **oficial** (azul). No se reutiliza en ningún botón, alerta, ni otro componente — ver Regla del Morado Único.

### Named Rules

**La Regla de la Austeridad Azul.** El azul corporativo aparece en menos del 10% de cualquier pantalla de contenido. Es acento, no decoración. Cuando se requiere más color de marca, se usa azul claro (#E8F1FF) o borde azul (#B3D9FF), no más saturación del primario.

**La Regla de la Jerarquía de Grises.** Los tres niveles de gris textual (primario / secundario / terciario) crean jerarquía por peso, no por color. Nunca se mezclan con colores de marca; permanecen neutros y predecibles.

**La Regla del Contraste No Negociable.** Todo texto sobre fondo claro alcanza mínimo 4.5:1 — sin excepción para texto secundario o terciario, y sin "gris elegante" como justificación. El terciario (#626268) se fijó en ese valor exacto porque el tono anterior no llegaba al mínimo. Cualquier gris nuevo que se incorpore al sistema se mide con la misma vara antes de aceptarse.

**La Regla del Morado Único.** El morado de tema local tiene un solo trabajo: el badge "Local". Si aparece en cualquier otro lugar de la interfaz, es un error, no una decisión de diseño.

## 3. Typography

**Display Font:** Inter (con fallback -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif)
**Body Font:** Inter (misma familia)
**Label Font:** Inter (con pequeño tamaño y espaciado expandido)

**Character:** Una familia única, sin pares. Inter es neutro, técnico y altamente legible a cualquier tamaño. La jerarquía se construye por peso (400/500/600/700), no por pares de familias. El minimalismo se logra manteniendo simplicidad tipográfica.

### Hierarchy
- **Heading 1** (700, 1.35rem, 1.2): Títulos de sección principal ("Configura la estructura", encabezados de pantalla). Máximo ~21.6px a cualquier breakpoint; nunca se amplifica más.
- **Heading 2** (600, 1.1rem, 1.3): Títulos de subsección, título del Tour de Bienvenida. Menos prominente que H1 pero aún claramente jerárquico.
- **Heading 3** (600, 0.9rem, 1.4): Etiquetas de grupo, títulos de tarjeta pequeña (panel de administración, gestor de temas). Delimitador visual en flujos densos.
- **Body** (400, 0.875rem, 1.5): Párrafos, texto de explicación, descripción. Limitado a 65–75 caracteres de ancho cuando es prosa continua. En flujos de datos o UI denso, puede ser más ancho sin penalización.
- **Body Small** (400, 0.8rem, 1.5): Ayuda contextual, atributos de metadatos, notas. Aún legible (4.5:1 contraste mínimo).
- **Label** (500, 0.72rem, tracking 0.04em): Etiquetas de campo, badges, pequeños indicadores de estado. Mayúscula por defecto. Usado para "DOCUMENTO" / "PASO 1" / "DESCARGADO".

### Named Rules

**La Regla de la Escala Fija.** No se usa clamp() o tamaños fluidos para tipografía. El usuario ve el texto con DPI consistente; un h1 fluido en una barra lateral se ve mal, no mejor. Todos los tamaños son rem fijos.

**La Regla del Ancho de Línea.** La prosa continua nunca supera 75 caracteres. El cuerpo denso de UI (listas, tablas) puede exceder esto sin penalización; solo la prosa narrativa obedece el límite.

## 4. Elevation

El sistema usa elevación **plana por defecto con sombras sutiles activadas por estado**. No hay capas de "profundidad estructural" visibles en reposo. Cuando un usuario interactúa (hover, focus, active) o un elemento requiere distinción clara (una tarjeta de contenido), se aplica una sombra ambiental suave.

Las sombras nunca son oscuras ni fuertes; están diseñadas para ser "sentidas" como una separación visual, no "vistas" como un objeto dramático.

### Shadow Vocabulary
- **Shadow XS** (`0 1px 3px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04)`): Borde suave + sombra apenas perceptible. Usado en elementos en reposo que necesitan definición limpia (inputs, pequeñas tarjetas, panels). La doble capa (sombra + borde 1px) mantiene definición sin peso.
- **Shadow SM** (`0 2px 8px rgba(0,0,0,.10), 0 12px 32px rgba(0,0,0,.07)`): Sombra de hover, tarjetas primarias, paneles en foco. El desenfoque (8px + 12px) mantiene suavidad; la opacidad (10% / 7%) previene dureza.
- **Shadow MD** (`0 8px 28px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.08)`): Modales (Tour de Bienvenida), overlays, contenido flotante (tooltips, dropdowns elevados). Más definición para separar del fondo; aún ambiental, nunca duro.

### Named Rules

**La Regla del Reposo Plano.** Las superficies en reposo NO tienen sombra ambiental a menos que requieran separación clara del fondo. Entrada de texto, botón secundario, tarjeta neutral = sin sombra. Cambios de estado (hover, foco) activan shadow-sm; la sombra refuerza el cambio.

**La Regla de la Sombra Ambiental.** Las sombras nunca son negras puras. Siempre son `rgba(0,0,0, 0.08–0.14)` con desenfoque moderado. Esto crea separación sin dramatismo. Modales y flotantes pueden usar shadow-md; todo lo demás es xs o sm.

## 5. Components

ConvertidoreXe es un editor de estructura de documento y configurador de tema. Sus componentes son herramientas: botones con peso, inputs con claridad, tarjetas que organizan contenido jerárquico, navegación que comunica posición.

### Buttons

**Carácter:** Preciso, sin ambigüedad. Los botones no son juguetes; son acciones.

- **Primary Button (Primario CTA):** Azul corporativo (#1560D8), blanco de texto, padding 0.575rem 1.375rem, radio sm (6px), sin borde. Hover → azul más oscuro (#0F4BA0) + shadow-sm. Disabled → gris terciario (#626268), sin sombra, cursor no-permitido, 70% opacidad.
- **Secondary Button (Acción alternativa):** Blanco fondo + texto gris secundario (#4A4A50), borde 1px (#D2D2D7), mismo padding y radio. Hover → fondo institucional (#EDF1F7) + texto gris primario. Active → azul claro fondo (#E8F1FF) + borde azul (#B3D9FF). Nunca reemplaza primario en UI; usado para "Cancelar", "Atrás", "Más opciones".
- **Ghost Button (Mínimo):** Sin fondo, azul texto (#1560D8), sin borde (o borde invisible). Hover → fondo institucional (#EDF1F7) + sombra xs. Usado en acciones contextuales: "Expandir todo", "Ayuda", "Ver documentación".
- **Destructive Button (Eliminar):** Rojo (#D92B2B) texto sobre fondo claro de error (#FFF0F0), borde 1px rojo suave. Requiere confirmación; nunca es un clic único.

### Inputs & Form Controls

- **Text Input / Select / Textarea:** Fondo blanco (#FFFFFF), borde 1px (#D2D2D7), radio sm (6px), padding 0.55rem 0.75rem, font-size 0.875rem. Text color primario (#1D1D1F), placeholder terciario (#626268) a contraste verificado (no gris pálido). Focus → borde azul (#1560D8) + shadow-xs (no glow violento). Error → borde rojo (#D92B2B), fondo claro de error (#FFF0F0). Disabled → fondo institucional (#EDF1F7), texto terciario, sin interacción.
- **Toggle / Switch:** Ancho 44px, alto 24px, radio pill (12px), fondo `--switch-track` (#C7CBD3) con borde `--switch-track-border` (#7D8497) en reposo, azul (#1560D8) sin borde visible cuando activo. Thumb blanco circular de 18px, transición de posición 0.2s. Nunca rotatoria ni icónica; forma clara de rectángulo con pulgar deslizable.
- **Toggle Group (panel plano de agrupación):** Cuando varios toggles pertenecen a una misma acción contigua (p. ej. los toggles de PDF junto a su botón de descarga, en la pantalla de resultado), se envuelven en un panel blanco plano (#FFFFFF, radio sm, sin borde ni sombra, padding 0.625rem 0.75rem) en vez de etiquetarlos con texto. Solo funciona cuando el fondo detrás es el institucional (#EDF1F7): el blanco tiene que ser más claro que su entorno para notarse, no igual. Es la Regla del Reposo Plano aplicada a agrupación: el contorno agrupa, no una etiqueta.
- **Checkbox / Radio (nativo):** Usar controles nativos del navegador con `accent-color: {colors.primary-blue}`. Mantener pequeño; enfoque con outline azul 2px.

### Cards & Containers

- **Default Card:** Fondo blanco (#FFFFFF), borde 1px (#E8E8ED), radio md (8px), padding 1.125rem. Usado para tarjetas de tema, tarjetas H1 del configurador, paneles de administración. En hover o selección → borde azul claro (#B3D9FF) + shadow-sm. Nunca cards anidadas; estructura plana o jerarquía por indentación.
- **Feature Container (contenedor destacado):** Mismo lenguaje que Default Card pero con radio lg (10px) y padding más generoso (2–2.5rem) — reservado a los tres momentos de mayor peso visual del asistente: zona de subida de documento, panel de progreso de conversión, y tarjeta de resultado final. El radio ligeramente mayor distingue "este es un momento" de "esto es contenido de apoyo".
- **Section Header Card (Encabezado de subsección):** Fondo institucional (#EDF1F7), padding 0.7rem 1rem, texto primario 500–600 de peso. Usado en cabeceras de tarjeta H1 colapsables. Sin sombra en reposo; borde inferior suave cuando está expandida para separar del contenido debajo.

### Navigation: Sidebar y Pipeline de Pasos

**Carácter:** Una sola columna izquierda que siempre dice al usuario dónde está y a dónde puede ir. No es un menú: es un mapa del flujo de 4 pasos.

- **Sidebar:** Ancho fijo 215px, fondo blanco (#FFFFFF), borde derecho 1px (#E8E8ED), columna completa con scroll propio. Tres bloques verticales, de arriba a abajo:
  1. **Marca:** logotipo BUA (40px de alto) + nombre + subtítulo institucional, separado del resto por un borde inferior.
  2. **Pipeline de pasos** (vertical, no una barra horizontal): círculos de 24px conectados por una línea vertical de 1.5px. Paso completado → fondo azul claro, borde azul claro, check azul. Paso activo → círculo de 26px, fondo azul sólido, texto blanco — el único paso que crece de tamaño. Paso pendiente → círculo blanco, borde gris, texto terciario al 60% de opacidad. La etiqueta de cada paso vive a la derecha del círculo: peso 700 si es el activo, 500 si está completado (y es clicable, con hover azul), 400 al 60% de opacidad si es futuro.
  3. **Acciones** (ancladas al fondo de la columna): "Estilos eXeLearning", toggle de "Ayuda" (activa/desactiva el Tour), "Información" — botones fantasma de ancho completo, icono + etiqueta alineados a la izquierda.
- **Comportamiento responsive:** bajo 640px el sidebar se apila encima del contenido a ancho completo (no se colapsa a iconos ni se oculta tras un botón de menú); la página entera pasa a scroll vertical normal.

### Tour de Bienvenida (Modal de Ayuda Contextual)

**Carácter:** Ayuda que se puede ignorar. No es un onboarding forzado de una sola vez: el usuario lo activa o desactiva desde el sidebar, y reaparece en cada pantalla mientras está activo — "Entendido" cierra solo esa visita, no el sistema de ayuda completo.

- **Overlay:** Posición fija a pantalla completa, scrim oscuro `rgba(20, 20, 24, 0.6)` que bloquea la interacción con el fondo mientras el tooltip está visible. Entrada con fade-in de 0.2s.
- **Tooltip:** Tarjeta centrada de hasta 480px de ancho, fondo blanco, radio lg (10px), shadow MD, padding 1.75rem. Contador de paso en azul (0.75rem, peso 600) sobre un título (1.1rem, peso 600) y uno o más párrafos de cuerpo en texto secundario (0.9rem). Acciones alineadas a la derecha.
- Preferir párrafos explicativos completos sobre fragmentos de coach-mark anclados a un elemento: el modal centrado da sitio a explicaciones reales sin pelear por espacio contra la interfaz que describe.

### Selector de Temas

**Carácter:** Cada tema es una decisión con peso visual propio — miniatura grande, metadatos claros, nunca una fila de texto plano.

- **Theme Option (tema individual):** Radio + miniatura (220px, opacidad 50% en reposo → 100% en hover/selección) + nombre + metadatos (idioma, curso académico) + descripción. Borde azul claro y shadow-sm cuando seleccionado o en hover.
- **Theme Family Option (familia multi-idioma):** Cuando varios temas oficiales son el mismo curso en distintos idiomas (castellano/valenciano/inglés), se presentan como **una sola tarjeta** con una fila de píldoras seleccionables — una por variante de idioma — en vez de filas sueltas repetidas. Cada píldora (`.theme-lang-option`) lleva el nombre del idioma en texto plano, nunca un icono de bandera (evita ambigüedad regional entre castellano y valenciano). Píldora seleccionada → borde azul + fondo azul al 8%, peso 500.
- **Theme Badge:** Distintivo "Oficial" (azul claro / azul / borde azul claro — mismo vocabulario que el resto de la marca) vs. "Local" (morado #6A1B9A sobre #F3E5F5, borde #CE93D8 — el único uso de este color en el sistema; ver Regla del Morado Único). Permite distinguir de un vistazo un tema centralizado y auditado de uno subido por el propio usuario.

### Reordenación de Temas (Drag & Drop)

**Carácter:** Directo y sin ambigüedad sobre qué se mueve y dónde caerá — nada de animaciones de "magia", solo retroalimentación binaria.

- **Asa de arrastre:** Icono `≡` de 20×14px en gris terciario; cursor `grab` en reposo, `grabbing` mientras se arrastra.
- **Elemento en arrastre:** Opacidad reducida a 0.4 — permanece visible pero inequívocamente "levantado" de su posición.
- **Indicador de destino:** Línea azul sólida de 3px sobre o bajo la tarjeta objetivo. Sin sombra, sin desenfoque: la señal es binaria (aquí va a caer), no atmosférica.
- El reordenamiento se guarda automáticamente al soltar; no hay un paso de confirmación separado.

### Status & Feedback

- **Alert / Banner (4 variantes):** éxito (#E3F9EB / #1a6b35), error (#FFF0F0 / #D92B2B), información (#E8F1FF / azul activo — reutiliza la paleta primaria, no introduce un color nuevo), y **advertencia** (#FFF8E6 / #8A5A00, borde `rgba(183,121,31,.3)`) — reservada a avisos no bloqueantes como etiquetas semánticas sin cerrar. Padding 0.875rem 1rem, radio sm (6px). Sin icono obligatorio; cuando presente, 16-20px SVG.
- **Loading Spinner:** SVG 18px, borde 2px (#D2D2D7) con borde superior azul (#1560D8), animación spin 0.7s linear infinite. Nunca en el centro del contenido; siempre junto a etiqueta ("Procesando...").
- **Success Animation (Descarga completada):** Circle pop entrada (0.35s cubic-bezier(0.34, 1.56, 0.64, 1)), checkmark dibuja con stroke-dasharray (0.45s ease-out). Verde fondo (#E3F9EB), checkmark verde (#34C759).
- **Editor de Código (panel de administración):** Única excepción deliberada al lienzo claro del sistema. El editor CSS inline (`.admin-css-textarea`) invierte la paleta — fondo oscuro (reutiliza el texto primario, #1D1D1F) con texto claro (#D6D6D8), tipografía monoespaciada. Se justifica porque la edición de código tiene una convención visual propia y fuertemente establecida (editores oscuros) que la identidad institucional clara no debe forzar a romper.

## 6. Do's and Don'ts

### Do:
- **Do** usar Inter en toda la interfaz, sin excepciones. Mantén pesos 400 (body), 500 (labels), 600 (títulos), 700 (énfasis).
- **Do** mantener el azul primario (#1560D8) a menos del 10% de cualquier pantalla. Todos los demás puntos de color usan neutros, claros, o feedback.
- **Do** verificar el contraste de cualquier gris nuevo contra 4.5:1 antes de incorporarlo al sistema — el terciario ya pasó por este ajuste exacto una vez (#626268).
- **Do** aplicar sombras XS en reposo para inputs/tarjetas pequeñas; shadow-SM en hover/focus; shadow-MD solo en modales/flotantes.
- **Do** escribir etiquetas de entrada y de campo en mayúscula pequeña (0.72rem, weight 500, tracking 0.04em). Esto crea claridad visual sin grito.
- **Do** usar chevrones SVG para expandir/contraer en lugar de caracteres ASCII (▲ / ▼). Son más precisos y animables.
- **Do** respetar `prefers-reduced-motion`: reemplazar todas las animaciones con crossfades instantáneas o eliminación.
- **Do** mantener focus rings azules (2px, offset 2px) visibles en navegación por teclado. No esconder nunca.
- **Do** reservar el morado de "tema local" exclusivamente para ese badge; no reutilizarlo en botones, alertas u otros componentes.

### Don't:
- **Don't** usar animaciones complejas o coreografiadas (ver PRODUCT.md anti-referencia: "Heavy or complex animations"). Motion es solo para cambio de estado: entrada, validación, loading, confirmación. Nunca para delight.
- **Don't** crear cards anidadas. Jerarquía por indentación, borde sutil, o fondo, nunca por profundidad visual repetida.
- **Don't** saturar el azul corporativo. Si necesitas más marca visible, usa azul claro (#E8F1FF) o borde azul (#B3D9FF), no más #1560D8.
- **Don't** inventar affordances. Los botones se ven como botones. Los inputs tienen borde y padding. Los toggles no rotan ni son icónicos.
- **Don't** usar gráficos de degradado, glassmorphism, o bordes laterales gruesos (> 1px) como decoración. Rechazado en PRODUCT.md como "overly playful".
- **Don't** etiquetar cada sección con un número pequeño ("01 PASO", "02 OPCIÓN"). Aparece solo en flujos reales donde el orden importa e informa (no como reflex ornamental).
- **Don't** oscurecer o confundir dónde van los datos. Si un documento se procesa localmente, décirlo. Si hay validación, mostrar el error exacto. Nunca ambigüedad.
- **Don't** usar display fonts, script, o monoespacial decorativo fuera del editor de código del panel de administración. Inter es la familia en todo lo demás.
- **Don't** rellenar con placeholder de relleno. Si un estado vacío ocurre, diseñarlo: "No hay temas cargados aún" es mejor que una tarjeta vacía.
- **Don't** expandir el ámbar de advertencia a flujos bloqueantes. Si un error detiene el proceso, es rojo; si solo informa y el usuario puede continuar, es ámbar.
- **Don't** volver a una cabecera horizontal con step-bar. La navegación primaria vive en el sidebar vertical; cualquier cambio de layout que la desplace necesita una razón explícita, no solo preferencia estética.
