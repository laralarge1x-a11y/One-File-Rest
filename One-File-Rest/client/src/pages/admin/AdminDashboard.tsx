import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  heading: { fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '24px' } as React.CSSProperties,
  grid6: { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '14px', marginBottom: '24px' } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  label: { color: '#666', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' } as React.CSSProperties,
  value: { fontSize: '26px', fontWeight: '800', marginTop: '6px', lineHeight: 1 } as React.CSSProperties,
};

const PLAN_COLORS: Record<string, string> = {
  basic_guard: '#5865F2', fortnightly_defense: '#57F287', proshield_creator: '#FFD700',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#FEE75C', intake: '#5865F2', profile_built: '#9B59B6', appeal_drafted: '#EB459E',
  appeal_submitted: '#57F287', awaiting_tiktok: '#F5A623', won: '#57F287', denied: '#ED4245', closed: '#666',
};

function TimeAgo({ date }: { date: string }) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return <>{diff}s ago</>;
  if (diff < 3600) return <>{Math.floor(diff / 60)}m ago</>;
  if (diff < 86400) return <>{Math.floor(diff / 3600)}h ago</>;
  return <>{Math.floor(diff / 86400)}d ago</>;
}

function Countdown({ deadline }: { deadline: string }) {
  const d = new Date(deadline);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return <span style={{ color: '#ED4245', fontWeight: '700' }}>OVERDUE</span>;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const days = Math.floor(hrs / 24);
  const color = diff < 24 * 3600000 ? '#ED4245' : diff < 72 * 3600000 ? '#FEE75C' : '#57F287';
  return <span style={{ color, fontWeight: '700' }}>{days > 0 ? `${days}d ` : ''}{hrs % 24}h {mins}m</span>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [needsAttention, setNeedsAttention] = useState<{ deadlines: any[]; stale: any[]; unreplied: any[] }>({ deadlines: [], stale: [], unreplied: [] });
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [statsR, activityR, alertsR, casesR, attentionR] = await Promise.all([
        fetch('/api/admin/stats', { credentials: 'include' }),
        fetch('/api/admin/activity', { credentials: 'include' }),
        fetch('/api/admin/alerts', { credentials: 'include' }),
        fetch('/api/admin/cases?limit=10', { credentials: 'include' }),
        fetch('/api/admin/needs-attention', { credentials: 'include' }),
      ]);
      if (statsR.ok) setStats(await statsR.json());
      if (activityR.ok) setActivity(await activityR.json());
      if (alertsR.ok) setAlerts(await alertsR.json());
      if (casesR.ok) { const d = await casesR.json(); setRecentCases(d.cases || []); }
      if (attentionR.ok) {
        const d = await attentionR.json();
        setNeedsAttention({ deadlines: d.deadlines || [], stale: d.stale || [], unreplied: d.unreplied || [] });
      }
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(() => { fetchAll(); }, 10000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const r = await fetch('/api/admin/weekly-report', { method: 'POST', credentials: 'include' });
      const d = await r.json();
      setReport(d.report || '');
    } catch (err) { console.error('Report error:', err); }
    setReportLoading(false);
  };

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #333', borderTopColor: '#5865F2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#666' }}>Loading dashboard...</p>
      </div>
    </div>
  );

  const statCards = [
    { label: 'Total Clients', value: stats?.totalClients ?? 0, color: '#5865F2' },
    { label: 'Active Cases', value: stats?.activeCases ?? 0, color: '#FEE75C' },
    { label: 'Resolved (Month)', value: stats?.resolvedThisMonth ?? 0, color: '#57F287' },
    { label: 'Expiring Soon', value: stats?.expiringSoon ?? 0, color: stats?.expiringSoon > 0 ? '#F5A623' : '#57F287' },
    { label: 'Total Revenue', value: `$${(stats?.totalRevenue ?? 0).toLocaleString()}`, color: '#EB459E' },
    { label: 'Avg Resolution', value: `${stats?.avgResolutionHours ?? 0}h`, color: '#9B59B6' },
  ];

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ ...S.heading, marginBottom: '4px' }}>Overview</h1>
          <p style={{ color: '#555', fontSize: '13px' }}>Welcome back, {user?.discord_username}. Here's what's happening.</p>
        </div>
        <div style={{ fontSize: '12px', color: '#444' }}>Auto-refreshing every 10s</div>
      </div>

      {/* Needs Attention */}
      {(needsAttention.deadlines.length + needsAttention.stale.length + needsAttention.unreplied.length) > 0 && (
        <div style={{ ...S.card, marginBottom: 24, borderLeft: '3px solid #ED4245' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ED4245' }}>
              🚨 Needs Attention
              <span style={{ marginLeft: 8, fontSize: 11, color: '#888', fontWeight: 500 }}>
                {needsAttention.deadlines.length} urgent · {needsAttention.stale.length} stale · {needsAttention.unreplied.length} unreplied
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {[
              { title: 'Deadline < 24h', items: needsAttention.deadlines, color: '#ED4245', kind: 'deadline' as const },
              { title: 'Stale > 12h', items: needsAttention.stale, color: '#F5A623', kind: 'stale' as const },
              { title: 'New client messages', items: needsAttention.unreplied, color: '#FEE75C', kind: 'unreplied' as const },
            ].map((bucket) => (
              <div key={bucket.title} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: bucket.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  {bucket.title} ({bucket.items.length})
                </div>
                {bucket.items.length === 0 ? (
                  <div style={{ color: '#444', fontSize: 12 }}>All clear</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {bucket.items.slice(0, 6).map((c: any) => {
                      const subtitle =
                        bucket.kind === 'deadline'
                          ? <>Deadline <Countdown deadline={c.appeal_deadline} /></>
                          : bucket.kind === 'stale'
                            ? `Waiting ${Math.round(Number(c.stale_hours) || 0)}h on staff reply`
                            : `${c.unread_count || 1} new message${(c.unread_count || 1) === 1 ? '' : 's'}`;
                      return (
                        <button key={c.id} onClick={() => navigate(`/admin/cases/${c.id}`)} style={{
                          textAlign: 'left', padding: 8, borderRadius: 6,
                          background: '#111', border: '1px solid #1f1f1f', color: '#fff', cursor: 'pointer',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            #{c.id} · @{c.account_username || c.discord_username}
                          </div>
                          <div style={{ fontSize: 10, color: '#888', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {c.violation_type && (
                              <span style={{ padding: '1px 6px', borderRadius: 4, background: '#1f1f1f', color: '#bbb' }}>
                                {String(c.violation_type).replace(/_/g, ' ')}
                              </span>
                            )}
                            {c.plan && (
                              <span style={{ padding: '1px 6px', borderRadius: 4, background: '#1f1f1f', color: '#bbb' }}>
                                {c.plan}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{subtitle}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div style={S.grid6}>
        {statCards.map((s) => (
          <div key={s.label} style={{ ...S.card, borderTop: `3px solid ${s.color}` }}>
            <div style={S.label}>{s.label}</div>
            <div style={{ ...S.value, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Activity + Alerts */}
      <div style={S.grid2}>
        {/* Activity feed */}
        <div style={S.card}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '14px' }}>⚡ Live Activity Feed</div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {activity.length === 0 ? (
              <p style={{ color: '#444', fontSize: '13px' }}>No recent activity</p>
            ) : activity.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #1a1a1a', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  {item.action?.includes('case') ? '📋' : item.action?.includes('message') ? '💬' : item.action?.includes('broadcast') ? '📢' : '⚙️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ccc', fontSize: '12px' }}>
                    <span style={{ color: '#5865F2', fontWeight: '600' }}>{item.discord_username || 'System'}</span> {item.action?.replace(/_/g, ' ')}
                  </div>
                  <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}><TimeAgo date={item.created_at} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent alerts */}
        <div style={S.card}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '14px' }}>🚨 Urgent Deadlines</div>
          {alerts.length === 0 ? (
            <p style={{ color: '#444', fontSize: '13px' }}>No urgent deadlines — all clear!</p>
          ) : alerts.map((a) => (
            <div key={a.id} style={{ background: '#1a0a0a', border: '1px solid #ED4245', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff' }}>{a.discord_username || 'Unknown'}</div>
                <div style={{ fontSize: '11px', background: '#ED424520', color: '#ED4245', padding: '2px 8px', borderRadius: '4px' }}>Case #{a.id}</div>
              </div>
              <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>{a.violation_type}</div>
              <div style={{ marginTop: '6px', fontSize: '12px' }}>Deadline: <Countdown deadline={a.appeal_deadline} /></div>
              <button
                onClick={() => navigate(`/admin/cases`)}
                style={{ marginTop: '8px', background: '#ED4245', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
              >
                View Case →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Cases */}
      <div style={{ ...S.card, marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>📋 Recent Cases</div>
          <button onClick={() => navigate('/admin/cases')} style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer' }}>View All</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ color: '#555', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.06em' }}>
                {['#', 'Client', 'Plan', 'Violation', 'Status', 'Created', 'Deadline'].map((h) => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #1a1a1a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentCases.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/admin/cases/${c.id}`)} style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#151515')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 12px', color: '#666' }}>#{c.id}</td>
                  <td style={{ padding: '10px 12px', color: '#fff', fontWeight: '500' }}>{c.discord_username}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: `${PLAN_COLORS[c.plan] || '#333'}22`, color: PLAN_COLORS[c.plan] || '#666', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                      {c.plan?.replace(/_/g, ' ') || 'None'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#aaa' }}>{c.violation_type || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: `${STATUS_COLORS[c.status] || '#333'}22`, color: STATUS_COLORS[c.status] || '#666', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px' }}>{c.appeal_deadline ? <Countdown deadline={c.appeal_deadline} /> : <span style={{ color: '#444' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentCases.length === 0 && <p style={{ color: '#444', textAlign: 'center', padding: '24px', fontSize: '13px' }}>No cases yet</p>}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
        <button onClick={() => navigate('/admin/broadcast')} style={{ ...S.card, border: '1px solid #5865F2', cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'all 0.15s' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#5865F210')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#111')}>
          <div style={{ fontSize: '22px', marginBottom: '8px' }}>📢</div>
          <div style={{ fontWeight: '700', fontSize: '14px' }}>New Broadcast</div>
          <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>Send message to clients</div>
        </button>
        <button onClick={() => navigate('/admin/clients?status=expiring')} style={{ ...S.card, border: '1px solid #F5A623', cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'all 0.15s' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#F5A62310')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#111')}>
          <div style={{ fontSize: '22px', marginBottom: '8px' }}>⏰</div>
          <div style={{ fontWeight: '700', fontSize: '14px' }}>Expiring Plans</div>
          <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>{stats?.expiringSoon ?? 0} expiring in 7 days</div>
        </button>
        <button onClick={generateReport} disabled={reportLoading} style={{ ...S.card, border: '1px solid #9B59B6', cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'all 0.15s', opacity: reportLoading ? 0.7 : 1 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#9B59B610')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#111')}>
          <div style={{ fontSize: '22px', marginBottom: '8px' }}>📈</div>
          <div style={{ fontWeight: '700', fontSize: '14px' }}>{reportLoading ? 'Generating...' : 'Weekly Report'}</div>
          <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>AI-generated summary</div>
        </button>
      </div>

      {report && (
        <div style={{ ...S.card, marginTop: '20px', borderColor: '#9B59B6' }}>
          <div style={{ fontWeight: '700', color: '#9B59B6', marginBottom: '10px' }}>📈 Weekly Report</div>
          <pre style={{ color: '#ccc', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>{report}</pre>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
