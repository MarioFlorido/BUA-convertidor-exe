# Gestión de temas oficiales (públicos)

> Documento de administración. **No** se enlaza desde la interfaz.
> Para la guía del usuario final, ver `public/docs/guia-temas.html`.

Este documento describe cómo gestionar los temas que se publican en el
repositorio y, por tanto, son visibles para **todos los usuarios** que
abran la URL de GitHub Pages. Son lo que internamente llamamos temas
"oficiales" o "built-in" (en contraposición a los temas locales que cada
usuario sube desde la UI y viven en su IndexedDB).

---

## 1. Modelo mental

| Tipo de tema | Vive en | Visible para |
|---|---|---|
| **Oficiales** (incluido `base`) | El repositorio Git, en `public/` | Todos los usuarios |
| **Locales** | IndexedDB del navegador del usuario | Solo ese usuario, en ese navegador |

La aplicación es una SPA estática alojada en GitHub Pages. **No hay
backend**: la única forma de que un tema sea visible para todos es que
viva en el repositorio.

---

## 2. Estructura en `public/`

Cada tema oficial con id `MiTema_27-28` necesita **dos ingredientes** en el repo:

```
public/
├── themes/
│   └── MiTema_27-28/
│       ├── config.xml
│       ├── style.css
│       ├── screenshot.png     ← miniatura del selector
│       └── …
└── themes-config.json         ← contiene la entrada del tema
```

> **Nota:** `public/<id>.zip` **no va al repositorio**. Se genera
> automáticamente como artefacto de build (`predev` y `prebuild`)
> a partir de `public/themes/<id>/`. El servidor de desarrollo y el
> build de producción lo crean solos — no hay que gestionarlo a mano.

| Ubicación | Para qué se usa |
|---|---|
| `public/themes/<id>/` | Fuente de verdad: archivos del tema y miniatura |
| `public/themes/<id>/screenshot.png` | Miniatura visible en el selector de temas |
| `public/<id>.zip` | Generado en build; el navegador lo descarga y aplica como tema |
| Entrada en `public/themes-config.json` | "Índice" — la aplicación lee este JSON para saber qué temas existen |

---

## 3. Publicar un tema (vía script — recomendado)

### Comando

```bash
npm run publish-theme /ruta/al/MiTema_27-28.zip
```

Con metadatos opcionales:

```bash
npm run publish-theme /ruta/al/MiTema_27-28.zip \
  --activity "Doctorado" \
  --description "Curso 27-28 BUA"
```

### Qué hace el script

Definido en `scripts/publish-theme.ts`. Para cada ejecución:

1. Verifica que el archivo existe y termina en `.zip`
2. Descomprime el ZIP en memoria con `fflate`
3. Filtra archivos de sistema (`__MACOSX`, `._*`, `.DS_Store`)
4. Valida que contiene **al menos** `config.xml` y `style.css`
5. Lee `<language>es|ca|en</language>` del `config.xml`
6. Extrae el contenido en `public/themes/<id>/`
7. Genera `public/<id>.zip` desde esa carpeta (local, no va a git)
8. Añade o actualiza la entrada en `public/themes-config.json`
9. Imprime los comandos `git` que faltan (no commitea automáticamente)

El **id** del tema se deriva del nombre del archivo (sin la extensión).

### Después del script

```bash
git add public/themes/<id>/ public/themes-config.json
git commit -m "feat(themes): publicar <id>"
git push
```

GitHub Pages se redespliega en 1-2 minutos.

---

## 4. Retirar un tema (vía script — recomendado)

### Comando

```bash
npm run unpublish-theme <id>
```

⚠️ Se pasa el **id**, no una ruta. Ejemplo: `npm run unpublish-theme Doctorado_27-28`.

### Qué hace el script

Definido en `scripts/unpublish-theme.ts`:

1. Borra recursivamente `public/themes/<id>/`
2. Quita la entrada del array `themes` en `public/themes-config.json`
3. Imprime los comandos `git`
4. 🔒 Protege el tema `base` — no se puede retirar (es el fallback del sistema)

### Después del script

```bash
git add -u public/
git commit -m "feat(themes): retirar <id>"
git push
```

---

## 5. Operaciones manuales (sin script)

Útil si quieres ajustar metadatos finos o hacer una corrección puntual.

### Publicar a mano

```bash
# 1. Descomprimir el ZIP en public/themes/
unzip -o MiTema_27-28.zip -d public/themes/MiTema_27-28/

# 2. Editar public/themes-config.json y añadir la entrada al array "themes"
```

Estructura de la entrada en `themes-config.json`:

```json
{
  "id": "MiTema_27-28",
  "name": "Mi Tema 27-28",
  "activity": "Doctorado",
  "language": "es",
  "description": "Curso 27-28 BUA",
  "screenshot": null
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | ✅ | Debe coincidir EXACTAMENTE con el nombre del directorio en `public/themes/` |
| `name` | ✅ | Texto visible en el selector |
| `activity` | ❌ | Aparece como badge pequeño (`Doctorado`, `Grado`, …) |
| `language` | ❌ | `es`, `ca`, `en`. Si no se pone, se lee del `config.xml`; si tampoco, se asume `es` |
| `description` | ❌ | Texto largo opcional, visible en la ficha del tema |
| `screenshot` | ❌ | **Siempre `null`** en oficiales. La URL se construye desde `public/themes/<id>/screenshot.png` |

### Retirar a mano

```bash
rm -rf public/themes/MiTema_27-28/
# Editar themes-config.json y quitar la entrada con id="MiTema_27-28"
```

### Actualizar un tema existente

El script `publish-theme` **sobreescribe** la carpeta extraída y la entrada del JSON. Basta con volver a ejecutarlo con el mismo id:

```bash
npm run publish-theme /ruta/al/MiTema_27-28.zip
```

Si cambias el nombre del archivo, **primero retira el viejo** y luego publica el nuevo.

---

## 6. Errores típicos

| Síntoma | Causa | Solución |
|---|---|---|
| El tema no aparece en el selector | Falta entrada en `themes-config.json` | Añadirla, o ejecutar `publish-theme` |
| Error 404 en consola al cargar el tema | El ZIP no se generó (faltó ejecutar dev/build) | Ejecutar `npm run pack-themes` o `npm run dev` |
| El tema funciona pero sin miniatura | No existe `public/themes/<id>/screenshot.png` | Añadir el screenshot a la carpeta del tema |
| La aplicación no carga ningún tema (todo cae al base) | JSON mal formado | Validar: `cat public/themes-config.json \| jq .` |
| Idioma sale como `[ES]` aunque sea otro | Falta `<language>…</language>` en `config.xml` | Añadirlo y re-publicar |
| El tema viejo sigue apareciendo tras renombrar | Quedó la carpeta antigua | `npm run unpublish-theme <id-viejo>` |
| Tras `git push` los cambios no se ven en producción | Despliegue en cola | Esperar 1-2 min; revisar pestaña Actions del repo |

---

## 7. Convenciones de nombrado

- Usa **guiones bajos** (`_`) en lugar de espacios: `Doctorado_27-28` (✅), no `Doctorado 27-28` (❌)
- Evita acentos y caracteres especiales: pueden romper rutas URL
- El **id** = nombre del directorio en `public/themes/`. Una vez publicado, **no lo cambies sin retirar antes el viejo**
- El **name** (en `themes-config.json`) es texto libre y puede tener espacios, acentos, etc.

---

## 8. Flujo recomendado

1. **Iteración**: prueba el tema cargándolo desde la UI (IndexedDB local). No afecta a nadie
2. **Cuando esté listo**: `npm run publish-theme <zip>`
3. **Revisar el diff**: `git status` + `git diff public/themes-config.json`
4. **Probar local**: `npm run dev` y verificar en `http://localhost:5173/BUA-convertidor-exe/`
5. **Commit y push** con los comandos que sugiere el script
6. **Esperar 1-2 min** para que GitHub Pages redespliegue
7. **Avisar a los compañeros**: recarga del navegador y ya lo ven

---

## 9. Cómo se generan los ZIPs

Los ZIPs **no se guardan en git**. Se generan automáticamente en dos momentos:

- **`npm run dev`** → `predev` ejecuta `scripts/pack-themes.ts` antes de arrancar Vite
- **`npm run build`** → `prebuild` hace lo mismo antes de compilar

Si necesitas regenerarlos manualmente (por ejemplo, tras añadir un tema a mano):

```bash
npm run pack-themes
```

El script lee todos los directorios en `public/themes/`, crea un ZIP por cada uno y lo escribe en `public/<id>.zip`. Ese archivo es ignorado por git (`.gitignore`: `public/*.zip`).

---

## 10. Estado del filtro de carga

Durante la fase de testeo hubo un periodo en el que
`BuiltInThemeProvider.loadAll()` filtraba la carga a solo el tema `base`.
Ese filtro **ya está retirado** (commit `8548c6d` y siguientes). Cualquier
tema añadido al repositorio y declarado en `themes-config.json` se carga
automáticamente para todos los usuarios.

---

## 11. Archivos clave

| Archivo | Rol |
|---|---|
| `scripts/publish-theme.ts` | Script de publicación |
| `scripts/unpublish-theme.ts` | Script de retirada |
| `scripts/pack-themes.ts` | Genera ZIPs desde `public/themes/` (hook de build) |
| `src/core/services/BuiltInThemeProvider.ts` | Carga oficiales desde `public/` |
| `src/core/services/UserThemeProvider.ts` | Carga locales desde IndexedDB |
| `src/core/services/ThemeRegistry.ts` | Registro unificado en memoria |
| `src/core/services/ThemeOrderService.ts` | Orden personalizado del usuario (localStorage) |
| `public/themes-config.json` | Índice de temas oficiales |
| `public/base.elpx` | Plantilla del tema base |
