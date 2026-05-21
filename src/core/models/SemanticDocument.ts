/**
 * Modelo Semántico - Estructura de documento procesado
 *
 * Responsabilidad: Define la estructura de un documento después de ser
 * parseado y transformado. Representa el modelo intermedio entre HTML
 * y el formato final (ELPX, PDF, etc.)
 *
 * El modelo es agnóstico al formato final - puede ser usado para
 * generar ELPX, PDF, o cualquier otro formato.
 */

/**
 * Un bloque de contenido dentro de una página
 * Representa una sección con título opcional y contenido HTML
 *
 * Agnóstico al formato - usado por ELPX, PDF, SCORM, etc.
 */
export interface SemanticBlock {
  /** Título del bloque (puede estar vacío para bloques sin título) */
  title: string;

  /** Contenido HTML del bloque (siempre debe contener al menos <p></p>) */
  html: string;
}

/**
 * Una página en el documento
 * Puede ser página principal (nivel 1), subpágina (nivel 2), o sub-subpágina (nivel 3)
 *
 * Agnóstico al formato - usado por ELPX, PDF, SCORM, etc.
 */
export interface SemanticPage {
  /** Título de la página */
  title: string;

  /** Nivel jerárquico: 1 (página), 2 (subpágina), 3 (sub-subpágina) */
  level: 1 | 2 | 3 | 4;

  /** Índice de la página padre (para subpáginas), null si es página raíz */
  parentIndex: number | null;

  /** Bloques de contenido dentro de esta página */
  blocks: SemanticBlock[];
}

/**
 * Documento Semántico Completo
 *
 * Estructura intermedia agnóstica a formato entre HTML y formato de salida.
 * Puede convertirse a ELPX, PDF, SCORM, o cualquier otro formato.
 *
 * NÚCLEO ARQUITECTÓNICO: El modelo semántico es lo que importa.
 * Los renderizadores (ELPX, PDF, etc.) son implementaciones intercambiables.
 */
export interface SemanticDocument {
  /** Título del documento */
  title: string;

  /** Subtítulo opcional */
  subtitle: string;

  /** Páginas que componen el documento */
  pages: SemanticPage[];
}

/**
 * Alias hacia atrás - Para compatibilidad con código legacy
 * DEPRECADO: Usar SemanticDocument en lugar de ImportedProject
 * @deprecated Use SemanticDocument instead
 */
export type ImportedProject = SemanticDocument;
export type ImportedPage = SemanticPage;
export type ImportedBlock = SemanticBlock;

/**
 * Resultado del análisis de estructura de documento
 * Detecta jerarquía H1/H2/H3 y su configuración
 */
export interface DocumentStructure {
  h1Sections: Array<{
    title: string;
    level: 1 | 2 | 3;
    h2Items: Array<{
      text: string;
      option: 'html' | 'idevice-title' | 'accordion';
    }>;
  }>;
}

/**
 * Constantes para clasificación de contenido semántico
 */
export const BUA_CLASSES = {
  EJEMPLO: 'bua_ejemplo',
  DEFINICION: 'bua_definicion',
  IMPORTANTE: 'bua_importante',
  TABLA_HORIZONTAL: 'bua_tabla_horizontal',
  TABLA_VERTICAL: 'bua_tabla_vertical',
} as const;

/**
 * Validadores y utilidades para el modelo semántico
 */
export const SemanticDocumentValidation = {
  /**
   * Valida que un SemanticBlock sea válido
   */
  isValidBlock(block: any): block is SemanticBlock {
    return (
      typeof block.title === 'string' &&
      typeof block.html === 'string' &&
      block.html.trim().length > 0
    );
  },

  /**
   * Valida que una SemanticPage sea válida
   */
  isValidPage(page: any): page is SemanticPage {
    return (
      typeof page.title === 'string' &&
      [1, 2, 3, 4].includes(page.level) &&
      (page.parentIndex === null || typeof page.parentIndex === 'number') &&
      Array.isArray(page.blocks) &&
      page.blocks.every((b: any) => this.isValidBlock(b))
    );
  },

  /**
   * Valida que un SemanticDocument sea válido
   */
  isValidDocument(doc: any): doc is SemanticDocument {
    return (
      typeof doc.title === 'string' &&
      typeof doc.subtitle === 'string' &&
      Array.isArray(doc.pages) &&
      doc.pages.every((p: any) => this.isValidPage(p)) &&
      doc.pages.length > 0
    );
  },

  /**
   * Alias hacia atrás para compatibilidad
   * @deprecated Use isValidDocument instead
   */
  isValidProject(project: any): project is SemanticDocument {
    return this.isValidDocument(project);
  },

  /**
   * Cuenta total de bloques en un documento
   */
  countBlocks(doc: SemanticDocument): number {
    return doc.pages.reduce((sum, page) => sum + page.blocks.length, 0);
  },

  /**
   * Obtiene la profundidad máxima de jerarquía
   */
  getMaxLevel(doc: SemanticDocument): number {
    if (doc.pages.length === 0) return 0;
    return Math.max(...doc.pages.map((p) => p.level));
  },
};
