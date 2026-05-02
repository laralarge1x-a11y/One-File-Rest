import React, { useEffect, useState } from 'react';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px', marginBottom: '16px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px', display: 'block' },
  sectionTitle: { fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #1a1a1a' } as React.CSSProperties,
};

function EnvStatusDot({ isSet }: { isSet: boolean }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isSet ? '#57F287' : '#ED4245', boxShadow: isSet ? '0 0 6px #57F287' : '0 0 6px #ED4245', marginRight: 8 }} />;
}

export default function AdminSettings() {
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  const [systemStats, setSystemStats] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<any>({ logs: [], stats: {} });
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/env-status', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/system-stats', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/webhook-logs', { credentials: 'include' }).then(r => r.json()),
    ]).then(([env, stats, wh]) => {
      setEnvStatus(env);
      setSystemStats(stats);
      setWebhookLogs(wh);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const testWebhook = async () => {
    if (!testUrl.trim()) return;
    setTesting(true);
    setTestResult('');
    try {
      const r = await fetch('/api/admin/test-webhook', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: testUrl }),
      });
      const d = await r.json();
      setTestResult(r.ok ? `✅ Webhook working! Status ${d.status}` : `❌ ${d.error}`);
    } catch (e) { setTestResult('❌ Network error'); }
    setTesting(false);
  };

  const clearOldLogs = async () => {
    setClearingLogs(true);
    const r = await fetch('/api/admin/webhook-logs/old', { method: 'DELETE', credentials: 'include' });
    const d = await r.json();
    setTestResult(`✅ Cleared ${d.deleted} old log entries`);
    setClearingLogs(false);
  };

  const ENV_VARS = [
    { key: 'DISCORD_CLIENT_ID', label: 'Discord Client ID', desc: 'Required for OAuth login' },
    { key: 'DISCORD_CLIENT_SECRET', label: 'Discord Client Secret', desc: 'Required for OAuth login' },
    { key: 'DISCORD_REDIRECT_URI', label: 'Discord Redirect URI', desc: 'OAuth callback URL' },
    { key: 'DISCORD_BOT_TOKEN', label: 'Discord Bot Token', desc: 'Required for bot features' },
    { key: 'DISCORD_GUILD_ID', label: 'Discord Guild ID', desc: 'Server ID for slash commands' },
    { key: 'ADMIN_DISCORD_IDS', label: 'Admin Discord IDs', desc: 'Comma-separated admin user IDs' },
    { key: 'BOT_BRIDGE_TOKEN', label: 'Bot Bridge Token', desc: 'Secret for bot ↔ server auth' },
    { key: 'GROQ_API_KEY', label: 'Groq API Key', desc: 'Required for AI features' },
    { key: 'SESSION_SECRET', label: 'Session Secret', desc: 'Required for secure sessions' },
    { key: 'DATABASE_URL', label: 'Database URL', desc: 'PostgreSQL connection string' },
  ];

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 24px' }}>Settings</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#444' }}>Loading settings...</div>
      ) : (
        <>
          {/* Environment Variables Status */}
          <div style={S.card}>
            <div style={S.sectionTitle}>🔑 Environment Variables Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {ENV_VARS.map(({ key, label, desc }) => (
                <div key={key} style={{ background: '#1a1a1a', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <EnvStatusDot isSet={!!envStatus[key]} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: envStatus[key] ? '#fff' : '#ED4245', fontWeight: '600' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{desc}</div>
                  </div>
                  <span style={{ fontSize: '11px', color: envStatus[key] ? '#57F287' : '#ED4245', fontWeight: '700' }}>{envStatus[key] ? '✓ Set' : '✗ Missing'}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '14px', background: '#0d1a0d', border: '1px solid #57F28730', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#57F287' }}>
              💡 To set environment variables, go to the <strong>Secrets</strong> panel in your Replit project.
            </div>
          </div>

          {/* System Stats */}
          <div style={S.card}>
            <div style={S.sectionTitle}>⚙️ System Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
              {[
                { label: 'Server Uptime', value: systemStats ? `${Math.floor(systemStats.uptime_seconds / 3600)}h ${Math.floor((systemStats.uptime_seconds % 3600) / 60)}m` : '—', color: '#57F287' },
                { label: 'Memory Used', value: systemStats ? `${systemStats.memory_mb} MB` : '—', color: '#5865F2' },
                { label: 'Environment', value: systemStats?.node_env || '—', color: '#FEE75C' },
                { label: 'Total Users', value: systemStats?.table_counts?.users ?? '—', color: '#9B59B6' },
              ].map(s => (
                <div key={s.label} style={{ background: '#1a1a1a', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', textTransform: 'uppercase', fontWeight: '600' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {systemStats?.table_counts && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Database Table Counts</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(systemStats.table_counts).map(([table, count]) => (
                    <div key={table} style={{ background: '#1a1a1a', borderRadius: '6px', padding: '6px 14px', fontSize: '12px' }}>
                      <span style={{ color: '#666' }}>{table}: </span><span style={{ color: '#fff', fontWeight: '700' }}>{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Webhook Tester */}
          <div style={S.card}>
            <div style={S.sectionTitle}>🔗 Webhook Tester</div>
            {testResult && (
              <div style={{ background: testResult.startsWith('✅') ? '#57F28720' : '#ED424520', border: `1px solid ${testResult.startsWith('✅') ? '#57F28740' : '#ED424540'}`, borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: testResult.startsWith('✅') ? '#57F287' : '#ED4245', marginBottom: '14px' }}>{testResult}</div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="https://discord.com/api/webhooks/..." value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
              <button onClick={testWebhook} disabled={testing || !testUrl.trim()} style={{ ...S.btn, background: '#5865F2', color: '#fff', opacity: testing || !testUrl.trim() ? 0.6 : 1 }}>
                {testing ? 'Testing...' : 'Test Webhook'}
              </button>
            </div>
          </div>

          {/* Webhook Logs */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...S.sectionTitle }}>
              <span>📋 Webhook Delivery Logs</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#555', fontWeight: '400' }}>
                  24h: <span style={{ color: '#57F287' }}>✅ {webhookLogs.stats?.success_count ?? 0}</span> &nbsp;
                  <span style={{ color: '#ED4245' }}>❌ {webhookLogs.stats?.failed_count ?? 0}</span>
                </span>
                <button onClick={clearOldLogs} disabled={clearingLogs} style={{ ...S.btn, background: '#1a0a0a', color: '#ED4245', border: '1px solid #ED424530', padding: '5px 12px', fontSize: '11px' }}>
                  {clearingLogs ? 'Clearing...' : 'Clear Old Logs'}
                </button>
              </div>
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: '#444', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.06em', borderBottom: '1px solid #1a1a1a' }}>
                    {['Time', 'User', 'Event Type', 'Status', 'HTTP'].map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(webhookLogs.logs || []).length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#444' }}>No webhook logs yet</td></tr>
                  ) : (webhookLogs.logs || []).map((log: any) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #141414' }}>
                      <td style={{ padding: '8px 12px', color: '#555' }}>{new Date(log.created_at).toLocaleTimeString()}</td>
                      <td style={{ padding: '8px 12px', color: '#888' }}>{log.discord_username || log.user_id || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#ccc' }}>{log.event_type || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: log.success ? '#57F287' : '#ED4245', fontWeight: '700' }}>
                          {log.success ? '✅ OK' : '❌ Failed'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#666' }}>{log.http_status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bot Instructions */}
          <div style={{ ...S.card, background: '#0d0d1a', border: '1px solid #5865F230' }}>
            <div style={S.sectionTitle}>🤖 Discord Bot Setup</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { step: '1', text: 'Add DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, and BOT_BRIDGE_TOKEN to Secrets' },
                { step: '2', text: 'Invite the bot to your Discord server with permissions: Manage Webhooks, Send Messages, Embed Links, Read Message History' },
                { step: '3', text: 'Run the bot separately: cd One-File-Rest && npx tsx bot/index.ts' },
                { step: '4', text: 'Slash commands will auto-register. Use /giveaccess, /revokeaccess, /casestatus in your server' },
                { step: '5', text: 'All portal updates (new cases, status changes, messages) auto-post to client channels via webhook' },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>{step}</div>
                  <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.5' }}>{text}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
