import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
};

const CHART_COLORS = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#F5A623', '#9B59B6', '#ED4245', '#00b4d8'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '10px 14px' }}>
      {label && <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || '#fff', fontSize: '13px', fontWeight: '600' }}>
          {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? `$${p.value.toLocaleString()}` : p.value}
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30');
  const [adminStats, setAdminStats] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsR, statsR] = await Promise.all([
        fetch(`/api/analytics?range=${range}`, { credentials: 'include' }),
        fetch('/api/admin/stats', { credentials: 'include' }),
      ]);
      if (analyticsR.ok) setData(await analyticsR.json());
      if (statsR.ok) setAdminStats(await statsR.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const winRate = data && data.totalCases > 0 ? Math.round((data.wonCases / data.totalCases) * 100) : 0;
  const planCountData = adminStats?.planCounts
    ? Object.entries(adminStats.planCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : [];

  const statusChartData = (data?.casesByStatus || []).map((item: any) => ({ name: item.status.replace(/_/g, ' '), value: parseInt(item.count) }));
  const violationChartData = (data?.casesByViolationType || []).slice(0, 8).map((item: any) => ({ name: (item.type || 'Unknown').substring(0, 18), value: parseInt(item.count) }));
  const trendsData = (data?.caseTrends || []).map((item: any) => ({ date: item.date || item.period, cases: parseInt(item.count || 0), resolved: parseInt(item.resolved || 0) }));
  const staffData = (data?.staffPerformance || []).slice(0, 8).map((s: any) => ({ name: (s.name || s.staff_name || 'Staff').substring(0, 12), resolved: parseInt(s.resolved_count || s.resolved || 0), active: parseInt(s.active_count || s.active || 0) }));

  const statCards = [
    { label: 'Total Cases', value: data?.totalCases ?? 0, color: '#5865F2' },
    { label: 'Won Cases', value: data?.wonCases ?? 0, color: '#57F287' },
    { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 70 ? '#57F287' : winRate >= 50 ? '#FEE75C' : '#ED4245' },
    { label: 'Avg Resolution', value: `${Math.round(data?.avgResolutionTime ?? 0)}h`, color: '#9B59B6' },
    { label: 'Total Revenue', value: `$${(adminStats?.totalRevenue ?? 0).toLocaleString()}`, color: '#EB459E' },
    { label: 'Active Clients', value: adminStats?.totalClients ?? 0, color: '#F5A623' },
  ];

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Analytics</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select style={S.select} value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button onClick={fetchAll} style={{ background: '#5865F2', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#444' }}>Loading analytics...</div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '14px', marginBottom: '24px' }}>
            {statCards.map(s => (
              <div key={s.label} style={{ ...S.card, borderTop: `3px solid ${s.color}` }}>
                <div style={{ ...S.label, marginBottom: '6px' }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: '24px', fontWeight: '800', lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Row 1 — Trends + Status Pie */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>📈 Case Trends</div>
              {trendsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" stroke="#444" tick={{ fill: '#555', fontSize: 11 }} />
                    <YAxis stroke="#444" tick={{ fill: '#555', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: '#666', fontSize: 12 }} />
                    <Line type="monotone" dataKey="cases" stroke="#5865F2" strokeWidth={2} dot={false} name="New Cases" />
                    <Line type="monotone" dataKey="resolved" stroke="#57F287" strokeWidth={2} dot={false} name="Resolved" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '13px' }}>No trend data available</div>
              )}
            </div>

            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>🍩 Cases by Status</div>
              {statusChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {statusChartData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    {statusChartData.map((item: any, i: number) => (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#666' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {item.name} ({item.value})
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>No data</div>}
            </div>
          </div>

          {/* Row 2 — Violations + Plan Mix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>⚠️ Top Violation Types</div>
              {violationChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={violationChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis type="number" stroke="#444" tick={{ fill: '#555', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={110} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Cases" radius={[0, 4, 4, 0]}>
                      {violationChartData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>No data</div>}
            </div>

            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>💰 Plan Distribution</div>
              {planCountData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={planCountData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                        {planCountData.map((_: any, i: number) => <Cell key={i} fill={['#5865F2', '#57F287', '#FFD700'][i % 3]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {planCountData.map((item: any, i: number) => (
                      <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '2px', background: ['#5865F2', '#57F287', '#FFD700'][i % 3] }} />
                          {item.name}
                        </div>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>{item.value as number}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>No plan data</div>}
            </div>
          </div>

          {/* Row 3 — Staff Performance */}
          {staffData.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>👨‍💼 Staff Performance</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={staffData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="name" stroke="#444" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis stroke="#444" tick={{ fill: '#555', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#666', fontSize: 12 }} />
                  <Bar dataKey="resolved" name="Resolved" fill="#57F287" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="active" name="Active" fill="#5865F2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
