# Phase 4: Extract SemanticBuilder

## Objetivo
Extraer la máquina de estados H1/H2/H3 de `buildFromStructure.ts` a una clase `SemanticBuilder` reutilizable.

## Análisis Actual

### Responsabilidades en `buildFromStructure.ts` (líneas 70-190)

```
buildProjectFromStructure()
├── Construir h1Indices map (lineas 66-72)
├── Para cada h1Section:
│   ├── Calcular parentIndex (lineas 78-89)
│   ├── Crear página (lineas 91-104)
│   ├── Extraer contentBeforeFirstH2 (linea 110)
│   ├── Crear bloque inicial si hay contenido (lineas 112-118)
│   ├── Para cada h2Item:
│   │   ├── Extraer h2Html (linea 126)
│   │   ├── Máquina de estados según h2Item.option:
│   │   │   ├── 'html': mantener H2 en HTML (lineas 128-144)
│   │   │   ├── 'idevice-title': crear iDevice (lineas 145-161)
│   │   │   └── 'accordion': acumular items (lineas 162-177)
│   └── Finalizar acordeón si queda pendiente (lineas 181-187)
└── Validar bloques (lineas 202-212)
```

## Estrategia de Extracción

### 1. Crear `SemanticBuilder` Class

**Archivo**: `src/core/builders/SemanticBuilder.ts`

```typescript
export class SemanticBuilder {
  private sections: DocumentSection[];
  private structure: any;
  private h1Indices: Map<string, number>;
  
  constructor(sections: DocumentSection[], structure: any) {
    this.sections = sections;
    this.structure = structure;
    this.h1Indices = this.buildH1Map();
  }
  
  // Public API
  buildPages(filename: string): ImportedPage[] { }
  
  // Internal
  private buildH1Map(): Map<string, number> { }
  private buildPageFromH1(h1Section: any, h1Index: number): ImportedPage { }
  private buildBlocks(h1Section: any, h1Index: number): ImportedBlock[] { }
  private calculateParentIndex(level: number, pages: ImportedPage[]): number | null { }
}
```

### 2. Métodos a Extraer

| Método | Responsabilidad | Líneas |
|--------|-----------------|--------|
| `buildH1Map()` | Crear Map<H1Text, H1Index> | 66-72 |
| `buildPages(filename)` | Orquestar construcción de todas las páginas | 74-200 |
| `buildPageFromH1(h1Section, h1Index)` | Construir una ImportedPage completa | 78-191 |
| `buildBlocks(h1Section, h1Index)` | Construir array de ImportedBlock | 112-188 |
| `calculateParentIndex(level, pages)` | Calcular índice de página padre | 78-89 |
| `handleH2Item(h2Item, h2Html, state)` | Máquina de estados para cada H2 | 123-177 |

### 3. Estado Compartido

El builder mantendrá estado temporal durante construcción de bloques:

```typescript
private interface BlockBuildState {
  currentBlock: ImportedBlock | null;
  accordionItems: Array<{ title: string; html: string }>;
  blocks: ImportedBlock[];
}
```

## Plan de Implementación

### Paso 1: Crear SemanticBuilder.ts (15 min)
- [ ] Crear clase con constructor
- [ ] Implementar buildPages()
- [ ] Implementar buildPageFromH1()
- [ ] Implementar buildBlocks() con estado

### Paso 2: Refactorizar buildFromStructure.ts (10 min)
- [ ] Importar SemanticBuilder
- [ ] Simplificar buildProjectFromStructure() a orquestador
- [ ] Llamar builder.buildPages()

### Paso 3: Validar Tipos (5 min)
- [ ] TypeScript compile sin errores
- [ ] No cambiar exports públicos

### Paso 4: Test en Navegador (10 min)
- [ ] Build exitoso
- [ ] Preview funciona
- [ ] Genera ELPX correctamente
- [ ] Contenido idéntico al baseline

## Notas Críticas

⚠️ **Estado Compartido**: El builder usa estado mutable (currentBlock, accordionItems) durante construcción. Debe ser thread-safe conceptualmente (aunque se ejecuta sincrónico).

⚠️ **Máquina de Estados**: La lógica de acordeón es frágil:
- Termina acordeón cuando: siguiente H2 no es 'accordion' O fin de lista
- Debe mantener exactamente este comportamiento

⚠️ **Índices**: Cambio crítico de pasar `h1Index` en lugar de `h1Text`. Ya está implementado en Phase 3.1 (bug fix).

## Regresión Testing

- ✅ SHA-256 del XML generado debe ser idéntico
- ✅ Usar baseline del test suite
- ✅ Validar con: `npm run test:regression`

## Rollback Plan

Si hay problemas:
1. `git revert` del commit
2. Volver a `buildFromStructure.ts` monolítico
3. Diagnosticar por QA con usuario

---

**Estimado**: 40-50 minutos
**Riesgo**: CRÍTICO (máquina de estados compleja)
**Beneficio**: Claridad arquitectónica, reutilización en Phase 5
