/// <reference types="vite/client" />

/**
 * Orquestador Principal - Convierte documentos DOCX a ELPX
 *
 * ARQUITECTURA REDISEÑADA (Fase 9+):
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  PIPELINE SEMÁNTICA → MÚLTIPLES RENDERIZADORES                   │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * El flujo es ahora agnóstico al formato:
 *
 * Capa 1: DOCX/HTML → SemanticDocument (agnóstico)
 *   └─ convertDocxToSemanticDocument()
 *   └─ convertHtmlToSemanticDocument()
 *
 * Capa 2: SemanticDocument → Formato específico (ELPX, PDF, etc.)
 *   └─ semanticDocumentToElpx()
 *   └─ semanticDocumentToPdf() (futuro)
 *   └─ semanticDocumentToScorm() (futuro)
 *
 * Capa 3: Orquestador principal (compatibilidad hacia atrás)
 *   └─ convertDocxToElpx() - usa Capa 1 + Capa 2
 *   └─ convertHtmlToElpx() - usa Capa 1 + Capa 2
 *   └─ convertProjectToElpx() - directo a Capa 2
 *
 * VENTAJAS:
 * - SemanticDocument es el núcleo, agnóstico a formatos
 * - Nuevos renderizadores se agregan sin tocar el core
 * - Testing: testea parsing y rendering por separado
 * - Reutilización: un documento → múltiples formatos
 */

import { convertDocxToSemanticDocument, convertHtmlToSemanticDocument } from './docxToSemanticDocument';
import { semanticDocumentToElpx } from './converters/semanticDocumentToElpx';
import type {
  DocxImportProgress,
  ImportToElpxResult,
  DocxImportOptions,
  DocumentStructure,
} from '../types';

/**
 * Convertir archivo DOCX a ELPX (eXeLearning)
 *
 * API pública para el caso más común: archivo DOCX → ELPX.
 *
 * Orquesta dos pasos:
 * 1. convertDocxToSemanticDocument() - DOCX File → ImportedProject
 * 2. semanticDocumentToElpx() - ImportedProject → ELPX
 *
 * @param file - Archivo DOCX a convertir
 * @param options - Opciones de importación (heading modes, themeId)
 * @param structure - Estructura optativa para parsing semántico
 * @param onProgress - Callback para reportar progreso
 * @returns Promise<ImportToElpxResult> con blob ELPX y preview HTML
 *
 * @example
 * ```typescript
 * const result = await convertDocxToElpx(
 *   docxFile,
 *   { heading1Mode: 'page', heading2Mode: 'block', themeId: 'base' }
 * );
 * downloadFile(result.blob, result.filename);
 * ```
 */
export async function convertDocxToElpx(
  file: File,
  options: DocxImportOptions,
  structure?: DocumentStructure,
  onProgress?: (progress: DocxImportProgress) => void,
): Promise<ImportToElpxResult> {
  // Paso 1: Extraer semántica
  const project = await convertDocxToSemanticDocument(file, options, structure, onProgress);

  // Paso 2: Renderizar a ELPX
  return semanticDocumentToElpx(project, file.name, { themeId: options.themeId }, onProgress);
}

/**
 * Convertir HTML a ELPX (entrada alternativa para testing/APIs)
 *
 * API pública alternativa a convertDocxToElpx().
 * Útil cuando ya tienes HTML preprocessado.
 *
 * Orquesta dos pasos:
 * 1. convertHtmlToSemanticDocument() - HTML → ImportedProject
 * 2. semanticDocumentToElpx() - ImportedProject → ELPX
 *
 * Usar cuando:
 * - Tienes HTML preprocessado o manual
 * - Quieres testing sin archivos DOCX
 * - Necesitas control fino sobre entrada
 *
 * @param htmlValue - HTML a procesar
 * @param filename - Nombre del archivo
 * @param options - Opciones de importación
 * @param onProgress - Callback de progreso
 * @param parseMessageKey - Clave de mensaje (para i18n)
 * @param structure - Estructura H1/H2 (opcional)
 * @returns Promise<ImportToElpxResult>
 */
export async function convertHtmlToElpx(
  htmlValue: string,
  filename: string,
  options: DocxImportOptions,
  onProgress?: (progress: DocxImportProgress) => void,
  parseMessageKey = 'progress.parseDocumentStructure',
  structure?: DocumentStructure,
): Promise<ImportToElpxResult> {
  // Paso 1: Extraer semántica desde HTML
  const project = await convertHtmlToSemanticDocument(
    htmlValue,
    filename,
    options,
    onProgress,
    parseMessageKey,
    structure,
  );

  // Paso 2: Renderizar a ELPX
  return semanticDocumentToElpx(project, filename, { themeId: options.themeId }, onProgress);
}


