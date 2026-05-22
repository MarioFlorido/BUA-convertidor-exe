/**
 * BlobUrlRegistry — gestión del ciclo de vida de Blob URLs
 *
 * Centraliza createObjectURL/revokeObjectURL para evitar fugas de memoria
 * en apps que cargan assets pesados (logos, portadas PDF, fuentes).
 *
 * Uso:
 *   const url = BlobUrlRegistry.create(blob);
 *   // ... usar url ...
 *   BlobUrlRegistry.revokeAll(); // al cambiar de tema
 */

class BlobUrlRegistryClass {
  private urls = new Set<string>();

  /** Crea un Blob URL y lo registra para posterior revocación */
  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  /** Revoca todos los Blob URLs registrados y limpia el registro */
  revokeAll(): void {
    for (const url of this.urls) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
  }

  /** Número de URLs activas (útil para debugging) */
  get count(): number {
    return this.urls.size;
  }
}

export const BlobUrlRegistry = new BlobUrlRegistryClass();
