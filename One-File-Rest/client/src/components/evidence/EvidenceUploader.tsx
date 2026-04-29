import React, { useRef, useState } from 'react';

interface EvidenceUploaderProps {
  onUpload: (files: File[]) => void;
  maxSize?: number;
  acceptedTypes?: string[];
}

export default function EvidenceUploader({
  onUpload,
  maxSize = 10 * 1024 * 1024,
  acceptedTypes = ['image/*', 'application/pdf', 'video/*'],
}: EvidenceUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: FileList) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    for (const file of fileArray) {
      if (file.size > maxSize) {
        setError(`File ${file.name} is too large`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onUpload(validFiles);
      setError(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-gray-600 mb-2">Drag and drop files here or click to select</p>
        <p className="text-sm text-gray-500">Supported: Images, PDFs, Videos (Max 10MB)</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}

interface EvidenceGridProps {
  files: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    uploadedAt: string;
  }>;
  onDelete?: (id: string) => void;
}

export function EvidenceGrid({ files, onDelete }: EvidenceGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {files.map((file) => (
        <div key={file.id} className="bg-white rounded-lg shadow p-4">
          <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center">
            {file.type.startsWith('image') ? (
              <img src={file.url} alt={file.name} className="w-full h-full object-cover rounded" />
            ) : (
              <p className="text-gray-600 text-sm">{file.type}</p>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
          <p className="text-xs text-gray-500">{file.uploadedAt}</p>
          {onDelete && (
            <button
              onClick={() => onDelete(file.id)}
              className="mt-2 w-full text-red-600 hover:text-red-900 text-sm font-semibold"
            >
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

interface EvidenceViewerProps {
  file: {
    name: string;
    type: string;
    url: string;
  };
  onClose: () => void;
}

export function EvidenceViewer({ file, onClose }: EvidenceViewerProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">{file.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {file.type.startsWith('image') ? (
            <img src={file.url} alt={file.name} className="w-full" />
          ) : file.type === 'application/pdf' ? (
            <iframe src={file.url} className="w-full h-96" />
          ) : file.type.startsWith('video') ? (
            <video src={file.url} controls className="w-full" />
          ) : (
            <p className="text-gray-600">Preview not available</p>
          )}
        </div>
      </div>
    </div>
  );
}
