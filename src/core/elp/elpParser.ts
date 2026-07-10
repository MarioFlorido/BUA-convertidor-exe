/**
 * Parser de paquetes .elp del eXeLearning clásico (2.x, probado con 2.9).
 *
 * Un .elp es un ZIP con `contentv3.xml` (serialización "jelly" de los objetos
 * Python de eXe: <instance>/<dictionary>/<list>/<unicode>…) y los recursos
 * (imágenes, PDF…) sueltos en la raíz del archivo. Este módulo extrae SOLO lo
 * necesario para regenerar un Word editable: árbol de páginas, HTML de cada
 * iDevice y recursos referenciados. No pretende fidelidad total: el contenido
 * interactivo se degrada a texto con aviso (los editores reestructuran después).
 *
 * Referencia del formato: `LegacyXmlParser.ts` del repositorio oficial
 * exelearning/exelearning (usado como documentación, sin copiar código).
 * Sin dependencias nuevas: fflate (ya en el proyecto) + DOMParser del entorno.
 */

import { unzipSync } from 'fflate';

export interface ElpIdevice {
  /** Tipo legible: `_iDeviceDir` en JsIdevice ("text"…) o el nombre de clase legado. */
  type: string;
  /** Título puesto por el autor; en los iDevice de texto suele venir vacío. */
  title: string;
  /** Fragmentos HTML del iDevice, en orden de aparición. */
  htmlFields: string[];
}

export interface ElpPage {
  title: string;
  /** Profundidad en el árbol: 0 = página de primer nivel. */
  depth: number;
  idevices: ElpIdevice[];
}

export interface ParsedElp {
  title: string;
  author: string;
  language: string;
  pages: ElpPage[];
  /** Recursos del ZIP por nombre de archivo (las rutas `resources/X` del HTML apuntan aquí). */
  resources: Map<string, Uint8Array>;
  /** Incidencias no fatales para mostrar al usuario (contenido omitido, etc.). */
  warnings: string[];
}

const CLASS_PACKAGE = 'exe.engine.package.Package';
const CLASS_NODE = 'exe.engine.node.Node';

/** Archivos del ZIP que son estructura interna de eXe, no recursos del autor. */
const INTERNAL_FILES = new Set(['contentv3.xml', 'contentv2.xml', 'content.data', 'content.xsd', 'content.xml']);

export function parseElp(buffer: Uint8Array): ParsedElp {
  const zip = unwrapSingleTopLevelDirectory(unzipSync(buffer));

  if (!zip['contentv3.xml']) {
    if (zip['content.xml']) {
      throw new Error(
        'Este archivo es un paquete del eXeLearning moderno (.elpx), no del clásico. Ábrelo directamente con eXeLearning.',
      );
    }
    throw new Error('No se ha encontrado contentv3.xml: el archivo no parece un .elp del eXeLearning clásico (2.x).');
  }

  const xmlText = preprocessLegacyXml(new TextDecoder('utf-8').decode(zip['contentv3.xml']));
  const doc = parseXml(xmlText);

  const packageEl = findInstanceByClass(doc, CLASS_PACKAGE);
  if (!packageEl) {
    throw new Error('El contentv3.xml no contiene un paquete de eXeLearning reconocible.');
  }

  const referenceMap = buildReferenceMap(doc);
  const packageDict = readDict(directChild(packageEl, 'dictionary'));

  const warnings: string[] = [];
  const pages: ElpPage[] = [];
  const rootEl = resolveInstance(packageDict.get('root'), referenceMap);
  if (rootEl && rootEl.getAttribute('class') === CLASS_NODE) {
    collectPages(rootEl, 0, pages, warnings, referenceMap);
  } else {
    // Plan B: sin raíz reconocible, tomar todos los nodos en orden de documento.
    for (const nodeEl of findInstancesByClass(doc, CLASS_NODE)) {
      pages.push(readPage(nodeEl, 0, warnings, referenceMap));
    }
  }

  if (pages.length === 0) {
    throw new Error('El paquete no contiene ninguna página.');
  }

  return {
    title: textValue(packageDict.get('_title')) || 'Documento',
    author: textValue(packageDict.get('_author')),
    language: textValue(packageDict.get('_lang')),
    pages,
    resources: collectResources(zip),
    warnings,
  };
}

// ── Preprocesado ──────────────────────────────────────────────────────────────

/**
 * Corrige rarezas conocidas del escritor XML de eXe 2.x antes de parsear:
 * secuencias `\xNN` que el serializador Python dejaba escapar en texto plano.
 * Solo se convierten códigos válidos en XML (tab, saltos y ≥ espacio) para no
 * introducir caracteres de control que rompan el parseo. Los .elp 2.9 probados
 * no las traen; se mantiene como seguro barato para archivos más viejos.
 */
export function preprocessLegacyXml(xml: string): string {
  return xml.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex: string) => {
    const code = parseInt(hex, 16);
    return code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20 ? String.fromCharCode(code) : match;
  });
}

function parseXml(xmlText: string): Document {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  } catch (error) {
    throw new Error(`El contentv3.xml no es un XML válido: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('El contentv3.xml no es un XML válido.');
  }
  return doc;
}

// ── Lectura del formato jelly ─────────────────────────────────────────────────
// Un <dictionary> alterna elementos clave (<string role="key" value="K"/>) y
// elementos valor (el hermano-elemento siguiente): unicode, string, list,
// instance, reference, bool, int…

function readDict(dictEl: Element | null): Map<string, Element> {
  const entries = new Map<string, Element>();
  if (!dictEl) return entries;

  let pendingKey: string | null = null;
  for (let child = dictEl.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    if (pendingKey === null) {
      if (localName(el) === 'string' && el.getAttribute('role') === 'key') {
        pendingKey = el.getAttribute('value') ?? '';
      }
    } else {
      entries.set(pendingKey, el);
      pendingKey = null;
    }
  }
  return entries;
}

/** Texto de un valor string/unicode (eXe lo guarda en el atributo `value`). */
function textValue(el: Element | undefined | null): string {
  if (!el) return '';
  const name = localName(el);
  if (name !== 'string' && name !== 'unicode') return '';
  const attr = el.getAttribute('value');
  return attr !== null && attr !== '' ? attr : (el.textContent ?? '');
}

/** Resuelve un valor que puede ser una <instance> inline o una <reference key="N"/>. */
function resolveInstance(el: Element | undefined | null, referenceMap: Map<string, Element>): Element | null {
  if (!el) return null;
  const name = localName(el);
  if (name === 'instance') return el;
  if (name === 'reference') {
    const key = el.getAttribute('key');
    return (key && referenceMap.get(key)) || null;
  }
  return null;
}

function buildReferenceMap(doc: Document): Map<string, Element> {
  const map = new Map<string, Element>();
  for (const el of allInstances(doc)) {
    const ref = el.getAttribute('reference');
    if (ref) map.set(ref, el);
  }
  return map;
}

// ── Páginas e iDevices ────────────────────────────────────────────────────────

function collectPages(
  nodeEl: Element,
  depth: number,
  pages: ElpPage[],
  warnings: string[],
  referenceMap: Map<string, Element>,
): void {
  pages.push(readPage(nodeEl, depth, warnings, referenceMap));

  const dict = readDict(directChild(nodeEl, 'dictionary'));
  const childrenList = dict.get('children');
  if (!childrenList || localName(childrenList) !== 'list') return;

  for (let child = childrenList.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    const childNode = resolveInstance(child as Element, referenceMap);
    if (childNode && childNode.getAttribute('class') === CLASS_NODE) {
      collectPages(childNode, depth + 1, pages, warnings, referenceMap);
    }
  }
}

function readPage(
  nodeEl: Element,
  depth: number,
  warnings: string[],
  referenceMap: Map<string, Element>,
): ElpPage {
  const dict = readDict(directChild(nodeEl, 'dictionary'));
  const title = resolveNodeTitle(dict, referenceMap) || 'Página sin título';

  const idevices: ElpIdevice[] = [];
  const idevicesList = dict.get('idevices');
  if (idevicesList && localName(idevicesList) === 'list') {
    for (let child = idevicesList.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1) continue;
      const ideviceEl = resolveInstance(child as Element, referenceMap);
      if (!ideviceEl) continue;
      const idevice = readIdevice(ideviceEl);
      if (idevice.htmlFields.length > 0) {
        idevices.push(idevice);
      } else {
        warnings.push(
          `En la página «${title}»: iDevice «${idevice.title || idevice.type}» sin texto extraíble, omitido.`,
        );
      }
    }
  }

  return { title, depth, idevices };
}

/**
 * El título de un nodo puede venir como texto directo o envuelto en un
 * TextField (variantes de eXe 2.x); se aceptan ambas formas.
 */
function resolveNodeTitle(dict: Map<string, Element>, referenceMap: Map<string, Element>): string {
  const titleEl = dict.get('_title') ?? dict.get('title');
  const direct = textValue(titleEl);
  if (direct) return direct;

  const titleInstance = resolveInstance(titleEl, referenceMap);
  if (titleInstance) {
    const innerDict = readDict(directChild(titleInstance, 'dictionary'));
    return textValue(innerDict.get('content_w_resourcePaths')) || textValue(innerDict.get('_content')) || textValue(innerDict.get('content'));
  }
  return '';
}

function readIdevice(ideviceEl: Element): ElpIdevice {
  const className = ideviceEl.getAttribute('class') ?? '';
  const dict = readDict(directChild(ideviceEl, 'dictionary'));

  let type = className.split('.').pop() ?? 'iDevice';
  if (className.endsWith('.JsIdevice')) {
    type = textValue(dict.get('_iDeviceDir')) || textValue(dict.get('_typeName')) || type;
  } else if (className.endsWith('.GenericIdevice')) {
    type = textValue(dict.get('__name__')) || type;
  }

  // El HTML vive en campos TextAreaField descendientes (uno por iDevice de
  // texto en eXe 2.9). Los TextField se ignoran: son pies/leyendas de las
  // galerías internas de imágenes y duplicarían contenido.
  const htmlFields: string[] = [];
  for (const fieldEl of elementsByLocalName(ideviceEl, 'instance')) {
    const fieldClass = fieldEl.getAttribute('class') ?? '';
    if (!fieldClass.endsWith('.TextAreaField')) continue;
    const fieldDict = readDict(directChild(fieldEl, 'dictionary'));
    const html =
      textValue(fieldDict.get('content_w_resourcePaths')) ||
      textValue(fieldDict.get('_content')) ||
      textValue(fieldDict.get('content'));
    if (html.trim()) htmlFields.push(html);
  }

  return { type, title: textValue(dict.get('_title')).trim(), htmlFields };
}

// ── Recursos del ZIP ──────────────────────────────────────────────────────────

function collectResources(zip: Record<string, Uint8Array>): Map<string, Uint8Array> {
  const resources = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(zip)) {
    if (path.endsWith('/') || path.includes('/')) continue; // solo la raíz (formato legado plano)
    if (INTERNAL_FILES.has(path) || path.endsWith('.xml') || path.endsWith('.xsd')) continue;
    resources.set(path, data);
  }
  return resources;
}

/** Desenvuelve ZIPs re-empaquetados con una única carpeta raíz (p. ej. al descomprimir y volver a comprimir). */
function unwrapSingleTopLevelDirectory(zip: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const paths = Object.keys(zip).filter((path) => !path.endsWith('/'));
  if (paths.length === 0 || paths.some((path) => !path.includes('/'))) return zip;

  const prefix = paths[0].slice(0, paths[0].indexOf('/') + 1);
  if (!paths.every((path) => path.startsWith(prefix))) return zip;

  const unwrapped: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(zip)) {
    if (path.startsWith(prefix) && path.length > prefix.length) {
      unwrapped[path.slice(prefix.length)] = data;
    }
  }
  return unwrapped;
}

// ── Utilidades DOM ────────────────────────────────────────────────────────────
// El contentv3.xml declara un xmlns por defecto; se compara por localName para
// funcionar igual con DOMParser del navegador y con jsdom en los tests.

function localName(el: Element): string {
  return el.localName ?? el.tagName;
}

function directChild(parent: Element, name: string): Element | null {
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1 && localName(child as Element) === name) return child as Element;
  }
  return null;
}

function elementsByLocalName(root: Element, name: string): Element[] {
  const all = root.getElementsByTagName('*');
  const result: Element[] = [];
  for (let i = 0; i < all.length; i += 1) {
    if (localName(all[i]) === name) result.push(all[i]);
  }
  return result;
}

/** Todas las <instance> del documento, INCLUIDA la raíz (el Package es el elemento raíz). */
function allInstances(doc: Document): Element[] {
  const root = doc.documentElement;
  const result: Element[] = [];
  if (localName(root) === 'instance') result.push(root);
  result.push(...elementsByLocalName(root, 'instance'));
  return result;
}

function findInstanceByClass(doc: Document, className: string): Element | null {
  return findInstancesByClass(doc, className)[0] ?? null;
}

function findInstancesByClass(doc: Document, className: string): Element[] {
  return allInstances(doc).filter((el) => el.getAttribute('class') === className);
}
