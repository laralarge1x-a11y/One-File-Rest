import React, { useState, useEffect } from 'react';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px', display: 'block' },
};

const SEGMENT_INFO: Record<string, { label: string; desc: string; color: string }> = {
  all: { label: 'All Clients', desc: 'All clients with a webhook configured', color: '#5865F2' },
  basic_guard: { label: 'Basic Guard', desc: 'Clients on the $79/month plan', color: '#5865F2' },
  fortnightly_defense: { label: 'Fortnightly Defense', desc: 'Clients on the $159/2-week plan', color: '#57F287' },
  proshield_creator: { label: 'ProShield Creator', desc: 'Clients on the $259/month plan', color: '#FFD700' },
  expiring_7d: { label: 'Expiring in 7 Days', desc: 'Clients with plans expiring soon', color: '#F5A623' },
};

function DiscordEmbedPreview({ subject, content, segment }: { subject: string; content: string; segment: string }) {
  const seg = SEGMENT_INFO[segment] || SEGMENT_INFO.all;
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ background: '#36393f', borderRadius: '8px', padding: '16px', fontFamily: '"gg sans", system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Bot avatar */}
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5865F2, #EB459E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ color: '#5865F2', fontWeight: '700', fontSize: '14px' }}>Elite Tok Club</span>
            <span style={{ background: '#5865F2', color: '#fff', fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px' }}>BOT</span>
            <span style={{ color: '#72767d', fontSize: '12px' }}>Today at {now}</span>
          </div>
          {/* Embed */}
          <div style={{ background: '#2f3136', borderLeft: `4px solid ${seg.color}`, borderRadius: '4px', padding: '12px 16px', maxWidth: '440px' }}>
            <div style={{ color: '#dcddde', fontSize: '12px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📢 {subject || 'Broadcast Subject'}</div>
            <div style={{ color: '#dcddde', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '120px', overflow: 'hidden' }}>
              {content || 'Your broadcast message will appear here...'}
            </div>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#72767d' }}>Segment: {seg.label}</span>
              <span style={{ fontSize: '11px', color: '#72767d' }}>TikTok Recovery Portal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BulkBroadcast() {
  const [form, setForm] = useState({ subject: '', content: '', target_segment: 'all' });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetch('/api/broadcast', { credentials: 'include' })
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.content.trim()) return;
    setSending(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/broadcast', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        const d = await r.json();
        setResult(d);
        setHistory(prev => [d, ...prev.slice(0, 19)]);
        setForm({ subject: '', content: '', target_segment: 'all' });
      } else {
        const d = await r.json();
        setError(d.error || 'Failed to send broadcast');
      }
    } catch (e) { setError('Network error'); }
    setSending(false);
  };

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 24px' }}>Bulk Broadcast</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left — Form */}
        <div>
          <div style={S.card}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '20px' }}>📢 Compose Broadcast</div>

            {error && <div style={{ background: '#ED424520', border: '1px solid #ED424540', color: '#ED4245', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            {result && (
              <div style={{ background: '#57F28720', border: '1px solid #57F28740', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                <div style={{ color: '#57F287', fontWeight: '700', fontSize: '13px' }}>✅ Broadcast Sent!</div>
                <div style={{ color: '#57F287', fontSize: '12px', marginTop: '4px' }}>{result.users_targeted ?? 0} recipients targeted</div>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={S.label}>Target Segment</label>
                <select style={S.select} value={form.target_segment} onChange={(e) => setForm({ ...form, target_segment: e.target.value })}>
                  {Object.entries(SEGMENT_INFO).map(([value, info]) => (
                    <option key={value} value={value}>{info.label} — {info.desc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={S.label}>Subject / Title</label>
                <input style={S.input} placeholder="e.g. Important TikTok Policy Update" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              </div>

              <div>
                <label style={S.label}>Message Content</label>
                <textarea
                  style={{ ...S.input, resize: 'vertical', minHeight: '160px', lineHeight: '1.6' }}
                  placeholder="Write your message here. Supports plain text. Will be sent as a Discord embed to all matching clients."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  required
                />
              </div>

              <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEGMENT_INFO[form.target_segment]?.color || '#5865F2' }} />
                <span style={{ fontSize: '12px', color: '#888' }}>Sending to: <strong style={{ color: '#ccc' }}>{SEGMENT_INFO[form.target_segment]?.label}</strong> — {SEGMENT_INFO[form.target_segment]?.desc}</span>
              </div>

              <button type="submit" disabled={sending || !form.subject.trim() || !form.content.trim()}
                style={{ ...S.btn, background: '#5865F2', color: '#fff', opacity: (sending || !form.subject.trim() || !form.content.trim()) ? 0.6 : 1 }}>
                {sending ? '⏳ Sending...' : '📢 Send Broadcast'}
              </button>
            </form>
          </div>
        </div>

        {/* Right — Live Discord Preview */}
        <div>
          <div style={S.card}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>👁 Discord Preview (Live)</div>
            <DiscordEmbedPreview subject={form.subject} content={form.content} segment={form.target_segment} />
          </div>

          {/* Broadcast history */}
          <div style={{ ...S.card, marginTop: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '14px' }}>📋 Recent Broadcasts</div>
            {historyLoading ? (
              <div style={{ color: '#444', fontSize: '13px' }}>Loading...</div>
            ) : history.length === 0 ? (
              <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No broadcasts yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                {history.map((b, i) => (
                  <div key={b.id || i} style={{ background: '#1a1a1a', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#fff' }}>{b.subject}</span>
                      <span style={{ fontSize: '11px', color: '#555' }}>{new Date(b.sent_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>{b.content?.substring(0, 80)}...</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                      <span style={{ color: '#5865F2' }}>→ {b.recipient_count ?? 0} targeted</span>
                      <span style={{ color: '#57F287' }}>✅ {b.delivered_count ?? 0} delivered</span>
                      {b.failed_count > 0 && <span style={{ color: '#ED4245' }}>❌ {b.failed_count} failed</span>}
                      <span style={{ color: '#666', background: '#2a2a2a', padding: '0 6px', borderRadius: '4px' }}>{b.target_segment?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
