# Dashboard Web — Gestión de Temas Oficiales

**Proyecto:** BUA ConvertidoreXe  
**Versión:** 1.0 (Planificación)  
**Fecha de creación:** 1 de junio de 2026  
**Estado:** Documentado, no implementado aún  
**Prioridad:** Media (mejora QoL para administrador)

---

## Problema que resuelve

Actualmente, la gestión de temas oficiales requiere:
- ✗ Acceso a terminal/CLI
- ✗ Tener el repositorio clonado localmente
- ✗ Recordar múltiples comandos y rutas
- ✗ Ejecutar pasos manuales (compresión → npm → git)
- ✗ Manejo de dependencias (Node.js, npm, etc.)
- ✗ Rutas diferentes según ordenador/usuario

**Solución:** Un dashboard web accesible desde cualquier navegador, sin dependencias locales.

---

## Objetivos

1. **Simplificar la gestión de temas** — Una interfaz visual intuitiva con un menú en lugar de comandos
2. **Independencia de entorno** — Funciona desde cualquier ordenador, sin CLI ni repositorio local
3. **Acceso controlado** — Autenticación segura (GitHub token)
4. **Operaciones automáticas** — Comprimir, publicar, sincronizar en un clic
5. **Feedback visual** — Logs en tiempo real, estados, errores claros

---

## Arquitectura

### Ubicación
```
public/admin/
├── index.html          (interfaz web)
├── app.js              (lógica del dashboard)
├── styles.css          (estilos)
└── api-github.js       (llamadas a GitHub API)
```

**URL:** `https://marioflorido.github.io/BUA-convertidor-exe/admin/`

### Tecnología
- **Frontend:** HTML5 + JavaScript vanilla (sin frameworks)
- **API:** GitHub REST API v3
- **Autenticación:** GitHub Personal Access Token (Opción 1)
- **Storage:** localStorage (para guardar token y preferencias)

---

## Autenticación — Opción 1: GitHub Personal Access Token

### Flujo

**1. Usuario genera token en GitHub**
```
https://github.com/settings/tokens/new
```

**Permisos requeridos:**
- `repo` — Acceso completo al repositorio
- `workflow` (opcional) — Para disparar Actions si se usa en el futuro

**Duración:** Sin expiración (o anual, a decisión del usuario)

**2. Usuario lo pega en el dashboard**
```
[Pegar tu GitHub Token aquí] [Validar] 
```

**3. El token se almacena en localStorage**
```javascript
localStorage.setItem('github_token', token);
```

**⚠️ Seguridad:**
- El token se almacena en el navegador (mismo riesgo que cualquier sitio web)
- Si el navegador es comprometido, el token es vulnerable
- **Mitigación:** Token con permisos limitados, no sensible a nivel de producción
- **Alternativa futura:** Implementar OAuth 2.0 o backend server (ver FASE-4)

---

## Funcionalidades

### 1. **Publicar un tema nuevo**

**Entrada:**
- Archivo ZIP del tema (drag & drop o file picker)
- Metadatos opcionales:
  - Activity (ej: "Doctorado")
  - Description (ej: "Estilo para Doctorado 26-27")

**Proceso:**
1. Valida que el ZIP contiene `config.xml` y `style.css`
2. Llama a la API de GitHub para:
   - Obtener el contenido actual de `public/themes-config.json`
   - Decodifica el JSON
   - Añade/actualiza la entrada del tema
   - Sube el archivo modificado (con commit automático)
3. Sube los archivos del tema a `public/themes/<id>/` (uno a uno vía API)
4. Hace commit y push

**Output:**
```
✓ Tema cargado
✓ Entrada añadida a themes-config.json
✓ Commit: feat(themes): publicar Doctorado_26-27
✓ Push realizado — visible en 1-2 minutos
```

### 2. **Actualizar un tema existente**

**Entrada:**
- Seleccionar tema de la lista
- Archivo ZIP con la versión nueva

**Proceso:**
1. Elimina la carpeta anterior (`public/themes/<id>/`)
2. Sube la nueva versión
3. Actualiza entrada en `themes-config.json` (conserva metadatos)
4. Commit y push

### 3. **Eliminar un tema**

**Entrada:**
- Seleccionar tema de la lista
- Confirmar eliminación (botón rojo con doble click)

**Proceso:**
1. Elimina `public/themes/<id>/`
2. Elimina entrada de `themes-config.json`
3. Commit y push

**Output:**
```
✓ Tema eliminado
✓ Commit: feat(themes): retirar PhD_26-27
✓ Sincronizado — desaparece en 1-2 minutos
```

### 4. **Ver temas publicados**

**Entrada:** Nada (se carga automáticamente)

**Output:**
- Tabla con todos los temas
- Columnas: ID | Nombre | Idioma | Activity | Acciones (editar, eliminar)
- Miniatura screenshot (si existe)
- Fecha de última modificación

### 5. **Validar ZIP de tema**

**Entrada:** Archivo ZIP

**Proceso:**
1. Descomprime en memoria
2. Verifica:
   - ✓ Contiene `config.xml`
   - ✓ Contiene `style.css`
   - ✓ No contiene `__MACOSX/`, `.DS_Store`, `._*`
   - ✓ Tamaño < 50 MB
3. Lee `config.xml` para detectar idioma

**Output:**
```
✓ ZIP válido
  - Idioma: es (español)
  - Tamaño: 3.5 MB
  - Archivos: 127
```

---

## Interfaz (mockup textual)

```
┌──────────────────────────────────────────────────────────────┐
│  BUA ConvertidoreXe — Admin de Temas                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Autenticación:                                              │
│  [Token:] ••••••••••••••••  [Validar] [Cerrar sesión]       │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ACCIONES                                                    │
│                                                              │
│  ┌─ Publicar tema ──────────────────────────────────────┐  │
│  │ [Seleccionar archivo ZIP] o arrastra aquí             │  │
│  │                                                        │  │
│  │ Activity (opcional): [input]                          │  │
│  │ Description (opcional): [textarea]                    │  │
│  │                                                        │  │
│  │                                        [Publicar]     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  TEMAS PUBLICADOS                                            │
│                                                              │
│  ID                  Nombre            Idioma  Acciones     │
│  ─────────────────────────────────────────────────────────  │
│  base                Base eXeLearning   es     [editar]     │
│  Doctorado_26-27     Doctorado 26-27    es     [editar]     │
│  PhD_26-27           PhD 26-27          en     [editar]     │
│  Ciencia_abierta...  Ciencia abierta    es     [editar]     │
│                                                  [eliminar]  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementación técnica

### Llamadas a GitHub API necesarias

**1. Autenticar**
```bash
GET https://api.github.com/user
Headers: Authorization: token <TOKEN>
```

**2. Leer archivo**
```bash
GET https://api.github.com/repos/MarioFlorido/BUA-convertidor-exe/contents/public/themes-config.json
Headers: Authorization: token <TOKEN>
Response: { content: "base64-encoded-json" }
```

**3. Actualizar archivo**
```bash
PUT https://api.github.com/repos/MarioFlorido/BUA-convertidor-exe/contents/public/themes-config.json
Headers: Authorization: token <TOKEN>
Body: {
  message: "feat(themes): publicar ...",
  content: "base64-encoded-new-json",
  sha: "<sha-del-commit-anterior>"
}
```

**4. Subir archivos de tema**
```bash
PUT https://api.github.com/repos/.../contents/public/themes/Doctorado_26-27/config.xml
PUT https://api.github.com/repos/.../contents/public/themes/Doctorado_26-27/style.css
PUT https://api.github.com/repos/.../contents/public/themes/Doctorado_26-27/img/...
# (uno a uno, con base64)
```

**5. Eliminar**
```bash
DELETE https://api.github.com/repos/.../contents/public/themes/Doctorado_26-27/
```

### Librerías JavaScript recomendadas
- `jszip` — Para descomprimir ZIPs en el navegador
- `base64-js` — Para codificar/decodificar base64
- Vanilla JS para el resto (sin frameworks innecesarios)

---

## Flujo de usuario típico

**Escenario:** Publicar un tema actualizado desde casa

1. Abre `https://marioflorido.github.io/BUA-convertidor-exe/admin/`
2. Pega su GitHub Token (guardado en localStorage, no necesita repetir)
3. Ve la lista de temas publicados
4. Arrastra el ZIP nuevo de su Doctorado_26-27 actualizado
5. Ingresa metadatos (opcionales)
6. Hace clic en "Publicar"
7. Ve un log en tiempo real:
   ```
   → Validando ZIP...
   ✓ ZIP válido
   → Subiendo archivos a GitHub...
   ✓ config.xml
   ✓ style.css
   ✓ img/...
   → Actualizando themes-config.json...
   ✓ Commit realizado
   → Push...
   ✓ ¡Tema publicado! Visible en 1-2 minutos
   ```
8. Cierra el dashboard

**Tiempo total:** ~3-5 minutos (vs 10+ minutos con CLI actual)

---

## Fases de implementación

### Fase 1: MVP (core functionality)
- ✓ Autenticación con token
- ✓ Publicar tema nuevo
- ✓ Ver temas publicados
- ✓ Validar ZIP
- Estimación: 4-5 horas

### Fase 2: Completar
- ✓ Actualizar tema
- ✓ Eliminar tema
- ✓ Descargar tema (para editar)
- ✓ Metadatos detallados
- Estimación: 2-3 horas

### Fase 3: Pulir
- ✓ Dark mode
- ✓ Historial de cambios
- ✓ Búsqueda/filtros
- ✓ Exportar/importar configuración
- Estimación: 1-2 horas

### Fase 4: Seguridad (futuro)
- OAuth 2.0 en lugar de token manual
- Backend server (Node.js) para manejar credenciales
- Rate limiting
- Logs de auditoría

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|--------|-----------|
| Token comprometido | Media | Alto | Token con permisos limitados; instrucciones claras sobre seguridad |
| ZIP corrupto sube | Baja | Medio | Validación exhaustiva antes de subir |
| Rate limit de GitHub | Baja | Medio | Guardar SHAs en caché; respetar delays entre requests |
| Interfaz poco intuitiva | Media | Bajo | User testing; documentación integrada |

---

## Testing

Una vez implementado, probar:
- ✓ Publicar tema nuevo sin metadatos
- ✓ Publicar tema con metadatos
- ✓ Actualizar tema existente
- ✓ Eliminar tema
- ✓ Rechazar ZIP inválido (falta config.xml)
- ✓ Rechazar ZIP con basura (macOS)
- ✓ Validar token expirado o inválido
- ✓ Interfaz en diferentes navegadores/tamaños

---

## Documentación para usuario final

Una vez implementado, crear:
1. `public/admin/HELP.md` — Cómo usar el dashboard
2. Actualizar `/docs/gestion-temas-oficiales.md` — Referenciar el dashboard
3. Agregar enlace en la app principal: "Admin → Gestionar temas"

---

## Repositorio de referencia

- **GitHub API docs:** https://docs.github.com/en/rest/repos/contents
- **jszip:** https://stuk.github.io/jszip/
- **Similar proyectos:** GitHub's Octokit.js

---

## Decisión

**Implementar:** Sí, después de estabilizar FASE-3 y FASE-4  
**Prioridad:** Media — Mejora calidad de vida, no es crítico  
**Owner:** Mario Florido  
**Siguiente paso:** Empezar Fase 1 cuando sea conveniente  

---

**Última actualización:** 1 de junio de 2026  
**Revisado por:** Claude (asistente)
