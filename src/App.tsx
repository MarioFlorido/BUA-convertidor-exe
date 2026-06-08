import { useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { StructureConfigurator } from './components/StructureConfigurator';
import { ThemeSelector } from './components/ThemeSelector';
import { ThemeManager } from './components/ThemeManager';
import { DownloadButton } from './components/DownloadButton';
import { AppHeader } from './components/AppHeader';
import { StepIndicator } from './components/StepIndicator';
import { convertDocxToSemanticDocument } from './core/docxToSemanticDocument';
import { semanticDocumentToElpx } from './core/converters/semanticDocumentToElpx';
import { parseDocumentStructure } from './core/parseStructure';
import { detectSemanticTagIssues, type SemanticTagIssue } from './core/validation/semanticTagBalance';
import { ThemeRegistry } from './core/services/ThemeRegistry';
import type {
  DocxImportOptions,
  ConversionState,
  DocxImportProgress,
  DocumentStructure,
  SemanticDocument,
} from './types';
import './styles/globals.css';

type AppScreen = 'upload' | 'structure' | 'theme' | 'result' | 'theme-manager';

// Fases del pipeline de conversión y sus etiquetas
const PIPELINE_PHASES: { id: DocxImportProgress['phase']; label: string }[] = [
  { id: 'read',     label: 'Leyendo documento' },
  { id: 'parse',    label: 'Analizando estructura' },
  { id: 'template', label: 'Aplicando plantilla' },
  { id: 'pack',     label: 'Empaquetando ELPX' },
];

function phaseIndex(phase: DocxImportProgress['phase'] | undefined): number {
  if (!phase) return -1;
  return PIPELINE_PHASES.findIndex((p) => p.id === phase);
}

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [screen, setScreen] = useState<AppScreen>('upload');
  const [structure, setStructure] = useState<DocumentStructure | null>(null);
  const [state, setState] = useState<ConversionState>({ status: 'idle' });
  const [semanticDoc, setSemanticDoc] = useState<SemanticDocument | null>(null);
  const [parsedDocxHtml, setParsedDocxHtml] = useState<string | null>(null);
  const [tagIssues, setTagIssues] = useState<SemanticTagIssue[]>([]);
  const [options, setOptions] = useState<DocxImportOptions>({
    heading1Mode: 'page',
    heading2Mode: 'page',
    heading3Mode: 'block',
    heading4Mode: 'block',
    themeId: 'base',
  });

  // ── Paso del wizard ────────────────────────────────────────────────────────
  const currentStep = ((): 1 | 2 | 3 | 4 => {
    if (screen === 'upload') return 1;
    if (screen === 'structure') return 2;
    if (screen === 'theme' || state.status === 'processing') return 3;
    if (screen === 'result') return 4;
    return 1;
  })();

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setState({ status: 'idle' });

    try {
      setState({ status: 'processing', progress: { phase: 'read', message: 'Leyendo archivo…' } });
      const { DocxParser } = await import('./core/parsers/DocxParser');
      const parser = new DocxParser();
      const parseResult = await parser.parse(selectedFile);

      setParsedDocxHtml(parseResult.html);
      setTagIssues(detectSemanticTagIssues(parseResult.html));
      const parsedStructure = await parseDocumentStructure(parseResult.html);
      setStructure(parsedStructure);
      setScreen('structure');
      setState({ status: 'idle' });
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error al parsear el documento',
      });
    }
  };

  const handleStructureConfirm = (configuredStructure: DocumentStructure) => {
    setStructure(configuredStructure);
    setScreen('theme');
  };

  const handleStructureCancel = () => {
    setFile(null);
    setStructure(null);
    setParsedDocxHtml(null);
    setTagIssues([]);
    setScreen('upload');
    setState({ status: 'idle' });
  };

  // NOTA: selectedThemeId se pasa directamente para evitar leer el estado stale.
  const handleThemeConfirm = (selectedThemeId: string) => {
    localStorage.setItem('bua-last-theme', selectedThemeId);
    setOptions((prev) => ({ ...prev, themeId: selectedThemeId }));
    handleConvert(selectedThemeId);
  };

  const handleThemeCancel = () => {
    setScreen('structure');
  };

  const handleStepClick = (step: 2 | 3) => {
    if (isProcessing) return;
    if (step === 2 && structure) setScreen('structure');
    if (step === 3 && structure) setScreen('theme');
  };

  const handleConvert = async (themeIdOverride?: string) => {
    if (!file || !structure) return;

    const effectiveThemeId = themeIdOverride ?? options.themeId;
    setState({ status: 'processing' });

    try {
      const onProgress = (progress: DocxImportProgress) =>
        setState({ status: 'processing', progress });

      const doc = await convertDocxToSemanticDocument(
        file,
        { ...options, themeId: effectiveThemeId },
        structure,
        onProgress,
        parsedDocxHtml ?? undefined,
      );
      setSemanticDoc(doc);

      const result = await semanticDocumentToElpx(
        doc,
        file.name,
        { themeId: effectiveThemeId },
        onProgress,
      );

      setState({ status: 'complete', result });
      setScreen('result');
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido durante la conversión',
      });
    }
  };

  const handleReset = () => {
    setFile(null);
    setStructure(null);
    setSemanticDoc(null);
    setParsedDocxHtml(null);
    setTagIssues([]);
    setScreen('upload');
    setState({ status: 'idle' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const isProcessing = state.status === 'processing';
  const isError = state.status === 'error';

  return (
    <div className="app">
      <AppHeader onThemeManagerClick={() => setScreen('theme-manager')} />

      {/* Barra de pasos — solo en el flujo principal */}
      {screen !== 'theme-manager' && (
        <div className="step-bar">
          <StepIndicator
            currentStep={isProcessing ? 3 : currentStep}
            onStepClick={!isProcessing ? handleStepClick : undefined}
          />
        </div>
      )}

      <main className="container">

        {/* ── Conversión en curso ── */}
        {isProcessing && (
          <div className="conversion-pipeline">
            <div className="pipeline-header">
              <div className="pipeline-spinner" />
              <h2>Convirtiendo documento…</h2>
            </div>
            <div className="pipeline-steps">
              {PIPELINE_PHASES.map((phase) => {
                const activeIdx = phaseIndex(state.progress?.phase);
                const thisIdx = phaseIndex(phase.id);
                const isDone = thisIdx < activeIdx;
                const isActive = phase.id === state.progress?.phase;
                return (
                  <div
                    key={phase.id}
                    className={`pipeline-step${isDone ? ' step-done' : ''}${isActive ? ' step-active' : ''}`}
                  >
                    <div className="pipeline-step-icon">
                      {isDone && (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                          <polyline points="3,8 6.5,11.5 13,5" />
                        </svg>
                      )}
                    </div>
                    <span className="pipeline-step-label">{phase.label}</span>
                    {isActive && state.progress?.message && (
                      <span className="pipeline-phase-msg">{state.progress.message}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {isError && !isProcessing && (
          <div className="error-message">
            <p><strong>Error:</strong> {state.error}</p>
          </div>
        )}

        {/* ── Pantallas del wizard (solo cuando no hay conversión en curso) ── */}
        {!isProcessing && (
          <>
            {file && (screen === 'structure' || screen === 'theme') && (
              <div className="doc-title-banner">
                <img
                  src={`${import.meta.env.BASE_URL}docx.png`}
                  alt=""
                  className="doc-title-icon"
                  aria-hidden="true"
                />
                <div className="doc-title-text">
                  <span className="doc-title-label">Documento</span>
                  <span className="doc-title-name">{file.name}</span>
                </div>
              </div>
            )}

            {screen === 'upload' && (
              <UploadZone onFileSelect={handleFileSelect} />
            )}

            {screen === 'structure' && structure && (
              <StructureConfigurator
                structure={structure}
                tagIssues={tagIssues}
                onConfirm={handleStructureConfirm}
                onCancel={handleStructureCancel}
              />
            )}

            {screen === 'theme' && (
              <ThemeSelector
                onConfirm={handleThemeConfirm}
                onCancel={handleThemeCancel}
              />
            )}

            {screen === 'theme-manager' && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <button onClick={() => setScreen('upload')} className="btn-cancel">
                    ← Volver
                  </button>
                </div>
                <ThemeManager />
              </div>
            )}

            {screen === 'result' && state.result && (
              <div className="result-section">

                {/* Cabecera de éxito */}
                <div className="result-success-card">
                  <div className="result-success-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                  </div>
                  <div className="result-success-body">
                    <h2>Conversión completada</h2>
                    <p>{file?.name}</p>
                  </div>
                </div>

                {/* Estadísticas */}
                <div className="result-stats-card">
                  <div className="stat-item">
                    <span className="stat-label">Páginas</span>
                    <span className="stat-value">{state.result.pageCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Bloques</span>
                    <span className="stat-value">{state.result.blockCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Tema</span>
                    <span className="stat-value" style={{ fontSize: '0.825rem' }}>
                      {ThemeRegistry.get(options.themeId ?? '')?.metadata.name ?? options.themeId}
                    </span>
                  </div>
                </div>

                {/* Descargas */}
                <DownloadButton
                  result={state.result}
                  semanticDoc={semanticDoc}
                  themeId={options.themeId}
                />

                {/* Acción secundaria */}
                <div className="result-actions">
                  <button onClick={handleReset} className="btn-reset">
                    Convertir otro archivo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-logos">
          <a
            href="https://www.ua.es/es/"
            target="_blank"
            rel="noopener noreferrer"
            title="Universidad de Alicante"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo_UA.png`}
              alt="Universidad de Alicante"
              className="footer-ua-logo"
            />
          </a>
          <span className="footer-sep" aria-hidden="true">·</span>
          <a
            href="https://biblioteca.ua.es/es/cid/"
            target="_blank"
            rel="noopener noreferrer"
            title="CID — Competencia Informacional y Digital"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo_CID.png`}
              alt="CID — Centro de Información Documental"
              className="footer-cid-logo"
            />
          </a>
        </div>
        <span className="footer-copy">Biblioteca Universitaria · ConvertidoreXe v0.3.0</span>
      </footer>
    </div>
  );
}
