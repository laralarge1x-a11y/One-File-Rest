import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { GlassCard, LoadingSpinner, EmptyState, ComplianceWidget } from '../components/customer';
import { StageChip } from '../components/case';
import { statusToStage, customerBucketFor, type StageId } from '@shared/stages';

interface Case {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  priority: string;
  appeal_deadline: string;
  created_at: string;
  updated_at?: string;
  outcome?: string | null;
  violation_description?: string;
  stage?: StageId;
}

const PLAN_THEMES: Record<string, { glow: string; label: string; price: string }> = {
  basic_guard:        { glow: 'rgba(88,101,242,0.30)', label: 'Basic Guard',         price: '$29/mo' },
  fortnightly_defense:{ glow: 'rgba(87,242,135,0.30)', label: 'Fortnightly Defense', price: '$59/mo' },
  proshield_creator:  { glow: 'rgba(254,231,92,0.30)', label: 'ProShield Creator',   price: '$129/mo' },
  free:               { glow: 'rgba(255,255,255,0.10)', label: 'Free',               price: '—' },
};

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (n) => Math.round(n).toLocaleString());
  useEffect(() => { if (inView) animate(mv, value, { duration: 1.0, ease: [0.4, 0, 0.2, 1] }); }, [inView, value]);
  return <motion.span ref={ref}>{display}</motion.span>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCases(); }, []);
  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => setCases((prev) => prev.map((c) => c.id === data.caseId ? { ...c, status: data.newStatus } : c));
    socket.on('case:status_changed', handler);
    return () => { socket.off('case:status_changed', handler); };
  }, [socket]);

  const fetchCases = async () => {
    try {
      const r = await fetch('/api/cases', { credentials: 'include' });
      if (r.ok) setCases(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <LoadingSpinner fullScreen label="Loading your dashboard..." />;

  // Bucket cases using the canonical 7-stage taxonomy. Action Required
  // surfaces tiktok_replied + needs_retry — the two stages that block on a
  // customer reply or staff intervention.
  const withStage: Array<Case & { stage: StageId }> = cases.map((c) => ({
    ...c,
    stage: c.stage || statusToStage(c.status, c.outcome),
  }));
  const buckets = { active: [] as typeof withStage, action_required: [] as typeof withStage, resolved: [] as typeof withStage };
  for (const c of withStage) buckets[customerBucketFor(c.stage)].push(c);
  const total = withStage.length;
  const active = buckets.active.length + buckets.action_required.length;
  const resolved = buckets.resolved.length;

  const planKey = (user?.plan || 'free') as string;
  const planTheme = PLAN_THEMES[planKey] || PLAN_THEMES.free;
  const planExpires = user?.plan_expiry || undefined;
  let daysRemaining: number | null = null;
  let totalDays = 30;
  if (planExpires) {
    const ms = new Date(planExpires).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
    if (planKey === 'proshield_creator') totalDays = 30;
    else if (planKey === 'fortnightly_defense') totalDays = 14;
    else totalDays = 30;
  }
  const planFeatures = planKey === 'proshield_creator'
    ? ['Priority appeal writing', '24h response SLA', 'Unlimited cases', 'Direct strategist access']
    : planKey === 'fortnightly_defense'
      ? ['2 expert appeals / month', '48h response SLA', 'Case prioritization']
      : planKey === 'basic_guard'
        ? ['1 expert appeal / month', '72h response SLA', 'Standard support']
        : ['Limited features', 'Upgrade to access expert appeals'];

  const recent = withStage.slice(0, 3);

  return (
    <div className="page-wrap">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}
      >
        {user?.avatar_url
          ? <img src={user.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--border)' }} />
          : <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
              {(user?.discord_username || '?').charAt(0).toUpperCase()}
            </div>
        }
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            {greeting()}, {user?.discord_username}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Here's what's happening with your cases.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        style={{ marginBottom: 28 }}
      >
        <GlassCard glowing glowColor={planTheme.glow} noHover style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Current Plan</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{planTheme.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{planTheme.price}</div>
            </div>
            {daysRemaining !== null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Renews in</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: daysRemaining < 5 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {daysRemaining}d
                </div>
              </div>
            )}
          </div>
          {daysRemaining !== null && (
            <div style={{ marginTop: 16, height: 6, borderRadius: 999, background: 'var(--bg-glass)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100)}%` }}
                transition={{ duration: 1, delay: 0.4 }}
                style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-light))', borderRadius: 999 }}
              />
            </div>
          )}
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {planFeatures.map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>{f}
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 20 }} className="dash-widgets">
        <ComplianceWidget discordId={user?.discord_id} />
        <div onClick={() => navigate('/kb')} style={{
          cursor: 'pointer',
          background: 'var(--bg-glass)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Knowledge Base</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>Browse guides & playbooks</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Policy explainers, appeal templates, escalation tactics.</div>
          </div>
          <span style={{ fontSize: 22, color: 'var(--accent)' }}>→</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Cases',   value: total,    color: '#5865F2', icon: '📋' },
          { label: 'Active Cases',  value: active,   color: '#FEE75C', icon: '⚡' },
          { label: 'Resolved Cases', value: resolved, color: '#57F287', icon: '✓' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
          >
            <GlassCard style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6 }}>{s.label}</span>
                <span style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `${s.color}15`, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                <CountUp value={s.value} />
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {total === 0 ? (
        <GlassCard noHover style={{ padding: 8 }}>
          <EmptyState
            icon="📭"
            title="No cases yet"
            subtitle="Submit your first case and our team will start your appeal recovery process."
            actionLabel="Submit Your First Case"
            onAction={() => navigate('/cases/new')}
          />
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {([
            { key: 'action_required', title: 'Action Required', subtitle: 'These need your attention or staff follow-up.', items: buckets.action_required, accent: '#FAA61A' },
            { key: 'active',          title: 'Active',          subtitle: 'In progress with our team.',                  items: buckets.active,          accent: '#5865F2' },
            { key: 'resolved',        title: 'Resolved',        subtitle: 'Closed cases — wins and losses.',             items: buckets.resolved,        accent: '#57F287' },
          ] as const).map((section) => (
            section.items.length === 0 ? null : (
              <section key={section.key}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: section.accent, boxShadow: `0 0 6px ${section.accent}88` }} />
                      {section.title}
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: 999 }}>{section.items.length}</span>
                    </h2>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{section.subtitle}</div>
                  </div>
                  <button onClick={() => navigate('/cases')} style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                    padding: '4px 8px', borderRadius: 6,
                  }}>View all →</button>
                </div>
                <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {section.items.slice(0, 5).map((c) => (
                    <motion.div key={c.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                      <GlassCard onClick={() => navigate(`/cases/${c.id}`)} style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '3px 7px',
                                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                                borderRadius: 6, color: 'var(--text-muted)', fontFamily: 'monospace',
                              }}>#{c.id}</span>
                              <StageChip stage={c.stage} size="sm" />
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                              {c.violation_type || 'Untitled case'} · <span style={{ color: 'var(--text-muted)' }}>@{c.account_username}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Updated {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>→</span>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </motion.div>
              </section>
            )
          ))}
        </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/cases/new')} className="btn-primary" style={{ flex: '1 1 200px', minHeight: 48 }}>
          <span>＋</span> Submit New Case
        </button>
        <button onClick={() => navigate('/messages')} className="btn-ghost" style={{ flex: '1 1 200px', minHeight: 48 }}>
          <span>💬</span> Message Staff
        </button>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .dash-widgets { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
