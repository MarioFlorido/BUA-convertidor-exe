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

## 2. Estructura requerida en `public/`

Cada tema oficial con id `MiTema_27-28` necesita **tres ingredientes**:

```
public/
├── MiTema_27-28.zip                ← el ZIP completo (se descarga y descomprime en el navegador)
├── themes/
│   └── MiTema_27-28/
│       ├── screenshots.png          ← solo se sirve la miniatura desde aquí
│       └── …                        ← el resto de archivos se ignoran (se cargan desde el ZIP)
└── themes-config.json              ← contiene la entrada del tema
```

| Ubicación | Para qué se usa |
|---|---|
| `public/<id>.zip` | El navegador lo descarga, descomprime en memoria y aplica como tema |
| `public/themes/<id>/screenshots.png` | La aplicación construye la URL `${BASE_URL}themes/<id>/screenshots.png` para la miniatura del selector |
| Entrada en `public/themes-config.json` | "Índice" — la aplicación lee este JSON para saber qué temas existen |

Si falta cualquiera de los tres, algo no funcionará (ver §6 Errores típicos).

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
6. Copia el ZIP a `public/<id>.zip`
7. Descomprime el contenido en `public/themes/<id>/`
8. Añade o actualiza la entrada en `public/themes-config.json`
9. Imprime los comandos `git` que faltan (no commitea automáticamente)

El **id** del tema se deriva del nombre del archivo (sin la extensión).

### Después del script

```bash
git add public/<id>.zip public/themes/<id>/ public/themes-config.json
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

1. Borra `public/<id>.zip`
2. Borra recursivamente `public/themes/<id>/`
3. Quita la entrada del array `themes` en `public/themes-config.json`
4. Imprime los comandos `git`
5. 🔒 Protege el tema `base` — no se puede retirar (es el fallback del sistema)

### Después del script

```bash
git add -u public/
git commit -m "feat(themes): retirar <id>"
git push
```

---

## 5. Operaciones manuales (sin script)

Útil si quieres ajustar metadatos finos (descripción larga con saltos
de línea, campos extra, etc.) o hacer una corrección puntual.

### Publicar a mano

```bash
# 1. Copiar el ZIP
cp /ruta/MiTema_27-28.zip public/

# 2. Descomprimir (al menos screenshots.png debe quedar accesible)
unzip -o public/MiTema_27-28.zip -d public/themes/MiTema_27-28/

# 3. Editar public/themes-config.json y añadir la entrada al array "themes"
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
| `id` | ✅ | Debe coincidir EXACTAMENTE con el nombre del ZIP sin extensión |
| `name` | ✅ | Texto visible en el selector |
| `activity` | ❌ | Aparece como badge pequeño (`Doctorado`, `Grado`, …) |
| `language` | ❌ | `es`, `ca`, `en`. Si no se pone, se lee del `config.xml`; si tampoco, se asume `es` |
| `description` | ❌ | Texto largo opcional, visible en la ficha del tema |
| `screenshot` | ❌ | **Siempre `null`** en oficiales. La URL se construye automáticamente desde `public/themes/<id>/screenshots.png` |

### Retirar a mano

```bash
rm public/MiTema_27-28.zip
rm -rf public/themes/MiTema_27-28/
# Editar themes-config.json y quitar la entrada con id="MiTema_27-28"
```

### Actualizar un tema existente

El script `publish-theme` **sobreescribe** ZIP, carpeta descomprimida y
entrada del JSON. Si conservas el mismo id, basta con volver a ejecutarlo:

```bash
npm run publish-theme /ruta/al/MiTema_27-28.zip
```

Si cambias el nombre del archivo, **primero retira el viejo** y luego
publica el nuevo, o quedarán los dos en `public/`.

---

## 6. Errores típicos

| Síntoma | Causa | Solución |
|---|---|---|
| El tema no aparece en el selector | Falta entrada en `themes-config.json` | Añadirla, o ejecutar `publish-theme` |
| Error 404 en consola al cargar el tema | Hay entrada en el JSON pero no el ZIP en `public/` | Subir el ZIP, o quitar la entrada del JSON |
| El tema funciona pero sin miniatura | No existe `public/themes/<id>/screenshots.png` | Descomprimir el ZIP en `public/themes/<id>/` |
| La aplicación no carga ningún tema (todo cae al base) | JSON mal formado (coma de más, comillas mal) | Validar el JSON; `cat public/themes-config.json \| jq .` |
| Idioma sale como `[ES]` aunque sea otro | Falta `<language>…</language>` en el `config.xml` del ZIP | Añadirlo al config.xml dentro del ZIP y re-publicar |
| El tema viejo sigue apareciendo tras renombrar | Quedó el ZIP/carpeta antiguos | Borrar manualmente o `unpublish-theme <id-viejo>` |
| Tras `git push` los cambios no se ven en producción | Despliegue todavía en cola | Esperar 1-2 min; revisar pestaña Actions del repo |

---

## 7. Convenciones de nombrado

- Usa **guiones bajos** (`_`) en lugar de espacios: `Doctorado_27-28.zip` (✅), no `Doctorado 27-28.zip` (❌)
- Evita acentos y caracteres especiales en el nombre del archivo: pueden romper rutas URL
- El **id** del tema = nombre del ZIP sin `.zip`. Una vez publicado, **no lo cambies sin retirar antes el viejo**
- El **name** (en `themes-config.json`) es texto libre y puede tener espacios, acentos, etc.

---

## 8. Flujo recomendado

1. **Iteración**: prueba el tema cargándolo desde la UI (IndexedDB local). No afecta a nadie
2. **Cuando esté listo**: `npm run publish-theme <zip>`
3. **Revisar el diff**: `git status` + `git diff public/themes-config.json`
4. **Probar local**: `npm run dev` y verificar en `http://localhost:5173/`
5. **Commit y push** con los comandos que sugiere el script
6. **Esperar 1-2 min** para que GitHub Pages redespliegue
7. **Avisar a los compañeros**: recarga del navegador y ya lo ven

---

## 9. Estado del filtro de carga

Durante la fase de testeo hubo un periodo en el que
`BuiltInThemeProvider.loadAll()` filtraba la carga a solo el tema `base`.
Ese filtro **ya está retirado** (commit `8548c6d` y siguientes). Cualquier
tema añadido al repositorio y declarado en `themes-config.json` se carga
automáticamente para todos los usuarios.

Si en algún momento futuro hay que reintroducirlo (por ejemplo, para
auditar un nuevo conjunto de temas antes de exponerlos), basta con
añadir el filtro en `src/core/services/BuiltInThemeProvider.ts`:

```ts
configEntries
  .filter((entry) => entry.id === 'base')   // ← candado opcional
  .map((entry) => this.loadOne(entry)),
```

---

## 10. Archivos clave

| Archivo | Rol |
|---|---|
| `scripts/publish-theme.ts` | Script de publicación |
| `scripts/unpublish-theme.ts` | Script de retirada |
| `src/core/services/BuiltInThemeProvider.ts` | Carga oficiales desde `public/` |
| `src/core/services/UserThemeProvider.ts` | Carga locales desde IndexedDB |
| `src/core/services/ThemeRegistry.ts` | Registro unificado en memoria |
| `src/core/services/ThemeOrderService.ts` | Orden personalizado del usuario (localStorage) |
| `public/themes-config.json` | Índice de temas oficiales |
| `public/base.elpx` | Plantilla del tema base |
