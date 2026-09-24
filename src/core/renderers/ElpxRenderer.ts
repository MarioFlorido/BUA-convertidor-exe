import { zipSync } from 'fflate';
import type { SemanticDocument, SemanticPage, SemanticBlock } from '../models/SemanticDocument';
import { PreviewService } from '../services/PreviewService';
import { extractImages, RESOURCE_DIR } from '../transformers/ImageExtractor';
import { escapeHtml, upperCaseH2 } from '../utils/html';
import { yieldToBrowser } from '../utils/yieldToBrowser';
import { LINKED_HEADING_ICON_CSS } from '../utils/externalLinkIcon';
import { BOLD_LINK_COLOR_CSS } from '../utils/boldLinkColor';
import { RESOURCE_LINK_CSS } from '../utils/resourceIcons';
import { longTitleScale, longTitleHeaderCss, HEADER_TITLE_COMFORTABLE_LENGTH } from '../utils/titleScale';
import { ThemeRegistry } from '../services/ThemeRegistry';

/**
 * Idioma del tema elegido (es/ca/en), para las odeProperty que dependen de él
 * (`pp_lang`, subtítulo por defecto). Muchos materiales son en valenciano o
 * en inglés (temas CID_va, PhD, Open_Science…): fijarlas siempre en castellano
 * queda mal en la cabecera del ELPX y, en el caso de `pp_lang`, es además un
 * problema de accesibilidad (lectores de pantalla). `metadata.language` del
 * tema (ver themes-config.json y themeConfigParser) es la señal fiable;
 * cualquier valor desconocido o ausente cae en castellano, que sigue siendo
 * el idioma por defecto de la biblioteca.
 */
const KNOWN_LANGS = new Set(['es', 'ca', 'en']);

function themeLanguage(themeId: string): string {
  const lang = ThemeRegistry.get(themeId)?.metadata.language;
  return lang && KNOWN_LANGS.has(lang) ? lang : 'es';
}

const DEFAULT_SUBTITLE_BY_LANG: Record<string, string> = {
  es: 'Biblioteca Universitaria',
  ca: 'Biblioteca Universitària',
  en: 'University Library',
};

function defaultSubtitleForLang(lang: string): string {
  return DEFAULT_SUBTITLE_BY_LANG[lang] ?? DEFAULT_SUBTITLE_BY_LANG.es;
}

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
    // Los cuatro pasos de este método son los tramos largos del final del
    // pipeline. Ceder entre ellos permite al navegador pintar el progreso;
    // sin esto, la ventana queda muerta hasta que el ZIP está montado.
    await yieldToBrowser();

    // Generar content.xml
    entries['content.xml'] = new TextEncoder().encode(
      this.generateContentXml(effectiveThemeId, options.navExpanded === true),
    );
    await yieldToBrowser();

    // Generar páginas de preview (una sola vez)
    const previewService = new PreviewService(this.project, { navExpanded: options.navExpanded });
    const previewPages = previewService.buildPages();
    previewService.addToZipEntries(entries, previewPages);
    await yieldToBrowser();

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
      // Ceder página a página: decodificar base64 y hashear son ~240 ms de un
      // tirón en un documento de 40 unidades. Repartido, ninguna página bloquea.
      await yieldToBrowser();
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
   *
   * Nota sobre pp_addSearchBox: va a `true` de serie. eXeLearning lee la
   * propiedad al importar el ELPX y, al exportar el sitio web, inyecta el
   * contenedor #exe-client-search en cada página y genera search_index.js. El
   * motor ($exeExport.searchBar, en libs/exe_export.js) y los estilos del tema
   * ya viajan en toda exportación, así que no hay nada más que añadir: sin ese
   * contenedor, init() sale sin hacer nada. Coste: ~1,5 KB comprimidos.
   * Las preview del ZIP no lo llevan, pero da igual: eXeLearning las regenera.
   */
  private generateContentXml(themeId: string = 'base', navExpanded = false): string {
    const odeId = createResourceId();
    const odeVersionId = createResourceId();
    const modified = String(Date.now());
    const headerTitleScale = longTitleScale(this.project.title, HEADER_TITLE_COMFORTABLE_LENGTH);
    // El CSS extra va escapado dentro del XML; eXeLearning lo desescapa al
    // importar y lo coloca tal cual al final del <head> exportado, después del
    // style.css del tema (misma especificidad → gana la cascada). Es el único
    // vehículo de estilos que sobrevive al reexport desde eXeLearning.
    const extraStyles = [
      // URLs (u otras palabras sin espacios) excesivamente largas: permitir
      // partirlas en cualquier punto para que no desborden cajas ni iDevices.
      'body{overflow-wrap:anywhere}',
      // …pero NO dentro de una tabla. `anywhere`, a diferencia de `break-word`,
      // SÍ cuenta al calcular el tamaño intrínseco del contenido: en una tabla
      // con `table-layout: auto` el navegador da por bueno estrechar cualquier
      // columna hasta UN carácter, así que en cuanto la tabla iba justa de ancho
      // partía palabras corrientes por la mitad («Añ/o», «Artíc/ulo»,
      // «Cerr/ado» — medidas 9 en una tabla de 6 columnas). Por eso el PDF no lo
      // hacía y el ELPX sí: printStyles.css nunca usó `anywhere`.
      // Con `break-word` el ancho mínimo de la celda vuelve a ser la palabra
      // entera, y la palabra solo se parte si de verdad no cabe en su línea, que
      // es lo que se buscaba desde el principio.
      '.exe-content td,.exe-content th{overflow-wrap:break-word;word-break:normal}',
      // Y que la tabla pueda ensancharse cuando el 80% del tema no le basta.
      // El suelo mantiene EXACTAMENTE el ancho actual (una ficha de dos columnas
      // sigue ocupando el 80%); el techo deja que una tabla de muchas columnas
      // llegue al ancho completo del contenido en vez de apretujarse. Sin esto,
      // quitar `anywhere` a las celdas solo cambia palabras partidas por filas
      // más altas.
      '.exe-content .bua_tabla_horizontal,.exe-content .bua_tabla_vertical' +
        '{width:auto;min-width:80%;max-width:100%}',
      // Imágenes EN LÍNEA (logos junto a un título o abriendo un párrafo,
      // imágenes que son un hiperenlace). El tema aplica a TODA imagen del
      // contenido `display:block` + márgenes automáticos + sombra
      // (`.exe-content img`), que es lo correcto para una captura pero saca al
      // logo de su párrafo y lo enmarca. Con `.exe-content img.bua_img_inline`
      // (más específico) y este bloque yendo después del style.css del tema,
      // gana la cascada sin necesidad de !important. El tamaño lo trae la
      // propia imagen en su `style` inline: el que tenía en Word.
      '.exe-content img.bua_img_inline{display:inline;vertical-align:middle;margin:0 .25em 0 0;box-shadow:none;border-radius:0}',
      // Encabezado (H2/H3/H4) que ADEMÁS es un enlace: icono de «enlace externo»
      // en superíndice detrás del texto enlazado (ver externalLinkIcon.ts).
      LINKED_HEADING_ICON_CSS,
      // Enlace en negrita: que el strong del tema no le quite el color de
      // enlace (ver boldLinkColor.ts).
      BOLD_LINK_COLOR_CSS,
      // Líneas de recurso ([vídeo:], [documento:], [enlace:]): icono delante y
      // cursiva, para que la lista de recursos se distinga del cuerpo del texto
      // (ver resourceIcons.ts).
      RESOURCE_LINK_CSS,
      // Título largo (viene de «Comentarios» del Word): la banda de cabecera de
      // los temas mide 400 px y el título va anclado abajo, así que lo que no
      // cabe se sale por arriba.
      //
      // La variable la lee el style.css de nuestros temas. No basta: eXeLearning
      // exporta con el tema que tiene INSTALADO, y si esa copia es anterior a
      // --bua-title-scale nadie la lee. Por eso va también la regla completa
      // (ver longTitleHeaderCss), que no depende de la versión del tema.
      // Un título corto no necesita ninguna de las dos.
      ...(headerTitleScale < 1
        ? [`:root{--bua-title-scale:${headerTitleScale}}`, longTitleHeaderCss(headerTitleScale)]
        : []),
      ...(navExpanded ? ['#siteNav .other-section{display:block}'] : []),
    ].join('');
    const extraHeadXml = `  <odeProperty><key>pp_extraHeadContent</key><value>${escapeXml(`<style>${extraStyles}</style>`)}</value></odeProperty>\n`;
    const lang = themeLanguage(themeId);
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
  <odeProperty><key>pp_subtitle</key><value>${escapeXml(this.project.subtitle || defaultSubtitleForLang(lang))}</value></odeProperty>
  <odeProperty><key>pp_author</key><value>Biblioteca de la Universidad de Alicante</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>${escapeXml(lang)}</value></odeProperty>
  <odeProperty><key>pp_license</key><value>creative commons: attribution - non commercial - share alike 4.0</value></odeProperty>
  <odeProperty><key>pp_licenseUrl</key><value>https://creativecommons.org/licenses/by-nc-sa/4.0/</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>${escapeXml(themeId)}</value></odeProperty>
  <odeProperty><key>pp_exelearning_version</key><value>v4.0.0-rc3</value></odeProperty>
  <odeProperty><key>pp_modified</key><value>${escapeXml(modified)}</value></odeProperty>
  <odeProperty><key>pp_addExeLink</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addPagination</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addSearchBox</key><value>true</value></odeProperty>
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
    // Los iDevices con título (H2 marcado como «título de iDevice») se generan
    // plegados: tienen cabecera y marco contenedor, así que el usuario los
    // despliega si quiere ver el contenido. Los bloques sin título no tienen
    // cabecera sobre la que plegar → quedan desplegados como hasta ahora.
    const minimized = block.title.trim() ? 'true' : 'false';
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
${this.generatePagStructurePropertyEntry('visibility', 'true')}${this.generatePagStructurePropertyEntry('teacherOnly', 'false')}${this.generatePagStructurePropertyEntry('allowToggle', 'true')}${this.generatePagStructurePropertyEntry('minimized', minimized)}${this.generatePagStructurePropertyEntry('cssClass', '')}      </odePagStructureProperties>
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

