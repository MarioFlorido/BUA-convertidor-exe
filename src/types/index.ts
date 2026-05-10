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

export interface ImportedProject {
  title: string;
  subtitle: string;
  pages: ImportedPage[];
}

export interface ImportedPage {
  title: string;
  level: 1 | 2 | 3 | 4;
  parentIndex: number | null;
  blocks: ImportedBlock[];
}

export interface ImportedBlock {
  title: string;
  html: string;
}

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
