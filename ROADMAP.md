# Hoja de ruta y pendientes — ConvertidoreXe

Lugar **único y duradero** para todo lo que está por hacer: ideas, mejoras
aplazadas, fases sin depurar y notas sueltas. Vive en el repositorio a propósito,
para que **no se pierda al cambiar de sesión o de ordenador**.

- **`CHANGELOG.md`** = lo que ya está hecho.
- **`ROADMAP.md`** (este archivo) = lo que queda por hacer o por decidir.

**Cómo mantenerlo:** marca `- [x]` cuando algo se complete y muévelo al
`CHANGELOG.md` con el detalle técnico. Añade ideas nuevas en la sección que
corresponda, con una o dos líneas de contexto para que se entiendan en frío
(sin depender de la conversación donde surgieron). Prioridad orientativa:
🔴 alta · 🟡 media · ⚪ baja / cuando apetezca.

> Última actualización: **26 jun 2026**

---

## 1. Mejoras de interfaz (UX / UI)

### Diseñadas, pendientes de implementar

- [ ] 🟡 **Modo demostración / tutorial auto-reproducible.** Botón
  «▶ Ver demostración» que carga un documento de ejemplo incluido en la app y
  avanza solo por los 4 pasos, con rótulos explicando cada uno. Da sensación de
  vídeo pero corre sobre la **interfaz real**, así que no se queda desfasado.
  _Recomendado frente al vídeo grabado mientras la interfaz siga cambiando._

- [ ] ⚪ **Árbol de contenido en el paso 4 (Resultado).** Mostrar el árbol ya
  generado, en modo resumen de solo lectura, encima de los botones de descarga
  («esto es lo que has creado»). El componente `ContentTreeView` ya existe; sería
  darle un segundo uso.

- [ ] ⚪ **Recordar preferencias de conversión** (`localStorage`). Si se
  convierten documentos parecidos a menudo, recordar las últimas elecciones
  (tipo de H2 por defecto, tema, índice plegado/desplegado) ahorra clics.

- [ ] 🟡 **Modo mantenimiento activable desde el panel de admin.** Un toggle
  en `OfficialThemeAdmin` que escribe `public/maintenance.json`
  (`{ "enabled": true/false, "message": "..." }`) vía GitHub API. La app lee
  ese archivo al cargar y, si está activo, muestra una pantalla a pantalla
  completa («En mantenimiento — perdone las molestias») en lugar de la
  interfaz normal. Útil para actualizaciones masivas de temas sin que los
  usuarios encuentren la app a medias. Activar y desactivar en segundos,
  sin tocar código ni hacer un nuevo deploy.

### Ideas a valorar

- [ ] ⚪ **Editor visual de estructura (drag & drop).** En el paso 2, poder
  arrastrar para reordenar o cambiar el nivel de las secciones, en vez de solo
  los selectores de nivel actuales. Más ambicioso; valorar si compensa.

- [ ] ⚪ **Vídeo tutorial / screencast** como pieza de difusión (página de inicio,
  correo al profesorado), con narración en voz. Hacerlo **solo cuando la
  interfaz esté estable**; si no, se queda obsoleto enseguida. Complementa al
  modo demostración, no lo sustituye.

---

## 2. Mejoras internas (desarrollo)

### Rendimiento / build

- [ ] 🟡 **Reducir el tamaño del bundle.** El build avisa de _chunks_ mayores de
  500 KB (el principal ronda los 750 KB). Evaluar `build.rollupOptions.output.manualChunks`
  o `import()` dinámico para trocear (p. ej. aislar el motor de PDF/Paged.js, que
  ya va en su chunk, y revisar el resto). No urge: la app es offline y carga rápido.

### Calidad / mantenimiento

- [ ] ⚪ **Actualizar `docs/testing/REGRESSION_TESTING_PLAN.md`.** El plan describe
  fases de refactor con checkboxes sin marcar, pero gran parte ya está hecha
  (la infraestructura de regresión existe: fixtures DOCX, `validate-regression.ts`,
  baseline de checksums). Repasar y reflejar el estado real para que no confunda.

### Seguridad

- [ ] ⚪ **Endurecimiento XSS (condicional).** Quitar los atributos `on*`
  (`onerror`, `onclick`…) del HTML que se escribe en el ZIP exportado. Hoy **no hay
  vector**: la app no renderiza vivo el HTML del DOCX y los temas los publica el
  propio admin. Solo cobra sentido **si en el futuro se aceptan temas de terceros**
  (su `style.js` sí se ejecuta). Mientras tanto, baja prioridad.

### Errores no prioritarios / depuración

- _(Sin elementos concretos ahora mismo.)_ Apuntar aquí los fallos menores que
  decidamos aplazar, incluyendo **cómo reproducirlos** para no perder el contexto.

---

## 3. Pendientes de precisar

Ideas mencionadas en sesiones anteriores cuyo contexto exacto se ha perdido.
Antes de retomarlas hay que reconstruir qué eran (revisar transcripciones de
sesiones previas o notas sueltas).

- _(Ninguno ahora mismo.)_ Los tres ítems que había aquí se reconstruyeron
  (15 jun 2026): la «Fase 4» y la «prevención de bug» se aclararon y movieron a
  §2 (Reorganización de carpetas / Endurecimiento XSS); la «duplicidad» resultó
  estar ya hecha (Fase 3) y se movió a §4.

---

## 4. Cerrado recientemente

Para no volver a proponer lo ya hecho. Detalle técnico en `CHANGELOG.md`.

- [x] **Conversor de eXe antiguo (.elp → Word)** (jul 2026): utilidad del menú
  lateral que convierte paquetes del eXeLearning clásico 2.x en un Word editable
  (parser propio de `contentv3.xml` + librería `docx` MIT en chunk bajo demanda).
  Decidido frente a integrar eXeConvert (licencia sin formalizar, bundles pesados).
  Pendiente opcional: página de ayuda dedicada (`public/docs/conversor-elp.html`)
  al estilo de la del Limpiador, si el uso lo pide.
- [x] Árbol de contenido en vivo en el paso 2 (configurador de estructura).
- [x] Expandir / contraer todo, resaltado de errores en el árbol y
  clic-para-navegar de árbol a tarjeta.
- [x] Paquete de pulido visual: tipografía Inter, transiciones de pantalla,
  despliegue animado de tarjetas, iconos SVG coherentes, foco de teclado,
  `prefers-reduced-motion`.
- [x] Endurecimiento del publicador de temas: reintentos con backoff,
  respeto de `Retry-After` y subida serial de blobs (ya no se cruza el
  _secondary rate limit_ de GitHub).
- [x] Botones de descarga mejorados (iconos mayores, aviso de compatibilidad
  con Chrome/Edge).
- [x] **Consolidación de duplicados (Fase 3):** `ElpxRenderOptions`, alias
  `ImportedProject/Page/Block` y `DocumentStructure` unificados. (Era la «posible
  duplicidad a evitar» que estaba en «pendientes de precisar».)
- [x] **Ayuda contextual por pantalla** (`WelcomeTour.tsx`): globo modal
  explicativo (varios párrafos) en cada paso del asistente, controlado por un
  interruptor «Ayuda» en la cabecera — activado por defecto, preferencia
  persistida en `localStorage`. Mientras está activo, el globo reaparece cada
  vez que se entra en una pantalla; «Entendido» solo cierra esa visita. Se
  simplificó respecto a la idea original de «coach marks» ancladas a un
  elemento (este ítem, ya tachado): un modal centrado a pantalla completa deja
  sitio a textos explicativos más largos.
- [x] **Cuarta etiqueta semántica: `[pie]`** — pie polivalente (`[pie]…[fin]`)
  para ilustraciones, tablas y leyendas. En el PDF: texto pequeño, cursiva,
  gris y centrado, sin recuadro. En ELPX: estilizado por `.bua_pie` del tema.
  Validación: detecta pies sin cerrar igual que el resto de cajas semánticas.
- [x] **Agrupación de temas por familia (idioma)** en selector y
  administración (`themeGrouping.ts`): el mismo curso en castellano/valenciano/
  inglés se presenta como una sola fila con una variante por idioma. Requiere
  que el `<title>` de cada variante coincida exactamente fuera del paréntesis
  de idioma (`CURSO (CASTELLANO)` / `(VALENCIANO)` / `(INGLÉS)`); un desajuste
  (p. ej. un año escrito distinto) la deja fuera de la familia. **19 jun 2026:**
  esto pasó de verdad con el tema "Doctorado" (`2026-27` vs `26-27` en las
  otras dos variantes) — corregido a mano. Documentado en `CHANGELOG.md`,
  `README.md` y `gestionar-temas-oficiales.html`; el panel de admin avisa de
  la convención junto al campo «Nombre».
- [x] **Nombre pre-rellenado desde `<title>`** del `config.xml` al publicar un
  tema oficial (antes se escribía a mano y podía no coincidir con el XML).
- [x] **Reorganización de carpetas (Fase 4):** pipeline agrupado en
  `src/core/pipeline/` y assets en `public/img/` (21 jun 2026). Se había
  marcado como saltada a propósito por el riesgo de romper rutas en
  producción; se reevaluó y se hizo igualmente, verificada con tsc limpio,
  108/108 tests y build OK antes del merge. Detalle en `CHANGELOG.md`.
