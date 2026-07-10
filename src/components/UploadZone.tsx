import React, { useRef, useState } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  /** Si se suelta un .elp del eXeLearning clásico, permite saltar al conversor. */
  onOpenConversorElp?: () => void;
}

export function UploadZone({ onFileSelect, onOpenConversorElp }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isElpFile, setIsElpFile] = useState(false);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx')) {
      setFileError(null);
      setIsElpFile(false);
      onFileSelect(file);
    } else if (name.endsWith('.elp')) {
      setIsElpFile(true);
      setFileError(
        'Esto es un paquete del eXeLearning clásico. Conviértelo antes a Word con el Conversor de eXe antiguo.',
      );
    } else {
      setIsElpFile(false);
      setFileError('El archivo debe ser .docx');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  return (
    <div className="upload-zone-wrapper">
      <div
        className="upload-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Área de carga de documento Word"
      >
        <div className="upload-content">
          <img
            src={`${import.meta.env.BASE_URL}img/docx.png`}
            alt=""
            className="upload-icon"
            aria-hidden="true"
          />
          <h2>Sube tu documento Word</h2>
          <p>Arrastra y suelta un archivo .docx o haz clic para seleccionar</p>

          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            tabIndex={-1}
          />

          <button
            className="btn-upload"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Seleccionar archivo
          </button>

          {fileError && (
            <p className="upload-file-error">{fileError}</p>
          )}

          {isElpFile && onOpenConversorElp && (
            <button
              className="btn-cancel"
              onClick={(e) => {
                e.stopPropagation();
                onOpenConversorElp();
              }}
            >
              Abrir el Conversor de eXe antiguo
            </button>
          )}
        </div>
      </div>

      <div className="upload-disclaimer">
        <p>
          <a href={`${import.meta.env.BASE_URL}docs/licencia.html`} target="_blank" rel="noopener noreferrer">
            GNU GPL v3.0
          </a>
          {' · '}
          <a href={`${import.meta.env.BASE_URL}docs/arquitectura.html`} target="_blank" rel="noopener noreferrer">
            Arquitectura
          </a>
          {' · '}
          <a href={`${import.meta.env.BASE_URL}docs/README.html`} target="_blank" rel="noopener noreferrer">
            Léeme
          </a>
        </p>
      </div>
    </div>
  );
}
