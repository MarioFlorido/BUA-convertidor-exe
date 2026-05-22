/**
 * ThemeCssManager — inyección segura de CSS de tema
 *
 * Garantiza que el CSS del tema activo esté siempre en un único
 * elemento <style id="theme-css">. Al cambiar de tema, el anterior
 * se elimina antes de inyectar el nuevo. Nunca se acumulan estilos.
 */

const CSS_ELEMENT_ID = 'theme-css';

export const ThemeCssManager = {
  /**
   * Aplica el CSS de un tema.
   * Elimina el CSS anterior si existía.
   */
  apply(css: string): void {
    document.getElementById(CSS_ELEMENT_ID)?.remove();
    const style = document.createElement('style');
    style.id = CSS_ELEMENT_ID;
    style.innerHTML = css;
    document.head.appendChild(style);
  },

  /** Elimina el CSS de tema activo */
  clear(): void {
    document.getElementById(CSS_ELEMENT_ID)?.remove();
  },
};
