export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizar texto: compacta espacios múltiples a un solo espacio y elimina espacios al inicio/fin
 * Necesario para matching consistente de títulos entre parseStructure y buildFromStructure
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
