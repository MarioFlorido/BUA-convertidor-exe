# Guía de contribución y gobernanza

Convenciones de trabajo para **BUA ConvertidoreXe**. El proyecto se desarrolla
desde varios equipos contra un único repositorio en GitHub, con despliegue
automático a producción (GitHub Pages) en cada push a `main`. Por eso conviene
disciplina mínima pero firme.

---

## Identidad de git (hazlo una vez por equipo)

Para que el historial quede limpio y consistente, configura en **cada máquina**:

```bash
git config --global user.name  "MarioFlorido"
git config --global user.email "68684595+MarioFlorido@users.noreply.github.com"
```

(El `.mailmap` ya unifica los commits antiguos firmados con correos de máquina.)

---

## Ramas

`main` es la rama de producción: **cada push despliega**. No se trabaja directamente
sobre ella para cambios no triviales.

**Nomenclatura** (prefijo + descripción en kebab-case):

| Prefijo | Para |
|---------|------|
| `feat/` | nueva funcionalidad |
| `fix/` | corrección de bug |
| `refactor/` | reestructuración sin cambio de comportamiento |
| `docs/` | documentación |
| `chore/` | mantenimiento, limpieza, tooling |
| `exp/` | experimentos/prototipos (efímeros, se borran) |

**Política:**
- Una rama por tarea, **efímera**: se borra al fusionar (`git branch -d`).
- Se fusiona a `main` con `--no-ff` (deja el grupo de commits trazable).
- **No** se fusiona nada que no pase la verja de verificación (ver abajo).
- `gh-pages` la gestiona **solo el CI** — nunca se edita a mano.
- `admin-themes-test` **se conserva**: es la rama-diana para ensayar el publicador
  de temas del panel de administración (no borrar).

---

## Verja de verificación (antes de fusionar a `main`)

Como `main` despliega a producción, todo cambio debe pasar **localmente**:

```bash
npx tsc --noEmit -p tsconfig.json   # tipos (strict)
npm test                            # tests (node:test vía tsx)
npm run build                       # build de producción (tsc + vite)
```

Para cambios que tocan el pipeline (DOCX → SemanticDocument → ELPX/PDF),
además: **smoke test manual** con `npm run dev` — subir un DOCX real y generar
un ELPX y un PDF.

---

## Commits

- Mensaje en imperativo con prefijo de tipo: `fix(pdf): …`, `refactor(fase-3): …`, `docs: …`.
- Commits atómicos: un cambio lógico por commit (facilita revertir en producción).

---

## Releases y versionado

- **SemVer** en `package.json` (`MAJOR.MINOR.PATCH`).
- Al cerrar una versión: actualizar `CHANGELOG.md`, bumpear la versión en
  `package.json`, `package-lock.json` y el footer de la app (`src/App.tsx`), y
  crear un tag `vX.Y.Z`.
- La versión vive sincronizada en esos 4 sitios.

---

## Tests

- Runner: `node:test` vía `tsx` (sin dependencias extra). Script: `npm test`.
- Los tests se ejecutan **también en CI** (`.github/workflows/deploy.yml`) antes
  de construir: un test rojo bloquea el despliegue.
- Al tocar una pieza frágil (transformaciones HTML, validación de marcadores,
  estructura), añade o actualiza su test.

---

## Documentación

- **Docs de usuario:** `public/docs/*.html` (los ve la app, son la fuente de
  verdad; se editan a mano). **No** hay generador desde Markdown.
- **Docs de desarrollo:** este archivo y `docs/`.
- `README.md` (raíz) es la portada del repositorio en GitHub.
