import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px', display: 'block' },
};

const ROLE_COLORS: Record<string, string> = {
  owner: '#FFD700', admin: '#EB459E', case_manager: '#5865F2', support: '#57F287',
};

export default function StaffManagement() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ discord_id: '', name: '', role: 'support' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);

  const isAdmin = user && ['admin', 'owner'].includes(user.role);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/staff', { credentials: 'include' });
      if (r.ok) setStaff(await r.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.discord_id.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const r = await fetch('/api/admin/staff', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (r.ok) {
        await fetchStaff();
        setAddForm({ discord_id: '', name: '', role: 'support' });
        setShowAddForm(false);
      } else {
        const d = await r.json();
        setAddError(d.error || 'Failed to add staff');
      }
    } catch (e) { setAddError('Network error'); }
    setAdding(false);
  };

  const removeStaff = async (id: number) => {
    if (!confirm('Remove this staff member?')) return;
    setRemovingId(id);
    await fetch(`/api/admin/staff/${id}`, { method: 'DELETE', credentials: 'include' });
    setStaff(prev => prev.filter(s => s.id !== id));
    setRemovingId(null);
  };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>
          Staff Management <span style={{ color: '#444', fontSize: '14px', fontWeight: '400' }}>({staff.length})</span>
        </h1>
        {isAdmin && (
          <button onClick={() => setShowAddForm(!showAddForm)} style={{ ...S.btn, background: '#5865F2', color: '#fff' }}>+ Add Staff</button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && isAdmin && (
        <div style={{ ...S.card, marginBottom: '20px', border: '1px solid #5865F230', background: '#0d0d1a' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#5865F2', marginBottom: '16px' }}>Add Staff Member</div>
          {addError && <div style={{ background: '#ED424520', border: '1px solid #ED424540', color: '#ED4245', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>{addError}</div>}
          <form onSubmit={addStaff}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
              <div>
                <label style={S.label}>Discord ID *</label>
                <input style={S.input} placeholder="e.g. 123456789012345678" value={addForm.discord_id} onChange={(e) => setAddForm({ ...addForm, discord_id: e.target.value })} required />
              </div>
              <div>
                <label style={S.label}>Display Name</label>
                <input style={S.input} placeholder="e.g. John Smith" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Role</label>
                <select style={S.select} value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                  <option value="support">Support</option>
                  <option value="case_manager">Case Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={adding} style={{ ...S.btn, background: '#5865F2', color: '#fff', opacity: adding ? 0.7 : 1 }}>{adding ? 'Adding...' : 'Add'}</button>
                <button type="button" onClick={() => setShowAddForm(false)} style={{ ...S.btn, background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Staff grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#444' }}>Loading staff...</div>
      ) : staff.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px', color: '#444' }}>No staff members yet</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {staff.map((member) => {
            const roleColor = ROLE_COLORS[member.role] || '#666';
            return (
              <div key={member.id} style={{ ...S.card, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  {member.discord_avatar
                    ? <img src={`https://cdn.discordapp.com/avatars/${member.discord_id}/${member.discord_avatar}.png?size=48`} style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${roleColor}` }} alt="" />
                    : <div style={{ width: 48, height: 48, borderRadius: '50%', background: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#0a0a0a', border: `2px solid ${roleColor}` }}>{(member.name || member.discord_id)[0].toUpperCase()}</div>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{member.name || member.discord_id}</div>
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ background: `${roleColor}22`, color: roleColor, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>{member.role}</span>
                    </div>
                  </div>
                  {isAdmin && member.discord_id !== user?.discord_id && (
                    <button onClick={() => removeStaff(member.id)} disabled={removingId === member.id}
                      style={{ background: '#ED424510', border: '1px solid #ED424530', color: '#ED4245', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
                      {removingId === member.id ? '...' : 'Remove'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Active Cases', value: member.active_cases ?? '—', color: '#FEE75C' },
                    { label: 'Resolved', value: member.resolved_cases ?? '—', color: '#57F287' },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: '#1a1a1a', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: '10px', color: '#555', marginTop: '2px', textTransform: 'uppercase', fontWeight: '600' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '12px', fontSize: '11px', color: '#444', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace' }}>{member.discord_id}</span>
                  <span>Added {new Date(member.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
