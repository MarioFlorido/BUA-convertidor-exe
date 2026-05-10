import React, { useRef } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
        onFileSelect(file);
      } else {
        alert('Por favor, sube un archivo .docx válido');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="upload-zone" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="upload-content">
        <h2>Sube tu archivo Word</h2>
        <p>Arrastra y suelta un archivo .docx o haz click para seleccionar</p>

        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        <button className="btn-upload" onClick={() => inputRef.current?.click()}>
          Seleccionar archivo
        </button>

        <div className="upload-help">
          <p>Tamaño máximo recomendado: 20 MB</p>
          <p>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Descargar plantilla Word
            </a>{' '}
            |{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>
              Ver guía de preparación
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
