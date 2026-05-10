import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

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
      if (file.size > maxSize) { setError(`File ${file.name} is too large (max 10MB)`); continue; }
      validFiles.push(file);
    }
    if (validFiles.length > 0) { onUpload(validFiles); setError(null); }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)', padding: 24, textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s', background: dragActive ? 'rgba(88,101,242,0.06)' : 'transparent',
        }}
      >
        <Upload size={24} style={{ color: dragActive ? 'var(--accent)' : 'var(--text-muted)', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {dragActive ? 'Drop files here' : 'Drag & drop evidence here'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          or click to browse · Images, PDFs, Videos (max 10MB)
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple accept={acceptedTypes.join(',')}
        onChange={(e) => e.target.files && handleFiles(e.target.files)} style={{ display: 'none' }} />
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
    </div>
  );
}

interface EvidenceGridProps {
  files: Array<{ id: string; name: string; type: string; url: string; uploadedAt: string }>;
  onDelete?: (id: string) => void;
}

export function EvidenceGrid({ files, onDelete }: EvidenceGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {files.map((file) => (
        <div key={file.id} style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          <div style={{ aspectRatio: '1', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {file.type.startsWith('image') ? (
              <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{file.type}</div>
            )}
          </div>
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{file.uploadedAt}</div>
            {onDelete && (
              <button onClick={() => onDelete(file.id)}
                style={{ marginTop: 6, fontSize: 11, color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface EvidenceViewerProps {
  file: { name: string; type: string; url: string };
  onClose: () => void;
}

export function EvidenceViewer({ file, onClose }: EvidenceViewerProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ maxWidth: 800, width: '100%', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          {file.type.startsWith('image') ? (
            <img src={file.url} alt={file.name} className="w-full rounded" />
          ) : file.type === 'application/pdf' ? (
            <iframe src={file.url} className="w-full h-96" style={{ border: 'none', borderRadius: 8 }} />
          ) : file.type.startsWith('video') ? (
            <video src={file.url} controls className="w-full rounded" />
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Preview not available</div>
          )}
        </div>
      </div>
    </div>
  );
}
