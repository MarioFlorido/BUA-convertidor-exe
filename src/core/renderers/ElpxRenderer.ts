import { zipSync } from 'fflate';
import type { SemanticDocument, SemanticPage, SemanticBlock } from '../models/SemanticDocument';
import { PreviewService } from '../services/PreviewService';
import { extractImages, RESOURCE_DIR } from '../transformers/ImageExtractor';
import { escapeHtml, upperCaseH2 } from '../utils/html';

export interface ElpxRenderOptions {
  themeId?: string;
  /** Si true, el índice lateral del ELPX arranca desplegado (todos los niveles visibles). */
  navExpanded?: boolean;
}

export interface RenderedElpx {
  blobData: Uint8Array;
  previewPages: Record<string, string>;
  pageCount: number;
  blockCount: number;
}

/**
 * Renderizador ELPX - Genera XML/ZIP de eXeLearning a partir de SemanticDocument
 *
 * Responsabilidades:
 * - Generar content.xml (estructura de navegación y bloques)
 * - Generar páginas de preview HTML
 * - Empaquetar todo en ZIP (ELPX)
 */
export class ElpxRenderer {
  constructor(
    private template: { entries: Record<string, Uint8Array> },
    private project: SemanticDocument,
  ) {}

  /**
   * Renderizar proyecto completo como ELPX
   */
  async render(options: ElpxRenderOptions): Promise<RenderedElpx> {
    const { entries } = this.template;
    const effectiveThemeId = options.themeId && options.themeId !== 'base' ? options.themeId : 'base';

    // Extraer las imágenes embebidas (base64) a archivos dentro del ZIP.
    // Trabaja sobre una copia: el project original (compartido con el PDF) no se toca.
    await this.extractImagesToFiles(entries);

    // Generar content.xml
    entries['content.xml'] = new TextEncoder().encode(
      this.generateContentXml(effectiveThemeId, options.navExpanded === true),
    );

    // Generar páginas de preview (una sola vez)
    const previewService = new PreviewService(this.project, { navExpanded: options.navExpanded });
    const previewPages = previewService.buildPages();
    previewService.addToZipEntries(entries, previewPages);

    // Empaquetar como ZIP
    const blobData = zipSync(entries, { level: 0 });

    return {
      blobData,
      previewPages,
      pageCount: this.project.pages.length,
      blockCount: this.project.pages.reduce((count, page) => count + page.blocks.length, 0),
    };
  }

  /**
   * Extrae las imágenes embebidas (data URL base64) de los bloques a archivos
   * dentro del ZIP, y reescribe los bloques para que apunten a esos archivos.
   *
   * Crea una copia del project y reasigna la referencia local: el project
   * original (compartido con el renderer de PDF) queda intacto con sus imágenes
   * en base64, que es lo que el PDF necesita.
   */
  private async extractImagesToFiles(entries: Record<string, Uint8Array>): Promise<void> {
    const pages: SemanticPage[] = [];
    for (const page of this.project.pages) {
      const blocks: SemanticBlock[] = [];
      for (const block of page.blocks) {
        const { html, files } = await extractImages(block.html || '');
        for (const [path, bytes] of files) {
          entries[path] = bytes;
        }
        blocks.push({ ...block, html });
      }
      pages.push({ ...page, blocks });
    }
    this.project = { ...this.project, pages };
  }

  /**
   * Generar XML de contenido (content.xml)
   *
   * @param navExpanded - Si true, añade pp_extraHeadContent con CSS que despliega
   *   el índice lateral completo. Esta propiedad es la que eXeLearning 4 inyecta
   *   al final del <head> de cada página al exportar (PageRenderer), por lo que
   *   sobrevive al reexport — a diferencia de las páginas de preview del ZIP,
   *   que eXeLearning regenera y descarta.
   */
  private generateContentXml(themeId: string = 'base', navExpanded = false): string {
    const odeId = createResourceId();
    const odeVersionId = createResourceId();
    const modified = String(Date.now());
    // El CSS extra va escapado dentro del XML; eXeLearning lo desescapa al
    // importar y lo coloca tal cual al final del <head> exportado, después del
    // style.css del tema (misma especificidad → gana la cascada). Es el único
    // vehículo de estilos que sobrevive al reexport desde eXeLearning.
    const extraStyles = [
      // URLs (u otras palabras sin espacios) excesivamente largas: permitir
      // partirlas en cualquier punto para que no desborden cajas, celdas ni
      // iDevices. Solo actúa cuando la palabra no cabe entera en la línea.
      'body{overflow-wrap:anywhere}',
      ...(navExpanded ? ['#siteNav .other-section{display:block}'] : []),
    ].join('');
    const extraHeadXml = `  <odeProperty><key>pp_extraHeadContent</key><value>${escapeXml(`<style>${extraStyles}</style>`)}</value></odeProperty>\n`;
    const pageIds = this.project.pages.map(() => createPageId());
    const navStructuresXml = this.project.pages
      .map((page, index) => this.generateOdeNavStructureXml(page, index, pageIds))
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<userPreferences>
  <userPreference>
    <key>theme</key>
    <value>${escapeXml(themeId)}</value>
  </userPreference>
</userPreferences>
<odeResources>
  <odeResource><key>odeId</key><value>${escapeXml(odeId)}</value></odeResource>
  <odeResource><key>odeVersionId</key><value>${escapeXml(odeVersionId)}</value></odeResource>
  <odeResource><key>exe_version</key><value>3.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>${escapeXml(this.project.title || 'Documento importado')}</value></odeProperty>
  <odeProperty><key>pp_subtitle</key><value>${escapeXml(this.project.subtitle || 'Biblioteca Universitaria')}</value></odeProperty>
  <odeProperty><key>pp_author</key><value>Biblioteca de la Universidad de Alicante</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>es</value></odeProperty>
  <odeProperty><key>pp_license</key><value>creative commons: attribution - non commercial - share alike 4.0</value></odeProperty>
  <odeProperty><key>pp_licenseUrl</key><value>https://creativecommons.org/licenses/by-nc-sa/4.0/</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>${escapeXml(themeId)}</value></odeProperty>
  <odeProperty><key>pp_exelearning_version</key><value>v4.0.0-rc3</value></odeProperty>
  <odeProperty><key>pp_modified</key><value>${escapeXml(modified)}</value></odeProperty>
  <odeProperty><key>pp_addExeLink</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addPagination</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addSearchBox</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addAccessibilityToolbar</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addMathJax</key><value>false</value></odeProperty>
  <odeProperty><key>exportSource</key><value>true</value></odeProperty>
  <odeProperty><key>pp_globalFont</key><value>default</value></odeProperty>
${extraHeadXml}</odeProperties>
<odeNavStructures>
${navStructuresXml}</odeNavStructures>
</ode>`;
  }

  /**
   * Generar estructura de navegación (página) en XML
   */
  private generateOdeNavStructureXml(page: SemanticPage, order: number, pageIds: string[]): string {
    const pageId = pageIds[order];
    const parentPageId = page.parentIndex === null ? '' : pageIds[page.parentIndex] || '';
    const title = (page.title || `Página ${order + 1}`).toUpperCase();
    const blocksXml = page.blocks
      .map((block, index) => this.generateOdePagStructureXml(block, pageId, index))
      .join('');

    return `<odeNavStructure>
  <odePageId>${escapeXml(pageId)}</odePageId>
  <odeParentPageId>${escapeXml(parentPageId)}</odeParentPageId>
  <pageName>${escapeXml(title)}</pageName>
  <odeNavStructureOrder>${order}</odeNavStructureOrder>
  <odeNavStructureProperties>
${this.generateNavStructurePropertyEntry('titlePage', title)}${this.generateNavStructurePropertyEntry('titleNode', title)}${this.generateNavStructurePropertyEntry('hidePageTitle', 'false')}${this.generateNavStructurePropertyEntry('titleHtml', '')}${this.generateNavStructurePropertyEntry('editableInPage', 'false')}${this.generateNavStructurePropertyEntry('visibility', 'true')}${this.generateNavStructurePropertyEntry('highlight', 'false')}${this.generateNavStructurePropertyEntry('description', '')}  </odeNavStructureProperties>
  <odePagStructures>
${blocksXml}  </odePagStructures>
</odeNavStructure>
`;
  }

  /**
   * Generar entrada de propiedad de navegación
   */
  private generateNavStructurePropertyEntry(key: string, value: string): string {
    return `    <odeNavStructureProperty>
      <key>${escapeXml(key)}</key>
      <value>${escapeXml(value)}</value>
    </odeNavStructureProperty>
`;
  }

  /**
   * Generar estructura de bloque (iDevice) en XML
   */
  private generateOdePagStructureXml(block: SemanticBlock, pageId: string, order: number): string {
    const blockId = createBlockId();
    const ideviceId = createIdeviceId();
    const blockName = block.title ? block.title.toUpperCase() : '';
    const rawHtml = upperCaseH2(block.html || '<p></p>');
    // eXeLearning resuelve las imágenes de recursos con el placeholder
    // {{context_path}}/ por delante (lo sustituye en runtime). El ImageExtractor
    // deja la ruta "neutra" content/resources/, válida para las preview pages;
    // aquí, solo para el content.xml, le anteponemos el placeholder.
    const html = rawHtml.split(`"${RESOURCE_DIR}/`).join(`"{{context_path}}/${RESOURCE_DIR}/`);
    const wrappedHtml = `<div class="exe-text-template">\n${html}\n</div>`;
    const jsonProperties = JSON.stringify({
      ideviceId,
      textInfoDurationInput: '',
      textInfoDurationTextInput: 'Duración',
      textInfoParticipantsInput: '',
      textInfoParticipantsTextInput: 'Agrupamiento',
      textTextarea: html,
      textFeedbackInput: 'Mostrar retroalimentación',
      textFeedbackTextarea: '',
    });

    return `    <odePagStructure>
      <odePageId>${escapeXml(pageId)}</odePageId>
      <odeBlockId>${escapeXml(blockId)}</odeBlockId>
      <blockName>${escapeXml(blockName)}</blockName>
      <iconName></iconName>
      <odePagStructureOrder>${order}</odePagStructureOrder>
      <odePagStructureProperties>
${this.generatePagStructurePropertyEntry('visibility', 'true')}${this.generatePagStructurePropertyEntry('teacherOnly', 'false')}${this.generatePagStructurePropertyEntry('allowToggle', 'true')}${this.generatePagStructurePropertyEntry('minimized', 'false')}${this.generatePagStructurePropertyEntry('cssClass', '')}      </odePagStructureProperties>
      <odeComponents>
        <odeComponent>
          <odePageId>${escapeXml(pageId)}</odePageId>
          <odeBlockId>${escapeXml(blockId)}</odeBlockId>
          <odeIdeviceId>${escapeXml(ideviceId)}</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView><![CDATA[${escapeCdata(wrappedHtml)}]]></htmlView>
          <jsonProperties><![CDATA[${escapeCdata(jsonProperties)}]]></jsonProperties>
          <odeComponentsOrder>0</odeComponentsOrder>
          <odeComponentsProperties>
          </odeComponentsProperties>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
`;
  }

  /**
   * Generar entrada de propiedad de bloque
   */
  private generatePagStructurePropertyEntry(key: string, value: string): string {
    return `        <odePagStructureProperty>
          <key>${escapeXml(key)}</key>
          <value>${escapeXml(value)}</value>
        </odePagStructureProperty>
`;
  }

}

// ============================================================================
// Funciones auxiliares
// ============================================================================

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function escapeCdata(value: string): string {
  return value.replaceAll(']]>', ']]]]><![CDATA[>');
}

function createPageId(): string {
  return crypto.randomUUID();
}

function createBlockId(): string {
  return `block-${crypto.randomUUID()}`;
}

function createIdeviceId(): string {
  return `idevice-${crypto.randomUUID()}`;
}

function createResourceId(): string {
  return `${timestampStamp()}${randomUppercase(6)}`;
}

function timestampStamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}



function randomUppercase(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

