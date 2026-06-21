---
name: ConvertidoreXe
description: Herramienta institucional para convertir documentos Word a cursos eXeLearning—minimalista, eficiente, transparente.
colors:
  primary-blue: "#1B6EC2"
  primary-blue-hover: "#155FAF"
  primary-blue-active: "#1054A0"
  primary-blue-light: "#EBF3FF"
  primary-blue-border: "#BDD8FF"
  text-primary: "#1D1D1F"
  text-secondary: "#4A4A50"
  text-tertiary: "#8E8E93"
  border-standard: "#D2D2D7"
  border-light: "#E8E8ED"
  surface-default: "#FFFFFF"
  background-institutional: "#EDF1F7"
  feedback-success: "#34C759"
  feedback-success-light: "#E3F9EB"
  feedback-error: "#D92B2B"
  feedback-error-light: "#FFF0F0"
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
  md: "10px"
  lg: "14px"
spacing:
  xs: "2px"
  sm: "4px"
  md: "8px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
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
---

# Design System: ConvertidoreXe

## 1. Overview

**North Star: "La Herramienta Institucional Confiable"**

ConvertidoreXe es el intermediario invisble entre la tarea y la intención del usuario. Su diseño refleja la seriedad y el rigor de una institución pública (Universidad de Alicante) manteniendo una interfaz que se retrae: los componentes son funcionales, no decorativos; el color es contenido, no llamativo; la tipografía es clara, nunca juguetona.

El sistema rechaza explícitamente (como se establece en PRODUCT.md):
- Ornamentación lúdica o decorativa (elementos gamificados, etiquetas con emoji, encanto innecesario)
- Animaciones complejas que ralentizan la interacción
- Ambigüedad sobre dónde van los datos o qué está ocurriendo
- Condescendencia hacia el usuario o su documento

**Características clave:**
- Minimalismo sin frialdad: cada elemento comunica o actúa
- Paleta institucional azul grisáceo: transmite confianza y seriedad
- Tipografía única (Inter): coherencia total, sin pares complejos
- Separación limpia por tono de fondo, no por ornamento visual
- Sombras sutiles solo cuando hay cambio de estado

## 2. Colors: Paleta Institucional Azul Grisáceo

La paleta es restringida e institucional. El azul domina las acciones primarias; los grises neutros sostienen la jerarquía de legibilidad. Los colores de retroalimentación (verde, rojo) son precisos y accesibles.

### Primary
- **Azul Corporativo** (#1B6EC2): Acento primario para botones CTA, estados activos, y elementos de enfoque. Transmite autoridad institucional sin ser agresivo. Usado en menos del 10% de cualquier pantalla.
- **Azul Corporativo Hover** (#155FAF): Variación más oscura aplicada en hover/active de botones primarios. Proporciona retroalimentación clara sin sorpresas.
- **Azul Corporativo Activo** (#1054A0): Variación aún más oscura para estados presionados. Nunca se usa en reposo.
- **Azul Claro** (#EBF3FF): Fondo de contenedores sutil cuando el azul requiere contexto sin peso. Estados completados, badges informativos.
- **Azul Borde** (#BDD8FF): Borde sutil para enfoque y separación cuando el azul es necesario. Nunca más oscuro que el contenido que envuelve.

### Neutral
- **Texto Primario** (#1D1D1F): Cuerpo de texto, etiquetas de formulario, encabezados. Alto contraste contra cualquier fondo. 4.5:1 mínimo garantizado.
- **Texto Secundario** (#4A4A50): Ayuda contextual, subencabezados, metadatos. Menos peso visual pero aún legible (4.5:1 contra blanco).
- **Texto Terciario** (#8E8E93): Placeholder de entrada, texto deshabilitado, notas muy reducidas. Mantiene contraste 4.5:1 contra fondo blanco.
- **Borde Estándar** (#D2D2D7): Bordes de entrada, separadores moderados, estructura. Visible sin dominar.
- **Borde Claro** (#E8E8ED): Divisores sutiles, líneas dentro de tarjetas, separadores de bajo peso. Apenas visible pero define estructura.
- **Superficie Predeterminada** (#FFFFFF): Blanco puro para contenido, tarjetas, paneles. Máxima legibilidad.
- **Fondo Institucional** (#EDF1F7): Azul grisáceo muy suave como fondo de página. No es un neutral puro; retiene un matiz institucional sin ser saturado. Alternativa a blanco cuando se necesita definición visual suave de áreas.

### Feedback
- **Éxito: Verde** (#34C759): Confirmación, completado, válido. Se usa en checkmarks, badges de éxito, fondos de estado completado.
- **Éxito Claro** (#E3F9EB): Fondo para alertas/notificaciones de éxito. Contraste suficiente contra verde.
- **Error: Rojo** (#D92B2B): Validación fallida, destructivo, advertencia. Nunca se usa en hover pasivo.
- **Error Claro** (#FFF0F0): Fondo para alertas de error. Alto contraste manteniendo la suavidad.

### Named Rules

**La Regla de la Austeridad Azul.** El azul corporativo aparece en menos del 10% de cualquier pantalla de contenido. Es acento, no decoración. Cuando se requiere más color de marca, se usa azul claro (#EBF3FF) o borde azul (#BDD8FF), no más saturación del primario.

**La Regla de la Jerarquía de Grises.** Los tres niveles de gris textual (primario / secundario / terciario) crean jerarquía por peso, no por color. Nunca se mezclan con colores de marca; permanecen neutros y predecibles.

## 3. Typography

**Display Font:** Inter (con fallback -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif)
**Body Font:** Inter (misma familia)
**Label Font:** Inter (con pequeño tamaño y espaciado expandido)

**Character:** Una familia única, sin pares. Inter es neutro, técnico y altamente legible a cualquier tamaño. La jerarquía se construye por peso (400/500/600/700), no por pares de familias. El minimalismo se logra manteniendo simplicidad tipográfica.

### Hierarchy
- **Heading 1** (700, 1.35rem, 1.2): Títulos de sección principal. Aparece como "sección-encabezado" y "h1" de página. Máximo ~21.6px a cualquier breakpoint; nunca se amplifica más.
- **Heading 2** (600, 1.1rem, 1.3): Títulos de subsección, encabezados de panel. Menos prominente que H1 pero aún claramente jerárquico.
- **Heading 3** (600, 0.9rem, 1.4): Etiquetas de grupo, títulos de tarjeta pequeña. Delimitador visual en flujos densos.
- **Body** (400, 0.875rem, 1.5): Párrafos, texto de explicación, descripción. Limitado a 65–75 caracteres de ancho cuando es prosa continua. En flujos de datos o UI denso, puede ser más ancho sin penalización.
- **Body Small** (400, 0.8rem, 1.5): Ayuda contextual, atributos de metadatos, notas. Aún legible (4.5:1 contraste mínimo).
- **Label** (500, 0.72rem, tracking 0.04em): Etiquetas de campo, badges, pequeños indicadores de estado. Mayúscula por defecto. Usado para "DOCUMENTO" / "PASO 1" / "DESCARGADO".

### Named Rules

**La Regla de la Escala Fija.** No se usa clamp() o tamaños fluidos para tipografía. El usuario ve el texto con DPI consistente; un h1 fluido en una barra lateral se ve mal, no mejor. Todos los tamaños son rem fijos.

**La Regla del Ancho de Línea.** La prosa continua nunca supera 75 caracteres. El cuerpo denso de UI (listas, tablas) puede exceder esto sin penalización; solo la prosa narrativa obedece el límite.

## 4. Elevation

El sistema usa elevación **plana por defecto con sombras sutiles activadas por estado**. No hay capas de "profundidad estructural" visibles en reposo. Cuando un usuario interactúa (hover, focus, active) o un elemento requiere distinción clara (una tarjeta de contenido), se aplica una sombra ambiental suave.

Las sombras nunca son oscuras ni fuerte; están diseñadas para ser "sentidas" como una separación visual, no "vistas" como un objeto dramático.

### Shadow Vocabulary
- **Shadow XS** (`0 1px 3px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04)`): Borde suave + sombra apenas perceptible. Usado en elementos en reposo que necesitan definición limpia (inputs, pequeñas tarjetas, panels). La doble capa (sombra + borde 1px) mantiene definición sin peso.
- **Shadow SM** (`0 2px 8px rgba(0,0,0,.10), 0 12px 32px rgba(0,0,0,.07)`): Sombra de hover, tarjetas primarias, paneles en foco. El desenfoque (8px + 12px) mantiene suavidad; la opacidad (10% / 7%) previene dureza.
- **Shadow MD** (`0 8px 28px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.08)`): Modales, overlays, contenido flotante (tooltips, dropdowns elevados). Más definición para separar del fondo; aún ambiental, nunca duro.

### Named Rules

**La Regla del Reposo Plano.** Las superficies en reposo NO tienen sombra ambiental a menos que requieran separación clara del fondo. Entrada de texto, botón secundario, tarjeta neutral = sin sombra. Cambios de estado (hover, foco) activan shadow-sm; la sombra refuerza el cambio.

**La Regla de la Sombra Ambiental.** Las sombras nunca son negras puras. Siempre son `rgba(0,0,0, 0.08–0.14)` con desenfoque moderado. Esto crea separación sin dramatismo. Modales y flotantes pueden usar shadow-md; todo lo demás es xs o sm.

## 5. Components

ConvertidoreXe es un editor de estructura de documento y configurador de tema. Sus componentes son herramientas: botones con peso, inputs con claridad, tarjetas que organizan contenido jerárquico, navegación que comunica posición.

### Buttons

**Carácter:** Preciso, sin ambigüedad. Los botones no son juguetes; son acciones.

- **Primary Button (Primario CTA):** Azul corporativo (#1B6EC2), blanco de texto, padding 0.575rem 1.375rem, radio 6px, sin borde. Hover → azul más oscuro (#155FAF) + shadow-sm + elevación visual suave (sin translateY; solo sombra). Disabled → gris terciario (#8E8E93), sin sombra, cursor no-permitido, 70% opacidad.
- **Secondary Button (Acción alternativa):** Blanco fondo + texto gris secundario (#4A4A50), borde 1px (#D2D2D7), mismo padding y radio. Hover → fondo gris suave (#EDF1F7) + texto gris primario. Active → azul claro fondo (#EBF3FF) + borde azul (#BDD8FF). Nunca reemplaza primario en UI; usado para "Cancelar", "Atrás", "Más opciones".
- **Ghost Button (Mínimo):** Sin fondo, azul texto (#1B6EC2), sin borde (o borde invisible). Hover → fondo gris suave (#EDF1F7) + sombra xs. Usado en acciones contextuales: "Expandir todo", "Ayuda", "Ver documentación".
- **Destructive Button (Eliminar):** Rojo (#D92B2B) texto sobre fondo claro de error (#FFF0F0), borde 1px rojo suave. Requiere confirmación; nunca es un clic único.

### Inputs & Form Controls

- **Text Input / Select / Textarea:** Fondo blanco (#FFFFFF), borde 1px (#D2D2D7), radio 6px, padding 0.55rem 0.75rem, font-size 0.875rem. Text color primario (#1D1D1F), placeholder terciario (#8E8E93) a 4.5:1 contraste (no gris pálido). Focus → borde azul (#1B6EC2) + shadow-xs (no glow violento). Error → borde rojo (#D92B2B), fondo claro de error (#FFF0F0). Disabled → fondo gris claro (#EDF1F7), texto terciario, sin interacción.
- **Toggle / Switch:** Ancho 40px, alto 22px, fondo #D1D5DB en reposo, azul (#1B6EC2) cuando activo. Thumb blanco, suave transición 0.2s. Nunca rotatoria ni icónica; forma clara de rectángulo con pulgar deslizable.
- **Checkbox / Radio (nativo):** Usar controles nativos del navegador con `accent-color: {colors.primary-blue}`. Mantener pequeño; enfoque con outline azul 2px.

### Cards & Containers

- **Default Card:** Fondo blanco (#FFFFFF), borde 1px (#E8E8ED), radio 10px, padding 1.125rem. Cuando contiene secciones anidadas, el borde se reduce a separadores internos (1px #E8E8ED). En hover o selección → borde azul claro (#BDD8FF) + shadow-sm. Nunca cards anidadas; estructura plana o jerarquía por indentación.
- **Section Header Card (Encabezado de subsección):** Fondo gris suave (#EDF1F7), padding 0.7rem 1rem, texto primario 600 peso. Usa para "PASO 1" / "CONFIGURACIÓN" / "DESCARGAS". Sin sombra en reposo; borde inferior suave si es necesario separar del contenido debajo.
- **Background Panel:** Fondo gris claro (#EDF1F7), sin borde explícito. Usado para contener varias tarjetas o grupos de entrada. Transmite "zona de configuración" sin estar visualmente pesado.

### Navigation & Step Indicators

- **Top Header:** Blanco fondo (#FFFFFF), borde inferior 1px (#E8E8ED), altura 60px, sticky (position: sticky; top: 0; z-index: 100). Logo + divider vertical + nombre de marca a la izquierda. Botones de acción (Ayuda, Administración) a la derecha. Sin sombra; solo borde define separación del contenido debajo.
- **Step Bar (Indicador de progreso):** Blanco fondo, borde inferior 1px (#E8E8ED). Circles 28px con números. Completado → azul claro fondo (#EBF3FF) + borde azul (#BDD8FF) + checkmark azul. Activo → 32px circle, azul fondo (#1B6EC2), blanco texto, shadow-sm (glow visual). Conector entre pasos → línea 1px gris (#D2D2D7) en reposo, azul cuando paso completado. Transición suave 0.2s.
- **Sidebar Navigation (Árboles de estructura):** Panel adhesivo a la derecha (en escritorio). Fondo blanco (#FFFFFF), borde izquierdo 1px (#E8E8ED). Tipografía label. Nodos clicables con hover sutil (fondo azul claro #EBF3FF). Usado para "Vista de contenido" / árbol de estructura jerárquica.

### Specialized: Structure Configurator

**H1 Cards (Secciones principales):**
- Encabezado gris (#EDF1F7), padding 0.7rem 1rem. Contenedor blanco cuando se expande. Chevron SVG gira 180° cuando se abre. Selector de nivel (H1/H2) como píldoras radio: blanco fondo, gris borde, azul cuando seleccionado.

**H2 List (Subsecciones):**
- Animación de cuadrícula (grid 0fr→1fr en 0.28s) para expandir/contraer. Elementos H2 con nombre + bloques de opciones. Cada opción H2 como píldora radio: blanco fondo, borde gris, azul cuando seleccionado. Sin transiciones complejas; suavidad solo en altura del contenedor.

**Theme Selector:**
- Cada tema como opción radio dentro de una tarjeta. Miniatura a la izquierda (220px ancho, opacidad 50% en reposo, 100% en hover/checked). Contenido a la derecha: nombre, metadatos, descripción. Borde azul claro cuando seleccionado. Shadow-sm en hover.

### Status & Feedback

- **Alert / Banner:** Fondo de color (éxito = #E3F9EB, error = #FFF0F0, info = #EBF3FF), texto de color (éxito = #1a6b35, error = #D92B2B, info = #1054A0), borde 1px (matching color, sutilizado). Padding 0.875rem 1rem, radio 6px. Sin icono obligatorio; cuando presente, 16px SVG. Cierre opcional (×) en gris, hover azul.
- **Loading Spinner:** SVG 18px, borde 2px (#D2D2D7) con borde superior azul (#1B6EC2), animación spin 0.7s linear infinite. Nunca en el centro del contenido; siempre junto a etiqueta ("Procesando...").
- **Success Animation (Descarga completada):** Circle pop entrada (0.35s cubic-bezier(0.34, 1.56, 0.64, 1)), checkmark dibuja con stroke-dasharray (0.45s ease-out). Verde fondo (#E3F9EB), checkmark verde (#34C759).

## 6. Do's and Don'ts

### Do:
- **Do** usar Inter en toda la interfaz, sin excepciones. Mantén pesos 400 (body), 500 (labels), 600 (títulos), 700 (énfasis).
- **Do** mantener el azul primario (#1B6EC2) a menos del 10% de cualquier pantalla. Todos los demás puntos de color usan neutros, claros, o feedback.
- **Do** aplicar sombras XS en reposo para inputs/tarjetas pequeñas; shadow-SM en hover/focus; shadow-MD solo en modales/flotantes.
- **Do** escribir etiquetas de entrada y de campo en mayúscula pequeña (0.72rem, weight 500, tracking 0.04em). Esto crea claridad visual sin grito.
- **Do** mantener el contraste texto/fondo a mínimo 4.5:1 (WCAG AA). Verificar gris terciario (#8E8E93) sobre fondo blanco regularmente.
- **Do** usar chevrones SVG para expandir/contraer en lugar de caracteres ASCII (▲ / ▼). Son más precisos y animables.
- **Do** respetar `prefers-reduced-motion`: reemplazar todas las animaciones con crossfades instantáneas o eliminación.
- **Do** mantener focus rings azules (2px, offset 2px) visibles en navegación por teclado. No esconder nunca.

### Don't:
- **Don't** usar animaciones complejas o coreografiadas (ver PRODUCT.md anti-referencia: "Heavy or complex animations"). Motion es solo para cambio de estado: entrada, validación, loading, confirmación. Nunca para delight.
- **Don't** crear cards anidadas. Jerarquía por indentación, borde sutil, o fondo, nunca por profundidad visual repetida.
- **Don't** saturar el azul corporativo. Si necesitas más marca visible, usa azul claro (#EBF3FF) o borde azul (#BDD8FF), no más #1B6EC2.
- **Don't** inventar affordances. Los botones se ven como botones. Los inputs tienen borde y padding. Los toggles no rotan ni son icónicos.
- **Don't** usar gráficos de degradado, glassmorphism, o bordes laterales gruesos (> 1px) como decoración. Rechazado en PRODUCT.md como "overly playful".
- **Don't** etiquetar cada sección con un número pequeño ("01 PASO", "02 OPCIÓN"). Aparece solo en flujosreales donde el orden importa e informa (no como reflex ornamental).
- **Don't** oscurecer o confundir dónde van los datos. Si un documento se procesa localmente, décirlo. Si hay validación, mostrar el error exacto. Nunca ambigüedad.
- **Don't** usar display fonts, script, o monoespacial decorativo. Inter es la familia; punto.
- **Don't** rellenar con placeholder de relleno. Si un estado vacío ocurre, diseñarlo: "No hay temas cargados aún" es mejor que una tarjeta vacía.
