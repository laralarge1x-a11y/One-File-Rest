import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px', display: 'block' },
};

const PLAN_COLORS: Record<string, string> = { basic_guard: '#5865F2', fortnightly_defense: '#57F287', proshield_creator: '#FFD700' };
const STATUS_COLORS: Record<string, string> = {
  pending: '#FEE75C', intake: '#5865F2', profile_built: '#9B59B6', appeal_drafted: '#EB459E',
  appeal_submitted: '#57F287', awaiting_tiktok: '#F5A623', won: '#57F287', denied: '#ED4245', closed: '#555',
};

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [portalLink, setPortalLink] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'messages' | 'edit'>('overview');

  const [editForm, setEditForm] = useState({
    plan: '', plan_start: '', plan_expiry: '', discord_channel_id: '', discord_webhook_url: '',
  });

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/clients/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setEditForm({
          plan: data.plan || '',
          plan_start: data.plan_start ? data.plan_start.substring(0, 10) : '',
          plan_expiry: data.plan_expiry ? data.plan_expiry.substring(0, 10) : '',
          discord_channel_id: data.discord_channel_id || '',
          discord_webhook_url: data.discord_webhook_url || '',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (r.ok) {
        const updated = await r.json();
        setProfile({ ...profile, ...updated });
        setSaveMsg('✅ Saved successfully');
        setTimeout(() => setSaveMsg(''), 3000);
      }
    } catch (e) { setSaveMsg('❌ Save failed'); }
    setSaving(false);
  };

  const revokeAccess = async () => {
    if (!confirm(`Revoke access for ${profile?.discord_username}?`)) return;
    setRevoking(true);
    await fetch(`/api/admin/clients/${id}/revoke`, { method: 'POST', credentials: 'include' });
    setProfile({ ...profile, plan: null, plan_start: null, plan_expiry: null });
    setRevoking(false);
  };

  const getPortalLink = async () => {
    const r = await fetch(`/api/admin/clients/${id}/portal-link`, { credentials: 'include' });
    if (r.ok) { const d = await r.json(); setPortalLink(d.portal_link); }
  };

  const regenerateToken = async () => {
    const r = await fetch(`/api/admin/clients/${id}/regenerate-token`, { method: 'POST', credentials: 'include' });
    if (r.ok) { const d = await r.json(); setPortalLink(d.portal_link); }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    await fetch(`/api/admin/clients/${id}/message`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText }),
    });
    setMessageText('');
    setMessageSent(true);
    setTimeout(() => setMessageSent(false), 3000);
  };

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #333', borderTopColor: '#5865F2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#555' }}>Loading client...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );

  if (!profile) return <div style={S.page}><p style={{ color: '#555' }}>Client not found</p></div>;

  const planColor = PLAN_COLORS[profile.plan] || '#666';
  const isExpired = profile.plan_expiry && new Date(profile.plan_expiry) < new Date();

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>

      {/* Back */}
      <button onClick={() => navigate('/admin/clients')} style={{ background: 'none', border: 'none', color: '#5865F2', cursor: 'pointer', fontSize: '13px', marginBottom: '20px', padding: 0 }}>← Back to Clients</button>

      {/* Header */}
      <div style={{ ...S.card, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        {profile.discord_avatar
          ? <img src={`https://cdn.discordapp.com/avatars/${profile.discord_id}/${profile.discord_avatar}.png?size=80`} style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid #1e1e1e' }} alt="" />
          : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', color: '#fff' }}>{(profile.discord_username || '?')[0].toUpperCase()}</div>}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>{profile.discord_username}</h1>
          <div style={{ color: '#555', fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>{profile.discord_id}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {profile.plan
              ? <span style={{ background: `${planColor}22`, color: planColor, padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{profile.plan.replace(/_/g, ' ')}</span>
              : <span style={{ background: '#1a1a1a', color: '#555', padding: '3px 12px', borderRadius: '20px', fontSize: '12px' }}>No Plan</span>}
            {profile.plan && (
              <span style={{ background: isExpired ? '#ED424522' : '#57F28722', color: isExpired ? '#ED4245' : '#57F287', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                {isExpired ? 'Expired' : 'Active'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <button onClick={revokeAccess} disabled={revoking || !profile.plan} style={{ ...S.btn, background: '#ED424520', color: '#ED4245', border: '1px solid #ED424540', opacity: !profile.plan ? 0.4 : 1 }}>
            {revoking ? 'Revoking...' : '⛔ Revoke Access'}
          </button>
          <button onClick={getPortalLink} style={{ ...S.btn, background: '#5865F220', color: '#5865F2', border: '1px solid #5865F240' }}>🔗 Get Portal Link</button>
        </div>
      </div>

      {/* Portal link */}
      {portalLink && (
        <div style={{ ...S.card, marginBottom: '16px', background: '#0d1a0d', border: '1px solid #57F28733' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: '12px', color: '#57F287', wordBreak: 'break-all', fontFamily: 'monospace' }}>{portalLink}</div>
            <button onClick={() => navigator.clipboard.writeText(portalLink)} style={{ ...S.btn, background: '#57F28720', color: '#57F287', border: '1px solid #57F28740', padding: '6px 12px', fontSize: '12px' }}>Copy</button>
            <button onClick={regenerateToken} style={{ ...S.btn, background: '#FEE75C20', color: '#FEE75C', border: '1px solid #FEE75C40', padding: '6px 12px', fontSize: '12px' }}>🔄 Regenerate</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Total Cases', value: profile.case_count ?? 0, color: '#5865F2' },
          { label: 'Won', value: (profile.cases || []).filter((c: any) => c.outcome === 'won').length, color: '#57F287' },
          { label: 'Plan Expiry', value: profile.plan_expiry ? new Date(profile.plan_expiry).toLocaleDateString() : '—', color: isExpired ? '#ED4245' : '#FEE75C' },
          { label: 'Member Since', value: new Date(profile.created_at).toLocaleDateString(), color: '#9B59B6' },
        ].map(s => (
          <div key={s.label} style={{ ...S.card, borderTop: `3px solid ${s.color}` }}>
            <div style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: '22px', fontWeight: '800', marginTop: '6px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['overview', 'cases', 'messages', 'edit'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ ...S.btn, background: activeTab === tab ? '#5865F2' : '#1a1a1a', color: activeTab === tab ? '#fff' : '#666', border: '1px solid ' + (activeTab === tab ? '#5865F2' : '#333'), padding: '7px 16px', fontSize: '12px', textTransform: 'capitalize' }}>{tab}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={S.card}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account Info</div>
            {[
              ['Discord Username', profile.discord_username],
              ['Discord ID', profile.discord_id],
              ['Email', profile.email || '—'],
              ['Role', profile.role || 'client'],
              ['Portal Token', profile.portal_token ? '••••••••' + profile.portal_token.slice(-8) : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #141414', fontSize: '12px' }}>
                <span style={{ color: '#555' }}>{k}</span>
                <span style={{ color: '#ccc', fontFamily: k === 'Discord ID' ? 'monospace' : 'inherit' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Send Direct Message</div>
            {messageSent && <div style={{ background: '#57F28720', border: '1px solid #57F28740', color: '#57F287', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', marginBottom: '10px' }}>✅ Message sent via Discord</div>}
            <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={4}
              placeholder="Send a message to the client via their Discord webhook..."
              style={{ ...S.input, resize: 'none', marginBottom: '10px', lineHeight: '1.5' }} />
            <button onClick={sendMessage} disabled={!messageText.trim()} style={{ ...S.btn, background: '#5865F2', color: '#fff', opacity: !messageText.trim() ? 0.5 : 1 }}>Send via Discord</button>
          </div>
        </div>
      )}

      {activeTab === 'cases' && (
        <div style={S.card}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cases ({(profile.cases || []).length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ color: '#444', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.06em', borderBottom: '1px solid #1e1e1e' }}>
                  {['#', 'Account', 'Violation', 'Status', 'Staff', 'Created', 'Deadline'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(profile.cases || []).length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#444' }}>No cases yet</td></tr>
                ) : (profile.cases || []).map((c: any) => {
                  const sc = STATUS_COLORS[c.status] || '#666';
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #141414' }}>
                      <td style={{ padding: '10px 12px', color: '#555' }}>#{c.id}</td>
                      <td style={{ padding: '10px 12px', color: '#ccc' }}>@{c.account_username || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#aaa' }}>{c.violation_type || '—'}</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ background: `${sc}22`, color: sc, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{c.status}</span></td>
                      <td style={{ padding: '10px 12px', color: '#666' }}>{c.staff_name || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#666' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 12px', color: '#666' }}>{c.appeal_deadline ? new Date(c.appeal_deadline).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div style={S.card}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Messages ({(profile.messages || []).length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
            {(profile.messages || []).length === 0 ? (
              <p style={{ color: '#444', textAlign: 'center', padding: '30px', fontSize: '13px' }}>No messages</p>
            ) : (profile.messages || []).map((m: any) => (
              <div key={m.id} style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.sender_type === 'staff' ? '#5865F2' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                  {m.sender_type === 'staff' ? '👨‍💼' : '👤'}
                </div>
                <div style={{ flex: 1, background: '#1a1a1a', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: m.sender_type === 'staff' ? '#5865F2' : '#888', fontWeight: '600' }}>{m.sender_type} · {m.account_username || ''}</span>
                    <span style={{ fontSize: '10px', color: '#444' }}>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.5' }}>{m.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'edit' && (
        <div style={S.card}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Edit Client</div>
          {saveMsg && <div style={{ background: saveMsg.startsWith('✅') ? '#57F28720' : '#ED424520', border: `1px solid ${saveMsg.startsWith('✅') ? '#57F28740' : '#ED424540'}`, color: saveMsg.startsWith('✅') ? '#57F287' : '#ED4245', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', marginBottom: '14px' }}>{saveMsg}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={S.label}>Plan</label>
              <select style={S.select} value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}>
                <option value="">No Plan</option>
                <option value="basic_guard">Basic Guard</option>
                <option value="fortnightly_defense">Fortnightly Defense</option>
                <option value="proshield_creator">ProShield Creator</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Plan Start Date</label>
              <input type="date" style={S.input} value={editForm.plan_start} onChange={(e) => setEditForm({ ...editForm, plan_start: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>Plan Expiry Date</label>
              <input type="date" style={S.input} value={editForm.plan_expiry} onChange={(e) => setEditForm({ ...editForm, plan_expiry: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>Discord Channel ID</label>
              <input style={S.input} placeholder="e.g. 1234567890123456789" value={editForm.discord_channel_id} onChange={(e) => setEditForm({ ...editForm, discord_channel_id: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.label}>Discord Webhook URL</label>
              <input style={S.input} placeholder="https://discord.com/api/webhooks/..." value={editForm.discord_webhook_url} onChange={(e) => setEditForm({ ...editForm, discord_webhook_url: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={saveEdit} disabled={saving} style={{ ...S.btn, background: '#5865F2', color: '#fff', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            <button onClick={revokeAccess} disabled={revoking || !profile.plan} style={{ ...S.btn, background: '#ED424520', color: '#ED4245', border: '1px solid #ED424540', opacity: !profile.plan ? 0.4 : 1 }}>
              {revoking ? 'Revoking...' : '⛔ Revoke Access'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
