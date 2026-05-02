import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAccounts, TiktokAccount } from '../../lib/accounts';

export default function AccountSwitcher({ compact }: { compact?: boolean }) {
  const { accounts, active, setActive, refresh } = useAccounts();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAdding(false); }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/accounts', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim(), account_url: url.trim() || null, is_primary: accounts.length === 0 }),
      });
      if (r.ok) {
        const data = await r.json();
        await refresh();
        setActive(data.id);
        setName(''); setUrl(''); setAdding(false);
      }
    } finally { setBusy(false); }
  };

  if (accounts.length === 0 && !adding) {
    return (
      <button onClick={() => { setOpen(true); setAdding(true); }} style={{
        ...btnStyle, fontSize: 12,
      }} ref={ref as any}>
        + Add TikTok account
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        ...btnStyle,
        background: open ? 'var(--bg-glass-hover)' : 'var(--bg-glass)',
        maxWidth: compact ? 140 : 200,
      }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>🎯</span>
        <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.username || 'Pick account'}
        </span>
        {active?.is_primary && <span style={{ fontSize: 9, color: '#FFD700' }}>★</span>}
        <svg width="9" height="6" viewBox="0 0 12 8"><path d="M6 8L0 0h12z" fill="rgba(255,255,255,0.5)" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              minWidth: 260, background: 'rgba(20,20,20,0.96)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              zIndex: 1000,
            }}
          >
            <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Your TikTok Accounts
            </div>
            {accounts.map((a: TiktokAccount) => (
              <button key={a.id} onClick={() => { setActive(a.id); setOpen(false); }} style={{
                ...rowStyle,
                background: a.id === active?.id ? 'rgba(88,101,242,0.2)' : 'transparent',
                color: a.id === active?.id ? '#fff' : 'var(--text-secondary)',
              }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.username}
                    {a.is_primary && <span style={{ fontSize: 10, color: '#FFD700' }}>★</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {a.active_cases ?? 0} active case{a.active_cases === 1 ? '' : 's'}
                  </div>
                </div>
                {a.id === active?.id && <span style={{ color: '#57F287', fontSize: 12 }}>✓</span>}
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            {!adding ? (
              <button onClick={() => setAdding(true)} style={{ ...rowStyle, color: 'var(--accent)' }}>
                + Add another account
              </button>
            ) : (
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  autoFocus
                  placeholder="Username (without @)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Profile URL (optional)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={add} disabled={busy || !name.trim()} style={{ ...btnStyle, background: '#5865F2', flex: 1, opacity: busy ? 0.6 : 1 }}>
                    {busy ? 'Adding…' : 'Add'}
                  </button>
                  <button onClick={() => { setAdding(false); setName(''); setUrl(''); }} style={{ ...btnStyle, flex: 1 }}>Cancel</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 10px', borderRadius: 999,
  background: 'var(--bg-glass)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', cursor: 'pointer',
  transition: 'var(--transition)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '8px 10px', borderRadius: 6,
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 500, transition: 'background 0.1s',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 12,
  background: '#0a0a0a', border: '1px solid var(--border)',
  borderRadius: 6, color: '#fff', outline: 'none',
};
