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
