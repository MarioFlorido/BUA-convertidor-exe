/**
 * yieldToBrowser — devolver el control al navegador entre fases del pipeline.
 *
 * POR QUÉ HACE FALTA: las fases de la conversión están separadas por `await`,
 * pero `await` sobre una promesa ya resuelta solo vacía la cola de MICROtareas.
 * El navegador no pinta ni ejecuta temporizadores hasta que la pila entera se
 * agota, así que los `onProgress` llamaban a `setState`, React encolaba el
 * repintado y este no llegaba a ocurrir hasta que TODA la conversión había
 * terminado: la barra de progreso se quedaba clavada y la ventana no respondía.
 * Medido sobre un documento de 40 unidades con imágenes: la conversión entera
 * era un único bloque de ~1,3 s sin un solo respiro.
 *
 * Hace falta encolar una MACROtarea, porque entre macrotareas el navegador
 * puede pintar. No acelera la conversión —el trabajo es el mismo—, pero la
 * interfaz deja de estar muerta y el progreso avanza de verdad.
 *
 * POR QUÉ `MessageChannel` Y NO `setTimeout(0)`: en una pestaña de fondo Chrome
 * limita los temporizadores a **uno por segundo**. Con `setTimeout` cada cesión
 * pasaba a costar un segundo entero en cuanto el usuario se iba a otra pestaña
 * —medido: la conversión pasaba de ~1,3 s a ~5 s—, justo lo que hace quien deja
 * un documento largo convirtiéndose. Los mensajes de `MessageChannel` no sufren
 * ese recorte. Tampoco sirve `requestAnimationFrame`: directamente no se
 * dispara en pestañas de fondo, y la conversión se quedaría detenida.
 */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const canal = new MessageChannel();
    canal.port1.onmessage = () => {
      canal.port1.close();
      resolve();
    };
    canal.port2.postMessage(null);
  });
}
