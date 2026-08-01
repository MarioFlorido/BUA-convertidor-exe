/**
 * ThemeBundle — unidad universal del sistema de temas
 *
 * Tanto los temas built-in como los de usuario se representan
 * con esta misma interfaz. ThemeRegistry es la única fuente de verdad.
 */

export interface ThemeMetadata {
  name: string;
  activity?: string;
  language?: string;
  description?: string;
  screenshot?: string | null;
  /**
   * Versión de publicación del tema (`updatedAt` de themes-config.json).
   * La usa `themeZipUrl` para romper la caché cuando el tema se republica.
   * Solo built-ins: los temas de usuario no se descargan por URL.
   */
  updatedAt?: string;
}

export interface ThemeBundle {
  /** ID único del tema (ej: "Doctorado_26-27", "base") */
  id: string;
  /** Nombre legible */
  name: string;
  /** Origen del tema */
  source: 'builtin' | 'user';
  /** Archivos descomprimidos del ZIP (ruta relativa → datos) */
  files: Record<string, Uint8Array>;
  /** Metadatos opcionales (enriquecidos desde themes-config.json para built-ins) */
  metadata: ThemeMetadata;
}
