// Bottom sheet shown when the admin APK receives a Share intent from
// another app (TikTok, Discord, Photos, etc). Lets the staffer pick which
// case to attach the file/text to, then uploads it.
import React, { useEffect, useState } from 'react';
import { SharedIntent } from '../../lib/native';

interface AdminCase {
  id: number;
  account_username?: string | null;
  status?: string;
  user_discord_id?: string;
}

export interface SharedFileSheetProps {
  intent: SharedIntent | null;
  onClose: () => void;
}

const SharedFileSheet: React.FC<SharedFileSheetProps> = ({ intent, onClose }) => {
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!intent) return;
    fetch('/api/admin/cases?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { cases: [] }))
      .then((d) => setCases(Array.isArray(d) ? d : (d.cases || [])))
      .catch(() => setCases([]));
  }, [intent]);

  if (!intent) return null;

  const sharedFileUri = intent.additionalItems?.[0]?.uri || null;
  const sharedText = intent.text || intent.url || intent.title || '';

  const attach = async (caseId: number) => {
    setBusy(true);
    try {
      if (sharedFileUri) {
        // Convert content:// URI to base64 via fetch (Capacitor exposes these as readable URLs)
        const r = await fetch(sharedFileUri).catch(() => null);
        const blob = r ? await r.blob() : null;
        if (blob) {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          await fetch('/api/evidence', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              case_id: caseId,
              file_name: intent.title || `shared-${Date.now()}`,
              file_type: blob.type || 'application/octet-stream',
              base64,
              description: 'Shared from another app',
            }),
          });
        }
      }
      if (sharedText) {
        await fetch('/api/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: caseId, content: sharedText, type: 'staff' }),
        });
      }
      onClose();
      window.location.assign(`/admin/cases/${caseId}`);
    } finally {
      setBusy(false);
    }
  };

  const filtered = cases.filter((c) => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    return (c.account_username || '').toLowerCase().includes(q) || String(c.id).includes(q);
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'hidden',
          background: '#1a1a1a', color: '#fff',
          borderRadius: '20px 20px 0 0', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>Attach to case</h3>
        <div style={{ fontSize: 13, color: '#999' }}>
          {sharedFileUri && <>📎 File: {intent.title || sharedFileUri.split('/').pop()}<br /></>}
          {sharedText && <>💬 Text: {sharedText.slice(0, 80)}{sharedText.length > 80 ? '…' : ''}</>}
        </div>
        <input
          type="search"
          placeholder="Search by username or case #"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            minHeight: 44, padding: '10px 14px', borderRadius: 10,
            background: '#0a0a0a', color: '#fff', border: '1px solid #333',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1, marginTop: 4 }}>
          {filtered.length === 0 && <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>No cases found</div>}
          {filtered.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              onClick={() => attach(c.id)}
              style={{
                width: '100%', minHeight: 56, padding: '12px 14px',
                background: 'transparent', color: '#fff', textAlign: 'left',
                border: 'none', borderBottom: '1px solid #2a2a2a', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>#{c.id} · {c.account_username || '(no username)'}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{c.status}</div>
              </div>
              <span style={{ color: '#5865F2' }}>Attach →</span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            minHeight: 48, marginTop: 4,
            background: '#2a2a2a', color: '#fff', border: 'none',
            borderRadius: 10, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SharedFileSheet;
