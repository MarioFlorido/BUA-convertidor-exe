# Phase 6: Extract ThemeService

## Objetivo
Extraer la lógica de carga y gestión de temas de `docxToElpx.ts` a una clase `ThemeService` reutilizable.

## Análisis Actual

### Responsabilidades de Tema en docxToElpx.ts

```
docxToElpx.ts (479 líneas)
├── convertDocxToElpx()
│   └── loadThemeEntries(themeId) - líneas 439-459
│       └── fetch + unzip + prefixar con "theme/"
│
├── convertProjectToElpx()
│   └── Merge de extraEntries (themeEntries) con template
│
└── loadBaseTemplate() - líneas 424-437
    └── fetch base.elpx + unzip
```

### Lógica de Tema

1. **loadThemeEntries(themeId)** (líneas 439-459):
   - Fetch `${baseUrl}${themeId}.zip`
   - Unzip contenido
   - Prefixar con `theme/`
   - Filtrar `__MACOSX` y `.DS_Store`
   - Retornar Record<string, Uint8Array>

2. **loadBaseTemplate()** (líneas 424-437):
   - Fetch `${baseUrl}base.elpx`
   - Unzip contenido
   - Validar que contenga `content.xml`
   - Retornar { entries }

3. **Flujo de Tema**:
   - convertDocxToElpx() → condicionalmente carga tema
   - convertHtmlToElpx() → pasa themeEntries
   - convertProjectToElpx() → merge extraEntries con template

## Estrategia de Extracción

### 1. Crear `ThemeService` Class

**Archivo**: `src/core/services/ThemeService.ts`

```typescript
export interface TemplateData {
  entries: Record<string, Uint8Array>;
}

export class ThemeService {
  private static cache = new Map<string, Record<string, Uint8Array>>();
  
  // Public API
  static async loadTemplate(): Promise<TemplateData> { }
  static async loadTheme(themeId: string): Promise<Record<string, Uint8Array>> { }
  static async loadThemeIfNeeded(themeId?: string): Promise<Record<string, Uint8Array> | undefined> { }
  
  // Private helpers
  private static fetchAndUnzip(url: string): Promise<Record<string, Uint8Array>> { }
  private static filterThemeEntries(entries: Record<string, Uint8Array>): Record<string, Uint8Array> { }
}
```

### 2. Refactorizar docxToElpx.ts

**Responsabilidades que quedan**:
- Orquestación (convertDocxToElpx, convertHtmlToElpx, convertProjectToElpx)
- Construcción de proyecto (buildProjectFromHtml)
- Aplicar transformaciones (applyDivClasses, applyTableClasses)

**Cambios**:
- En `convertDocxToElpx()`:
  ```typescript
  let themeEntries: Record<string, Uint8Array> | undefined;
  if (options.themeId && options.themeId !== 'base') {
    onProgress?.({ phase: 'template', ... });
    themeEntries = await ThemeService.loadTheme(options.themeId);
  }
  ```

- En `convertProjectToElpx()`:
  ```typescript
  const template = await ThemeService.loadTemplate();
  ```

## Métodos a Extraer

| Método | Líneas | Destino |
|--------|--------|---------|
| `loadThemeEntries()` | 439-459 | ThemeService.loadTheme() |
| `loadBaseTemplate()` | 424-437 | ThemeService.loadTemplate() |

## Plan de Implementación

### Paso 1: Crear ThemeService.ts (20 min)
- [ ] Crear clase ThemeService con cache estático
- [ ] loadTemplate() - cargar base.elpx
- [ ] loadTheme() - cargar tema + prefixar
- [ ] loadThemeIfNeeded() - helper para conditionals
- [ ] fetchAndUnzip() - helper privado

### Paso 2: Refactorizar docxToElpx.ts (15 min)
- [ ] Importar ThemeService
- [ ] Actualizar convertDocxToElpx() para usar ThemeService.loadTheme()
- [ ] Actualizar convertProjectToElpx() para usar ThemeService.loadTemplate()
- [ ] Remover loadThemeEntries() y loadBaseTemplate()

### Paso 3: Validar (10 min)
- [ ] TypeScript compile sin errores
- [ ] Build exitoso
- [ ] No cambiar XML output

### Paso 4: Test en Navegador (10 min)
- [ ] Preview funciona
- [ ] ELPX generado correctamente
- [ ] Temas funcionan

## Notas Críticas

⚠️ **Theme Prefixing**: Los entries de tema deben prefixarse con `theme/` exactamente como antes.

⚠️ **Base Template**: Debe validarse que contenga `content.xml`.

⚠️ **Cache**: Usar static Map para evitar recargar temas múltiples veces en la misma sesión.

⚠️ **BASE_URL**: Debe mantenerse el mismo comportamiento con `import.meta.env.BASE_URL`.

## Cambios Visibles al Usuario

❌ NINGUNO - solo refactorización interna

## Rollback Plan

Si hay problemas:
1. `git revert` del commit
2. Volver a docxToElpx.ts con loadThemeEntries/loadBaseTemplate
3. Diagnosticar con usuario

---

**Estimado**: 55 minutos
**Riesgo**: BAJA (lógica simple, fácil de testear)
**Beneficio**: Reutilización, testabilidad, separación de responsabilidades

**Después de Phase 6:**
- Phase 7: Extract PreviewService
- Phase 8: Simplify Orchestrator
