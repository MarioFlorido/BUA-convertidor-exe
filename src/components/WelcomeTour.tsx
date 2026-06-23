import { useEffect, useState } from 'react';

export type TourScreen = 'upload' | 'structure' | 'theme' | 'result';

interface TourStep {
  screen: TourScreen;
  title: string;
  /** Cada entrada es un párrafo independiente (se renderiza como <p> propio). */
  text: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    screen: 'upload',
    title: '1. Sube tu documento',
    text: [
      'Arrastra aquí tu archivo .docx o haz clic para seleccionarlo desde tu ordenador.',
      'El archivo debe contener, al menos, un encabezado o título 1.',
      'Si necesitas resaltes recuerda que debes señalarlo entre corchetes [etiqueta] --> [fin]. Excepto las tablas que solo precisan la de inicio [horizontal] o [vertical]',
    ],
  },
  {
    screen: 'structure',
    title: '2. Configura la estructura',
    text: [
      '1º Revisa cómo se ordenan las páginas (títulos 1) con páginas principales, subpáginas... Ayudate para ello del arbol jerárquico.',
      '2º Da el tratamiento correspondiente a los encabezados (títulos 2)',
    ],
  },
  {
    screen: 'theme',
    title: '3. Elige el tema visual',
    text: [
      'Selecciona el estilo con el que se mostrará el proyecto en eXeLearning.',
      'El sistema muestra los oficiales de la BUA pero puedes cargar en local el que quieras y solo será visible par ti',
    ],
  },
  {
    screen: 'result',
    title: '4. Descarga el resultado',
    text: [
      'El ELPX puede presentarse con el menú plegado o desplegado, selecciona tu preferencia antes de descargar.',
      'El PDF puede tener una portada genérica o una personalizada según el estilo, igualmente elige con el selector antes de bajártelo',
    ],
  },
];

interface WelcomeTourProps {
  screen: TourScreen;
}

/**
 * Globo de ayuda contextual: un modal centrado con fondo oscurecido a
 * pantalla completa (no son coach marks con hueco sobre un elemento).
 * Bloquea deliberadamente la pantalla mientras está visible, para dar
 * espacio a textos explicativos largos sin las limitaciones de posición o
 * ancho de un tooltip anclado a un elemento.
 *
 * Quien decide si esto se muestra o no es el switch "Tour" del sidebar
 * (estado `helpEnabled` en App.tsx): mientras esté activado, cada vez que el
 * usuario entra en una pantalla del asistente aparece su globo; "Entendido"
 * solo cierra esa visita concreta (`dismissed` se reactiva al cambiar de
 * pantalla), así que si vuelve a pasar por aquí más adelante, reaparece.
 */
export function WelcomeTour({ screen }: WelcomeTourProps) {
  const step = TOUR_STEPS.find((s) => s.screen === screen);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [screen]);

  if (!step || dismissed) return null;

  const stepNumber = TOUR_STEPS.indexOf(step) + 1;

  return (
    <div className="tour-overlay" role="dialog" aria-label="Ayuda de la pantalla">
      <div className="tour-tooltip">
        <span className="tour-step-counter">{stepNumber} / {TOUR_STEPS.length}</span>
        <h3 className="tour-tooltip-title">{step.title}</h3>
        {step.text.map((paragraph, i) => (
          <p key={i} className="tour-tooltip-text">{paragraph}</p>
        ))}
        <div className="tour-tooltip-actions">
          <button className="btn-confirm" onClick={() => setDismissed(true)}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
