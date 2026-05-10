import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useCases } from '../../hooks/queries/useCases';
import { Card, CardContent, Badge, Button, CardSkeleton } from '../../components/ui';
import { statusToStage, customerBucketFor, type StageId } from '@shared/stages';
import { StageChip } from '../../components/case';
import { ComplianceWidget } from '../../components/customer';
import {
  TrendingUp, TrendingDown, Plus, MessageSquare, BookOpen, ChevronRight,
  Activity, Clock, AlertCircle, CheckCircle2, Zap,
} from 'lucide-react';

const PLAN_THEMES: Record<string, { glow: string; label: string; price: string }> = {
  basic_guard:        { glow: 'rgba(88,101,242,0.30)', label: 'Basic Guard',         price: '$29/mo' },
  fortnightly_defense:{ glow: 'rgba(87,242,135,0.30)', label: 'Fortnightly Defense', price: '$59/mo' },
  proshield_creator:  { glow: 'rgba(254,231,92,0.30)', label: 'ProShield Creator',   price: '$129/mo' },
  free:               { glow: 'rgba(255,255,255,0.10)', label: 'Free',               price: '—' },
};

function CountUp({ value, color }: { value: number; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (n) => Math.round(n).toLocaleString());
  useEffect(() => {
    if (inView) animate(mv, value, { duration: 1.0, ease: [0.4, 0, 0.2, 1] });
  }, [inView, value, mv]);
  return <motion.span ref={ref} style={{ color }}>{display}</motion.span>;
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
  const { data: cases, isLoading } = useCases();
  const [liveStatus, setLiveStatus] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      setLiveStatus((prev) => ({ ...prev, [data.caseId]: data.newStatus }));
    };
    socket.on('case:status_changed', handler);
    return () => { socket.off('case:status_changed', handler); };
  }, [socket]);

  const withStage = useMemo(() => {
    if (!cases) return [];
    return cases.map((c: any) => ({
      ...c,
      stage: c.stage || statusToStage(liveStatus[c.id] || c.status, c.outcome),
      effectiveStatus: liveStatus[c.id] || c.status,
    }));
  }, [cases, liveStatus]);

  const buckets = useMemo(() => {
    const b = { active: [] as any[], action_required: [] as any[], resolved: [] as any[] };
    for (const c of withStage) {
      const bucket = customerBucketFor(c.stage as StageId);
      b[bucket].push(c);
    }
    return b;
  }, [withStage]);

  const total = withStage.length;
  const active = buckets.active.length + buckets.action_required.length;
  const resolved = buckets.resolved.length;

  const planKey = (user?.plan || 'free') as string;
  const planTheme = PLAN_THEMES[planKey] || PLAN_THEMES.free;
  const planExpires = user?.plan_expiry;
  let daysRemaining: number | null = null;
  let totalDays = 30;
  if (planExpires) {
    const ms = new Date(planExpires).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
    if (planKey === 'fortnightly_defense') totalDays = 14;
  }

  const planFeatures = planKey === 'proshield_creator'
    ? ['Priority appeal writing', '24h response SLA', 'Unlimited cases', 'Direct strategist access']
    : planKey === 'fortnightly_defense'
      ? ['2 expert appeals / month', '48h response SLA', 'Case prioritization']
      : planKey === 'basic_guard'
        ? ['1 expert appeal / month', '72h response SLA', 'Standard support']
        : ['Limited features', 'Upgrade to access expert appeals'];

  return (
    <div className="page-wrap">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center gap-4 mb-5"
      >
        {(user as any)?.avatar_url
          ? <img src={(user as any).avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-[var(--border)]" />
          : <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center font-bold text-lg text-white">
              {(user?.discord_username || '?').charAt(0).toUpperCase()}
            </div>
        }
        <div>
          <h1 className="text-[26px] font-extrabold m-0" style={{ letterSpacing: -0.5 }}>
            {greeting()}, {user?.discord_username}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Here's what's happening with your cases.</p>
        </div>
      </motion.div>

      {/* Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-5"
      >
        <Card glowing glowColor={planTheme.glow} noHover className="!p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Current Plan</div>
              <div className="text-2xl font-extrabold mt-1.5">{planTheme.label}</div>
              <div className="text-sm text-[var(--text-secondary)] mt-1">{planTheme.price}</div>
            </div>
            {daysRemaining !== null && (
              <div className="text-right">
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Renews in</div>
                <div className="text-2xl font-extrabold mt-1.5" style={{ color: daysRemaining < 5 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {daysRemaining}d
                </div>
              </div>
            )}
          </div>
          {daysRemaining !== null && (
            <div className="mt-4 h-1.5 rounded-full bg-[var(--bg-glass)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100)}%` }}
                transition={{ duration: 1, delay: 0.4 }}
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
                  boxShadow: '0 0 12px var(--accent-glow)',
                }}
              />
            </div>
          )}
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
            {planFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>{f}
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Cases', value: total, icon: <Activity size={14} />, color: '#5865F2', bg: 'rgba(88,101,242,0.12)' },
          { label: 'Active', value: active, icon: <Zap size={14} />, color: '#FEE75C', bg: 'rgba(254,231,92,0.12)' },
          { label: 'Resolved', value: resolved, icon: <CheckCircle2 size={14} />, color: '#57F287', bg: 'rgba(87,242,135,0.12)' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
          >
            <Card noHover className="!p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[var(--text-muted)] uppercase font-semibold tracking-wider">{s.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.bg, color: s.color }}>
                  {s.icon}
                </div>
              </div>
              {isLoading ? (
                <div className="h-8 w-16 skeleton rounded" />
              ) : (
                <div className="text-[32px] font-extrabold leading-none" style={{ color: s.color }}>
                  <CountUp value={s.value} color={s.color} />
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <ComplianceWidget discordId={user?.discord_id} />
        <Card onClick={() => navigate('/kb')} className="!p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(88,101,242,0.12)', color: '#5865F2' }}>
                <BookOpen size={18} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Knowledge Base</div>
                <div className="text-sm font-bold mt-0.5">Browse guides & playbooks</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Policy explainers and appeal tactics.</div>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--accent)' }} />
          </div>
        </Card>
      </div>

      {/* Case Buckets */}
      {isLoading ? (
        <CardSkeleton count={3} />
      ) : total === 0 ? (
        <Card noHover className="!p-8">
          <div className="text-center py-8">
            <Activity size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg font-bold">No cases yet</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 mb-6">
              Submit your first case and our team will start your appeal recovery process.
            </p>
            <Button onClick={() => navigate('/cases/new')}>
              <Plus size={16} />
              Submit Your First Case
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {([
            { key: 'action_required', title: 'Action Required', subtitle: 'These need your attention or staff follow-up.', items: buckets.action_required, accent: '#FAA61A', icon: <AlertCircle size={16} /> },
            { key: 'active', title: 'Active', subtitle: 'In progress with our team.', items: buckets.active, accent: '#5865F2', icon: <Zap size={16} /> },
            { key: 'resolved', title: 'Resolved', subtitle: 'Closed cases — wins and losses.', items: buckets.resolved, accent: '#57F287', icon: <CheckCircle2 size={16} /> },
          ] as const).map((section) => (
            section.items.length === 0 ? null : (
              <section key={section.key}>
                <div className="flex items-baseline justify-between mb-2.5">
                  <div>
                    <h2 className="text-sm font-bold flex items-center gap-2 m-0">
                      <span className="w-2 h-2 rounded-full" style={{ background: section.accent, boxShadow: `0 0 6px ${section.accent}88` }} />
                      {section.title}
                      <span className="text-[11px] font-bold text-[var(--text-muted)] bg-[var(--bg-glass)] px-2 py-0.5 rounded-full">
                        {section.items.length}
                      </span>
                    </h2>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{section.subtitle}</div>
                  </div>
                  <button onClick={() => navigate('/cases')} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    View all →
                  </button>
                </div>
                <div className="space-y-2.5">
                  {section.items.slice(0, 5).map((c: any, i: number) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card onClick={() => navigate(`/cases/${c.id}`)} className="!p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[11px] font-bold px-1.5 py-0.5 bg-[var(--bg-glass)] border border-[var(--border)] rounded text-[var(--text-muted)] font-mono">
                                #{c.id}
                              </span>
                              <StageChip stage={c.stage} size="sm" />
                            </div>
                            <div className="text-sm font-semibold mb-0.5">
                              {c.violation_type || 'Untitled case'} · <span className="text-[var(--text-muted)]">@{c.account_username}</span>
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              Updated {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-6 flex gap-3 flex-wrap">
        <Button onClick={() => navigate('/cases/new')} className="flex-1 min-w-[200px]">
          <Plus size={16} /> Submit New Case
        </Button>
        <Button variant="secondary" onClick={() => navigate('/messages')} className="flex-1 min-w-[200px]">
          <MessageSquare size={16} /> Message Staff
        </Button>
      </div>
    </div>
  );
}