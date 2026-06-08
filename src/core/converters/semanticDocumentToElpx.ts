/**
 * Renderizador ELPX - Convierte SemanticDocument a formato eXeLearning
 *
 * RESPONSABILIDAD ÚNICA:
 * Renderizar un SemanticDocument (ImportedProject) a ELPX puro.
 *
 * Este módulo recibe un documento ya parseado semánticamente
 * y lo convierte al formato específico de eXeLearning.
 *
 * Nunca manipula parsing o semántica - eso ya está hecho.
 */

import { ElpxRenderer } from '../renderers/ElpxRenderer';
import { ThemeService } from '../services/ThemeService';
import { ThemeRegistry } from '../services/ThemeRegistry';
import type {
  DocxImportProgress,
  ImportToElpxResult,
  SemanticDocument,
} from '../../types';

/**
 * Convertir SemanticDocument a ELPX (eXeLearning)
 *
 * Toma un ImportedProject (ya parseado semánticamente)
 * y lo renderiza a formato ELPX.
 *
 * Flujo:
 * 1. Carga plantilla base (ThemeService)
 * 2. Carga tema personalizado si aplica
 * 3. Renderiza XML/ZIP con ElpxRenderer
 * 4. Genera preview HTML con PreviewService
 *
 * Usar cuando:
 * - Tienes un ImportedProject preconstruido
 * - Necesitas máximo control sobre la renderización
 * - Quieres reutilizar un proyecto múltiples veces con diferentes temas
 *
 * @param project - Proyecto semántico a renderizar
 * @param filename - Nombre para el resultado ELPX
 * @param options - Opciones de renderizado (themeId, etc.)
 * @param onProgress - Callback de progreso
 * @returns Promise<ImportToElpxResult> con blob ELPX y preview HTML
 *
 * @example
 * ```typescript
 * // Primero: obtener semántica
 * const project = await convertDocxToSemanticDocument(file, options);
 *
 * // Después: renderizar a ELPX
 * const result = await semanticDocumentToElpx(project, 'resultado.elpx', {
 *   themeId: 'base'
 * });
 *
 * downloadFile(result.blob, result.filename);
 * ```
 */
export interface ElpxRenderOptions {
  themeId?: string;
}

export async function semanticDocumentToElpx(
  project: SemanticDocument,
  filename: string,
  options: ElpxRenderOptions = {},
  onProgress?: (progress: DocxImportProgress) => void,
): Promise<ImportToElpxResult> {
  onProgress?.({
    phase: 'template',
    message: 'Aplicando la plantilla base de eXeLearning...',
    messageKey: 'progress.applyTemplate',
  });

  const template = await ThemeService.loadTemplate();

  // Cargar tema personalizado si es necesario
  if (options.themeId && options.themeId !== 'base') {
    // Verificar que el tema existe en el registry
    const themeBundle = ThemeRegistry.get(options.themeId);
    if (!themeBundle || Object.keys(themeBundle.files).length === 0) {
      throw new Error(
        `Tema "${options.themeId}" no está disponible. ` +
        `Verifica que el tema se haya cargado correctamente.`
      );
    }

    const themeEntries = await ThemeService.loadTheme(options.themeId);
    for (const [entryPath, entryData] of Object.entries(themeEntries)) {
      template.entries[entryPath] = entryData;
    }
  }

  // Delegar renderización a ElpxRenderer
  const renderer = new ElpxRenderer(template, project);
  const rendered = await renderer.render({ themeId: options.themeId });

  const previewHtml = rendered.previewPages['index.html']
    ? rendered.previewPages['index.html']
    : '<!doctype html><html lang="es"><body><p>Sin contenido para previsualizar.</p></body></html>';

  onProgress?.({
    phase: 'pack',
    message: 'Generando el archivo .elpx...',
    messageKey: 'progress.packElpx',
  });

  const blob = new Blob([new Uint8Array(rendered.blobData)], { type: 'application/zip' });

  return {
    blob,
    filename: toElpxFilename(filename),
    pageCount: rendered.pageCount,
    blockCount: rendered.blockCount,
    previewHtml,
    previewPages: rendered.previewPages,
  };
}

/**
 * Convertir nombre de archivo a nombre ELPX
 * @param inputFilename - Nombre original (ej: "documento.docx")
 * @returns Nombre con extensión .elpx (ej: "documento.elpx")
 */
function toElpxFilename(inputFilename: string): string {
  const stem = inputFilename.replace(/\.[^.]+$/, '').trim() || 'proyecto';
  return `${stem}.elpx`;
}
