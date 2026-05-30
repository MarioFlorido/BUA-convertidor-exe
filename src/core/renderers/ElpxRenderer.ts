import { zipSync } from 'fflate';
import type { ImportedProject, ImportedPage, ImportedBlock } from '../models/SemanticDocument';
import { PreviewService } from '../services/PreviewService';
import { escapeHtml } from '../utils/html';

export interface ElpxRenderOptions {
  themeId?: string;
}

export interface RenderedElpx {
  blobData: Uint8Array;
  previewPages: Record<string, string>;
  pageCount: number;
  blockCount: number;
}

/**
 * Renderizador ELPX - Genera XML/ZIP de eXeLearning a partir de ImportedProject
 *
 * Responsabilidades:
 * - Generar content.xml (estructura de navegación y bloques)
 * - Generar páginas de preview HTML
 * - Empaquetar todo en ZIP (ELPX)
 */
export class ElpxRenderer {
  constructor(
    private template: { entries: Record<string, Uint8Array> },
    private project: ImportedProject,
  ) {}

  /**
   * Renderizar proyecto completo como ELPX
   */
  render(options: ElpxRenderOptions): RenderedElpx {
    const { entries } = this.template;
    const effectiveThemeId = options.themeId && options.themeId !== 'base' ? options.themeId : 'base';

    // Generar content.xml
    entries['content.xml'] = new TextEncoder().encode(this.generateContentXml(effectiveThemeId));

    // Generar páginas de preview (una sola vez)
    const previewService = new PreviewService(this.project);
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
   * Generar XML de contenido (content.xml)
   */
  private generateContentXml(themeId: string = 'base'): string {
    const odeId = createResourceId();
    const odeVersionId = createResourceId();
    const modified = String(Date.now());
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
  <odeProperty><key>pp_subtitle</key><value>${escapeXml(this.project.subtitle || '')}</value></odeProperty>
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
</odeProperties>
<odeNavStructures>
${navStructuresXml}</odeNavStructures>
</ode>`;
  }

  /**
   * Generar estructura de navegación (página) en XML
   */
  private generateOdeNavStructureXml(page: ImportedPage, order: number, pageIds: string[]): string {
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
  private generateOdePagStructureXml(block: ImportedBlock, pageId: string, order: number): string {
    const blockId = createBlockId();
    const ideviceId = createIdeviceId();
    const blockName = block.title ? block.title.toUpperCase() : '';
    const rawHtml = (block.html || '<p></p>').replace(
      /<h2([^>]*)>([^<]*)<\/h2>/gi,
      (_, attrs, text) => `<h2${attrs}>${text.toUpperCase()}</h2>`,
    );
    const html = rawHtml;
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
  return `block-${Date.now()}-${randomSuffix()}`;
}

function createIdeviceId(): string {
  return `idevice-${Date.now()}-${randomSuffix()}`;
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

function randomSuffix(length = 9): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

function randomUppercase(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

