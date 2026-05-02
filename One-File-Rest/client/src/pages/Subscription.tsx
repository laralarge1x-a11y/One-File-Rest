import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../components/customer/Toast';
import { getPushStatus, subscribePush, unsubscribePush } from '../lib/push';
import { useAccounts } from '../lib/accounts';
import SpecialistCard, { Specialist } from '../components/customer/SpecialistCard';

interface SubData {
  plan: string | null;
  plan_start: string | null;
  plan_expiry: string | null;
  planMeta: any;
  subscription: any;
  usage: { used: number; limit: number | null; periodStart: string | null };
  history: any[];
  availablePlans: Array<{ id: string; name: string; price: number; responseTime: string; violations: string; limit: number }>;
}

export default function Subscription() {
  const { toast } = useToast();
  const { accounts, refresh: refreshAccounts } = useAccounts();
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<string>('unknown');
  const [specs, setSpecs] = useState<Specialist[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/subscriptions/me', { credentials: 'include' });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    getPushStatus().then(setPushStatus);
    fetch('/api/staff-public', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then(setSpecs)
      .catch(() => {});
  }, [load]);

  const action = async (path: string, body?: any, label?: string) => {
    setBusy(path);
    try {
      const r = await fetch(`/api/subscriptions/${path}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast(label || 'Updated', 'success');
        load();
      } else {
        toast(d.error || 'Failed', 'error');
      }
    } finally { setBusy(null); }
  };

  const togglePush = async () => {
    if (pushStatus === 'subscribed') {
      await unsubscribePush();
      toast('Notifications disabled', 'info');
      setPushStatus('unsubscribed');
    } else {
      const r = await subscribePush();
      if (r.ok) { toast('Push notifications enabled', 'success'); setPushStatus('subscribed'); }
      else toast('Failed: ' + (r.reason || 'unknown'), 'error');
    }
  };

  const favorite = async (s: Specialist) => {
    const method = s.favorited ? 'DELETE' : 'POST';
    await fetch(`/api/staff-public/${s.discord_id}/favorite`, { method, credentials: 'include' });
    setSpecs((prev) => prev.map((x) => x.discord_id === s.discord_id ? { ...x, favorited: !x.favorited } : x));
  };

  const removeAccount = async (id: number) => {
    if (!confirm('Remove this TikTok account?')) return;
    await fetch(`/api/accounts/${id}`, { method: 'DELETE', credentials: 'include' });
    refreshAccounts();
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

  const sub = data?.subscription;
  const planMeta = data?.planMeta;
  const usage = data?.usage;
  const usagePct = usage?.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const usageColor = usagePct >= 90 ? '#ED4245' : usagePct >= 70 ? '#F5A623' : '#57F287';
  const isPaused = sub?.status === 'paused';
  const willCancel = sub?.cancel_at_period_end;
  const expiry = data?.plan_expiry ? new Date(data.plan_expiry) : null;
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 100px', color: '#fff' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Account & Subscription</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Manage your plan, accounts, notifications and specialists.
      </p>

      {/* Current Plan */}
      <Section title="Current Plan">
        {!data?.plan ? (
          <div style={{ color: 'var(--text-muted)' }}>You have no active plan. Pick one below to get started.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Plan</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{planMeta?.name || data.plan}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>${planMeta?.price || '—'}/mo · {planMeta?.responseTime}</div>
              <div style={{ marginTop: 12, fontSize: 12 }}>
                {isPaused && <span style={{ color: '#FEE75C', fontWeight: 700 }}>⏸ Paused — {sub?.pause_reason || 'paused'}</span>}
                {willCancel && !isPaused && <span style={{ color: '#F5A623', fontWeight: 700 }}>⚠ Cancels at end of period</span>}
                {!isPaused && !willCancel && daysLeft !== null && <span style={{ color: daysLeft <= 7 ? '#F5A623' : '#57F287' }}>Renews in {daysLeft} day{daysLeft === 1 ? '' : 's'}</span>}
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>This billing period</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {usage?.used ?? 0}{usage?.limit ? ` / ${usage.limit}` : ''} cases
              </div>
              {usage?.limit && (
                <div style={{ marginTop: 10, height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${usagePct}%` }} transition={{ duration: 0.6 }} style={{ height: '100%', background: usageColor }} />
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                {usage?.periodStart ? `Since ${new Date(usage.periodStart).toLocaleDateString()}` : ''}
              </div>
            </Card>
          </div>
        )}

        {data?.plan && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {!isPaused ? (
              <button disabled={busy === 'pause'} onClick={() => {
                const reason = prompt('Reason for pausing? (optional)') || '';
                action('pause', { reason }, 'Paused');
              }} style={btnSecondary}>Pause subscription</button>
            ) : (
              <button disabled={busy === 'resume'} onClick={() => action('resume', {}, 'Resumed')} style={btnPrimary}>Resume</button>
            )}
            {!willCancel ? (
              <button disabled={busy === 'cancel'} onClick={() => {
                const reason = prompt('Cancel: please tell us why?') || '';
                if (confirm('Cancel at end of billing period?')) action('cancel', { reason, immediate: false }, 'Will cancel at period end');
              }} style={btnDanger}>Cancel at period end</button>
            ) : (
              <span style={{ alignSelf: 'center', color: '#F5A623', fontSize: 12 }}>Cancellation pending</span>
            )}
          </div>
        )}
      </Section>

      {/* Available Plans (upgrade) */}
      <Section title="Available Plans">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {(data?.availablePlans || []).map((p) => {
            const current = data?.plan === p.id;
            return (
              <Card key={p.id}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>${p.price}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/mo</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{p.responseTime}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.violations}</div>
                <button
                  onClick={() => action('change-request', { plan: p.id }, 'Change request submitted')}
                  disabled={current || busy === 'change-request'}
                  style={{
                    marginTop: 10, width: '100%', padding: '8px',
                    background: current ? 'var(--bg-glass)' : '#5865F2',
                    color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12,
                    cursor: current ? 'default' : 'pointer', opacity: current ? 0.6 : 1,
                  }}
                >{current ? 'Current plan' : 'Request change'}</button>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* TikTok accounts */}
      <Section title="TikTok Accounts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {accounts.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No accounts yet. Use the account switcher in the header to add one.</div>}
          {accounts.map((a) => (
            <Card key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>@{a.username} {a.is_primary && <span style={{ color: '#FFD700' }}>★</span>}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.active_cases ?? 0} active case{a.active_cases === 1 ? '' : 's'} • {a.account_url || 'no url'}</div>
              </div>
              <button onClick={() => removeAccount(a.id)} style={{ ...btnDanger, padding: '6px 10px' }}>Remove</button>
            </Card>
          ))}
        </div>
      </Section>

      {/* Push notifications */}
      <Section title="Notifications">
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Browser push notifications</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {pushStatus === 'subscribed' && 'Enabled — you\'ll receive push notifications.'}
              {pushStatus === 'unsubscribed' && 'Disabled.'}
              {pushStatus === 'denied' && 'Blocked in your browser settings.'}
              {pushStatus === 'unsupported' && 'Not supported in this browser.'}
            </div>
          </div>
          {pushStatus !== 'denied' && pushStatus !== 'unsupported' && (
            <button onClick={togglePush} style={pushStatus === 'subscribed' ? btnSecondary : btnPrimary}>
              {pushStatus === 'subscribed' ? 'Disable' : 'Enable'}
            </button>
          )}
        </Card>
      </Section>

      {/* Specialists */}
      <Section title="Your Specialists">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {specs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No specialists configured.</div>}
          {specs.map((s) => <SpecialistCard key={s.discord_id} s={s} onFavorite={favorite} />)}
        </div>
      </Section>

      {/* History */}
      {data?.history && data.history.length > 0 && (
        <Section title="History">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={th}>Plan</th><th style={th}>Status</th><th style={th}>Start</th><th style={th}>End</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{h.plan}</td>
                    <td style={td}>{h.status}</td>
                    <td style={td}>{h.start_date ? new Date(h.start_date).toLocaleDateString() : '—'}</td>
                    <td style={td}>{h.end_date ? new Date(h.end_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>{title}</h2>
    {children}
  </section>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: 'var(--bg-glass)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: 14,
    ...style,
  }}>{children}</div>
);

const btnPrimary: React.CSSProperties = {
  padding: '8px 14px', background: '#5865F2', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = { ...btnPrimary, background: 'var(--bg-glass)', border: '1px solid var(--border)' };
const btnDanger: React.CSSProperties = { ...btnPrimary, background: 'transparent', border: '1px solid #ED4245', color: '#ED4245' };

const th: React.CSSProperties = { padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 };
const td: React.CSSProperties = { padding: '8px 6px' };
