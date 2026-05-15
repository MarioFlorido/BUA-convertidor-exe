import { useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { StructureConfigurator } from './components/StructureConfigurator';
import { ThemeSelector } from './components/ThemeSelector';
import { ThemeManager } from './components/ThemeManager';
import { DownloadButton } from './components/DownloadButton';
import { AppHeader } from './components/AppHeader';
import { convertDocxToElpx } from './core/docxToElpx';
import { parseDocumentStructure } from './core/parseStructure';
import type { DocxImportOptions, ConversionState, DocxImportProgress, DocumentStructure } from './types';
import './styles/globals.css';

type AppScreen = 'upload' | 'structure' | 'theme' | 'result' | 'theme-manager';

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [screen, setScreen] = useState<AppScreen>('upload');
  const [structure, setStructure] = useState<DocumentStructure | null>(null);
  const [state, setState] = useState<ConversionState>({ status: 'idle' });
  const [options, setOptions] = useState<DocxImportOptions>({
    heading1Mode: 'page',
    heading2Mode: 'page',
    heading3Mode: 'block',
    heading4Mode: 'block',
    themeId: 'base',
  });

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setState({ status: 'idle' });

    try {
      setState({ status: 'processing', progress: { phase: 'read', message: 'Leyendo archivo...' } });
      const buffer = await selectedFile.arrayBuffer();
      const { extractDocxHtml } = await import('./core/docxToElpx');
      const htmlContent = await extractDocxHtml(buffer);

      const parsedStructure = await parseDocumentStructure(htmlContent);
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
    setScreen('upload');
    setState({ status: 'idle' });
  };

  const handleThemeConfirm = (selectedThemeId: string) => {
    setOptions((prev) => ({ ...prev, themeId: selectedThemeId }));
    handleConvert();
  };

  const handleThemeCancel = () => {
    setScreen('structure');
  };

  const handleConvert = async () => {
    if (!file || !structure) return;

    setState({ status: 'processing' });

    try {
      const result = await convertDocxToElpx(file, options, structure, (progress: DocxImportProgress) => {
        setState({ status: 'processing', progress });
      });

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
    setScreen('upload');
    setState({ status: 'idle' });
  };

  return (
    <div className="app">
      <AppHeader onThemeManagerClick={() => setScreen('theme-manager')} />

      <main className="container">
        {screen === 'upload' && <UploadZone onFileSelect={handleFileSelect} />}

        {screen === 'structure' && structure && (
          <StructureConfigurator
            structure={structure}
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
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setScreen('upload')}
              className="btn-cancel"
              style={{ marginBottom: '1rem' }}
            >
              ← Volver
            </button>
            <ThemeManager />
          </div>
        )}

        {state.status === 'processing' && (
          <div className="conversion-progress">
            <h2>Convirtiendo documento...</h2>
            {state.progress && (
              <div className="progress-info">
                <p>
                  <strong>Fase:</strong> {state.progress.phase}
                </p>
                <p>{state.progress.message}</p>
              </div>
            )}
          </div>
        )}

        {screen === 'result' && state.result && (
          <div className="result-section">
            <div className="result-header">
              <h2>Conversión completada</h2>
              <button onClick={handleReset} className="btn-reset">
                Convertir otro archivo
              </button>
            </div>

            <div className="result-stats">
              <p>
                <strong>Archivo:</strong> {file?.name}
              </p>
              <p>
                <strong>Páginas:</strong> {state.result.pageCount}
              </p>
              <p>
                <strong>Bloques:</strong> {state.result.blockCount}
              </p>
              <p>
                <strong>Nombre descarga:</strong> {state.result.filename}
              </p>
            </div>

            <DownloadButton result={state.result} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>ConvertidoreXe v1.0 — Biblioteca Universitaria, Universidad de Alicante</p>
      </footer>
    </div>
  );
}
