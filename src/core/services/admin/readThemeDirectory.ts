/**
 * readThemeDirectory — lectura de una carpeta de tema local con la
 * File System Access API (`showDirectoryPicker`).
 *
 * Soportada en Chrome/Edge (no Firefox/Safari). Como el panel de administración
 * lo usa un único administrador en Chrome, es suficiente.
 *
 * Devuelve el id del tema (nombre de la carpeta) y el mapa de archivos
 * (ruta relativa → bytes), filtrando la basura de macOS.
 */

export interface ReadDirectoryResult {
  id: string;
  files: Record<string, Uint8Array>;
}

function isSystemPath(path: string): boolean {
  const parts = path.split('/');
  return parts.some(
    (p) => p === '.DS_Store' || p === '__MACOSX' || p.startsWith('._'),
  );
}

/** ¿Está disponible la File System Access API en este navegador? */
export function isDirectoryPickerSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

async function walk(
  dirHandle: FileSystemDirectoryHandle,
  base: string,
  out: Record<string, Uint8Array>,
): Promise<void> {
  // @ts-expect-error — `entries()` existe en la File System Access API pero
  // los tipos del DOM aún no la incluyen en todas las versiones.
  for await (const [name, handle] of dirHandle.entries()) {
    const rel = base ? `${base}/${name}` : name;
    if (isSystemPath(rel)) continue;

    if (handle.kind === 'directory') {
      await walk(handle as FileSystemDirectoryHandle, rel, out);
    } else {
      const file = await (handle as FileSystemFileHandle).getFile();
      const buffer = await file.arrayBuffer();
      out[rel] = new Uint8Array(buffer);
    }
  }
}

/**
 * Abre el selector de carpeta y lee su contenido recursivamente.
 * Lanza si el usuario cancela o si la API no está disponible.
 */
export async function readThemeDirectory(): Promise<ReadDirectoryResult> {
  if (!isDirectoryPickerSupported()) {
    throw new Error(
      'Tu navegador no soporta la selección de carpetas (usa Chrome o Edge).',
    );
  }

  const picker = (window as unknown as {
    showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;

  const dirHandle = await picker({ mode: 'read' });
  const files: Record<string, Uint8Array> = {};
  await walk(dirHandle, '', files);

  return { id: dirHandle.name, files };
}
