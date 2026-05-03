// Native camera shortcut for the admin Evidence panel inside the APK.
// Renders nothing on the web (where it'd be a duplicate of <input type=file>).
import React, { useState } from 'react';
import { isNative, takePhoto } from '../../lib/native';

export interface MobileCameraButtonProps {
  caseId: number;
  onUploaded?: (evidenceId: number) => void;
  className?: string;
}

const MobileCameraButton: React.FC<MobileCameraButtonProps> = ({ caseId, onUploaded, className }) => {
  const [busy, setBusy] = useState(false);
  if (!isNative()) return null;

  const onTap = async () => {
    setBusy(true);
    try {
      const dataUrl = await takePhoto();
      if (!dataUrl) return;
      const res = await fetch('/api/evidence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          file_name: `camera-${Date.now()}.jpg`,
          file_type: 'image/jpeg',
          base64: dataUrl,
          description: 'Captured from admin app camera',
        }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => null);
        if (j?.id && onUploaded) onUploaded(j.id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onTap}
      disabled={busy}
      className={className}
      style={{
        minHeight: 48,
        padding: '12px 18px',
        borderRadius: 12,
        background: '#5865F2',
        color: '#fff',
        fontWeight: 600,
        border: 'none',
        cursor: busy ? 'wait' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      📷 {busy ? 'Uploading…' : 'Snap photo'}
    </button>
  );
};

export default MobileCameraButton;
