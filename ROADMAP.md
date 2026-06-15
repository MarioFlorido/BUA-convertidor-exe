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

> Última actualización: **15 jun 2026**

---

## 1. Mejoras de interfaz (UX / UI)

### Diseñadas, pendientes de implementar

- [ ] 🟡 **Tour de bienvenida (coach marks).** Recorrido guiado la primera vez
  que se abre la app: resalta cada zona (subir documento, configurar estructura,
  elegir tema, descargar) con globos explicativos. Se puede reabrir desde el
  icono de ayuda de la cabecera.

- [ ] 🟡 **Modo demostración / tutorial auto-reproducible.** Botón
  «▶ Ver demostración» que carga un documento de ejemplo incluido en la app y
  avanza solo por los 4 pasos, con rótulos explicando cada uno. Da sensación de
  vídeo pero corre sobre la **interfaz real**, así que no se queda desfasado.
  Reutiliza la misma infraestructura que el tour (es el tour + autoplay + un
  `.docx` de muestra empaquetado). _Recomendado frente al vídeo grabado mientras
  la interfaz siga cambiando._

- [ ] ⚪ **Árbol de contenido en el paso 4 (Resultado).** Mostrar el árbol ya
  generado, en modo resumen de solo lectura, encima de los botones de descarga
  («esto es lo que has creado»). El componente `ContentTreeView` ya existe; sería
  darle un segundo uso.

- [ ] ⚪ **Recordar preferencias de conversión** (`localStorage`). Si se
  convierten documentos parecidos a menudo, recordar las últimas elecciones
  (tipo de H2 por defecto, tema, índice plegado/desplegado) ahorra clics.

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

### Errores no prioritarios / depuración

- _(Sin elementos concretos ahora mismo.)_ Apuntar aquí los fallos menores que
  decidamos aplazar, incluyendo **cómo reproducirlos** para no perder el contexto.

---

## 3. Pendientes de precisar

Ideas mencionadas en sesiones anteriores cuyo contexto exacto se ha perdido.
Antes de retomarlas hay que reconstruir qué eran (revisar transcripciones de
sesiones previas o notas sueltas).

- [ ] **«Fase 4» no prioritaria.** Al analizar el proyecto en su día se saltó una
  fase (¿la 4?) por no ser prioritaria, dejándola para valorar a futuro. Pendiente
  de localizar a qué se refería.

- [ ] **Prevención de un posible bug futuro.** Quedó anotada una intervención para
  evitar un bug que aún no se ha producido. Pendiente de recuperar el detalle.

- [ ] **Posible duplicidad a evitar.** Se habló de eliminar una duplicidad de
  «algo» (sin concretar). Pendiente de identificar.

---

## 4. Cerrado recientemente

Para no volver a proponer lo ya hecho. Detalle técnico en `CHANGELOG.md`.

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
