import React, { useRef, useState } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.docx')) {
        setFileError(null);
        onFileSelect(file);
      } else {
        setFileError('El archivo debe ser .docx');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileError(null);
      onFileSelect(e.target.files[0]);
    }
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
            src={`${import.meta.env.BASE_URL}docx.png`}
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
        </div>
      </div>

      <div className="upload-disclaimer">
        <p>
          Inspirado en el trabajo de{' '}
          <a href="https://hackexe.tiddlyhost.com/#HACKeXe:HACKeXe" target="_blank" rel="noopener noreferrer">
            Juanjo de Haro
          </a>
          {' · '}
          <a href="https://github.com/MarioFlorido/BUA-convertidor-exe/blob/main/docs/COMPARISON.md" target="_blank" rel="noopener noreferrer">
            Agradecimientos
          </a>
          {' · '}
          <a href="https://github.com/MarioFlorido/BUA-convertidor-exe/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
            GNU GPL v3.0
          </a>
          {' · '}
          <a href={`${import.meta.env.BASE_URL}docs/README.html`} target="_blank" rel="noopener noreferrer">
            README
          </a>
        </p>
      </div>
    </div>
  );
}
