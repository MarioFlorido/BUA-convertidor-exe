export interface DocxImportProgress {
  phase: 'read' | 'parse' | 'template' | 'pack';
  message: string;
  messageKey?: string;
}

export interface ImportToElpxResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  blockCount: number;
  previewHtml: string;
  previewPages: Record<string, string>;
}

export type HeadingMode = 'block' | 'page';
export type Heading1Mode = 'page' | 'resource';

export interface DocxImportOptions {
  heading1Mode: Heading1Mode;
  heading2Mode: HeadingMode;
  heading3Mode: HeadingMode;
  heading4Mode: HeadingMode;
  themeId?: string;
}

// Re-exportar tipos semánticos del modelo dedicado
export type {
  SemanticDocument,
  SemanticPage,
  SemanticBlock,
} from '../core/models/SemanticDocument';

export interface Theme {
  id: string;
  name: string;
  activity: string;
  language: string;
  description: string;
}

export interface ConversionState {
  status: 'idle' | 'loading' | 'processing' | 'complete' | 'error';
  progress?: DocxImportProgress;
  error?: string;
  result?: ImportToElpxResult;
}

export type H2StructureOption = 'idevice-title' | 'html' | 'accordion' | 'tabs';

export interface H2Item {
  id: string;
  text: string;
  option: H2StructureOption;
}

export interface H1Section {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  h2Items: H2Item[];
  /**
   * Sección creada por el parser (no proviene de un H1 del documento):
   * recoge el contenido anterior al primer H1, o todo el documento si no
   * hay H1. SemanticBuilder la empareja con ese rango por posición.
   */
  synthetic?: boolean;
}

export interface DocumentStructure {
  h1Sections: H1Section[];
}
