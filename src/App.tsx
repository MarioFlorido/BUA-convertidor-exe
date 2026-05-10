import React, { useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { ConfigPanel } from './components/ConfigPanel';
import { DownloadButton } from './components/DownloadButton';
import { AppHeader } from './components/AppHeader';
import { convertDocxToElpx } from './core/docxToElpx';
import type { DocxImportOptions, ConversionState, DocxImportProgress } from './types';
import './styles/globals.css';

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ConversionState>({ status: 'idle' });
  const [options, setOptions] = useState<DocxImportOptions>({
    heading1Mode: 'page',
    heading2Mode: 'page',
    heading3Mode: 'block',
    heading4Mode: 'block',
  });

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setState({ status: 'idle' });
  };

  const handleConvert = async () => {
    if (!file) return;

    setState({ status: 'processing' });

    try {
      const result = await convertDocxToElpx(file, options, (progress: DocxImportProgress) => {
        setState({ status: 'processing', progress });
      });

      setState({ status: 'complete', result });
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido durante la conversión',
      });
    }
  };

  const handleReset = () => {
    setFile(null);
    setState({ status: 'idle' });
  };

  return (
    <div className="app">
      <AppHeader />

      <main className="container">
        {!file ? (
          <UploadZone onFileSelect={handleFileSelect} />
        ) : state.status === 'complete' && state.result ? (
          <div className="result-section">
            <div className="result-header">
              <h2>Conversión completada</h2>
              <button onClick={handleReset} className="btn-reset">
                Convertir otro archivo
              </button>
            </div>

            <div className="result-stats">
              <p>
                <strong>Archivo:</strong> {file.name}
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
        ) : (
          <div className="conversion-section">
            <div className="section-left">
              <h2>Opciones de conversión</h2>
              <ConfigPanel options={options} onOptionsChange={setOptions} />

              <div className="conversion-actions">
                <button onClick={handleConvert} className="btn-convert" disabled={state.status === 'processing'}>
                  {state.status === 'processing' ? 'Convirtiendo...' : 'Convertir a elpx'}
                </button>
                <button onClick={handleReset} className="btn-cancel">
                  Cancelar
                </button>
              </div>

              {state.status === 'error' && (
                <div className="error-message">
                  <p>Error: {state.error}</p>
                </div>
              )}
            </div>

            <div className="section-right">
              <h2>Progreso</h2>
              {state.progress ? (
                <div className="progress-info">
                  <p>
                    <strong>Fase:</strong> {state.progress.phase}
                  </p>
                  <p>{state.progress.message}</p>
                </div>
              ) : (
                <p className="placeholder">Inicia la conversión para ver el progreso</p>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>ConvertidoreXe v1.0 — Biblioteca Universitaria, Universidad de Alicante</p>
      </footer>
    </div>
  );
}
