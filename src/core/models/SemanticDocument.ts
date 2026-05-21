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
 */
export interface ImportedBlock {
  /** Título del bloque (puede estar vacío para bloques sin título) */
  title: string;

  /** Contenido HTML del bloque (siempre debe contener al menos <p></p>) */
  html: string;
}

/**
 * Una página en el documento
 * Puede ser página principal (nivel 1), subpágina (nivel 2), o sub-subpágina (nivel 3)
 */
export interface ImportedPage {
  /** Título de la página */
  title: string;

  /** Nivel jerárquico: 1 (página), 2 (subpágina), 3 (sub-subpágina) */
  level: 1 | 2 | 3 | 4;

  /** Índice de la página padre (para subpáginas), null si es página raíz */
  parentIndex: number | null;

  /** Bloques de contenido dentro de esta página */
  blocks: ImportedBlock[];
}

/**
 * Proyecto completo - Documento procesado con estructura de páginas
 * Representa todo el contenido después de análisis y transformación
 */
export interface ImportedProject {
  /** Título del proyecto (usualmente nombre del documento) */
  title: string;

  /** Subtítulo opcional del proyecto */
  subtitle: string;

  /** Páginas que componen el proyecto */
  pages: ImportedPage[];
}

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
   * Valida que un ImportedBlock sea válido
   */
  isValidBlock(block: any): block is ImportedBlock {
    return (
      typeof block.title === 'string' &&
      typeof block.html === 'string' &&
      block.html.trim().length > 0
    );
  },

  /**
   * Valida que una ImportedPage sea válida
   */
  isValidPage(page: any): page is ImportedPage {
    return (
      typeof page.title === 'string' &&
      [1, 2, 3, 4].includes(page.level) &&
      (page.parentIndex === null || typeof page.parentIndex === 'number') &&
      Array.isArray(page.blocks) &&
      page.blocks.every((b: any) => this.isValidBlock(b))
    );
  },

  /**
   * Valida que un ImportedProject sea válido
   */
  isValidProject(project: any): project is ImportedProject {
    return (
      typeof project.title === 'string' &&
      typeof project.subtitle === 'string' &&
      Array.isArray(project.pages) &&
      project.pages.every((p: any) => this.isValidPage(p)) &&
      project.pages.length > 0
    );
  },

  /**
   * Cuenta total de bloques en un proyecto
   */
  countBlocks(project: ImportedProject): number {
    return project.pages.reduce((sum, page) => sum + page.blocks.length, 0);
  },

  /**
   * Obtiene la profundidad máxima de jerarquía
   */
  getMaxLevel(project: ImportedProject): number {
    if (project.pages.length === 0) return 0;
    return Math.max(...project.pages.map((p) => p.level));
  },
};
