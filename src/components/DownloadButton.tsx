import React from 'react';
import type { ImportToElpxResult } from '../types';

interface DownloadButtonProps {
  result: ImportToElpxResult;
}

export function DownloadButton({ result }: DownloadButtonProps) {
  const handleDownload = () => {
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleDownload} className="btn-download">
      Descargar {result.filename}
    </button>
  );
}
