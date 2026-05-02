import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
};

const PLAN_COLORS: Record<string, string> = {
  basic_guard: '#5865F2', fortnightly_defense: '#57F287', proshield_creator: '#FFD700',
};
const PLAN_LABELS: Record<string, string> = {
  basic_guard: 'Basic Guard', fortnightly_defense: 'Fortnightly Defense', proshield_creator: 'ProShield Creator',
};

function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return <span style={{ color: '#444', fontSize: '11px' }}>No Plan</span>;
  const c = PLAN_COLORS[plan] || '#666';
  return <span style={{ background: `${c}22`, color: c, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{PLAN_LABELS[plan] || plan}</span>;
}

function ExpiryBadge({ expiry }: { expiry: string | null }) {
  if (!expiry) return <span style={{ color: '#444', fontSize: '12px' }}>—</span>;
  const diff = new Date(expiry).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  let color = '#57F287';
  let label = new Date(expiry).toLocaleDateString();
  if (diff < 0) { color = '#ED4245'; label = 'Expired'; }
  else if (days <= 7) { color = '#F5A623'; label = `${days}d left`; }
  return <span style={{ color, fontWeight: '600', fontSize: '12px' }}>{label}</span>;
}

export default function ClientList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterPlan !== 'all') params.set('plan', filterPlan);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const r = await fetch(`/api/admin/clients?${params}`, { credentials: 'include' });
      if (r.ok) setClients(await r.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, filterPlan, filterStatus]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const exportCSV = () => {
    const headers = ['ID', 'Username', 'Discord ID', 'Plan', 'Plan Start', 'Expiry', 'Cases', 'Last Active'];
    const rows = clients.map(c => [c.id, c.discord_username, c.discord_id, c.plan || '', c.plan_start || '', c.plan_expiry || '', c.case_count || 0, c.last_active || '']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'clients.csv';
    a.click();
  };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>
          Clients <span style={{ color: '#444', fontSize: '14px', fontWeight: '400' }}>({clients.length})</span>
        </h1>
        <button onClick={exportCSV} style={{ ...S.btn, background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>⬇ Export CSV</button>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Search username or Discord ID..."
          style={{ ...S.input, flex: '1', minWidth: '200px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchClients()}
        />
        <select style={S.select} value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
          <option value="all">All Plans</option>
          <option value="basic_guard">Basic Guard</option>
          <option value="fortnightly_defense">Fortnightly Defense</option>
          <option value="proshield_creator">ProShield Creator</option>
        </select>
        <select style={S.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="no_plan">No Plan</option>
        </select>
        <button onClick={fetchClients} style={{ ...S.btn, background: '#5865F2', color: '#fff' }}>Search</button>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ color: '#444', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.06em', borderBottom: '1px solid #1e1e1e' }}>
                {['Client', 'Discord ID', 'Plan', 'Plan Start', 'Expiry', 'Cases', 'Last Active', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#444' }}>Loading...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#444' }}>No clients found</td></tr>
              ) : clients.map((c) => {
                const isExpired = c.plan_expiry && new Date(c.plan_expiry) < new Date();
                const hasNoPlan = !c.plan;
                const statusLabel = hasNoPlan ? 'No Plan' : isExpired ? 'Expired' : 'Active';
                const statusColor = hasNoPlan ? '#444' : isExpired ? '#ED4245' : '#57F287';
                return (
                  <tr key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #141414' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#151515')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {c.discord_avatar
                          ? <img src={`https://cdn.discordapp.com/avatars/${c.discord_id}/${c.discord_avatar}.png?size=28`} style={{ width: 28, height: 28, borderRadius: '50%' }} alt="" />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>{(c.discord_username || '?')[0].toUpperCase()}</div>}
                        <span style={{ color: '#fff', fontWeight: '500' }}>{c.discord_username}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#555', fontFamily: 'monospace', fontSize: '11px' }}>{c.discord_id}</td>
                    <td style={{ padding: '10px 12px' }}><PlanBadge plan={c.plan} /></td>
                    <td style={{ padding: '10px 12px', color: '#666' }}>{c.plan_start ? new Date(c.plan_start).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px' }}><ExpiryBadge expiry={c.plan_expiry} /></td>
                    <td style={{ padding: '10px 12px', color: '#888' }}>{c.case_count ?? 0}</td>
                    <td style={{ padding: '10px 12px', color: '#666' }}>{c.last_active ? new Date(c.last_active).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: `${statusColor}22`, color: statusColor, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{statusLabel}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#5865F2', fontSize: '12px' }}>View →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
