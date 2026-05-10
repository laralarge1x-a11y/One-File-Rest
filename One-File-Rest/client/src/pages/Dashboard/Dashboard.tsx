import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useCases } from '../../hooks/queries/useCases';
import { useNotifications } from '../../hooks/queries/useNotifications';
import { Card, CardContent, Badge, Button, CardSkeleton, Progress } from '../../components/ui';
import { statusToStage, customerBucketFor, type StageId } from '@shared/stages';
import { StageChip } from '../../components/case';
import { ComplianceWidget } from '../../components/customer';
import {
  TrendingUp, TrendingDown, Plus, MessageSquare, BookOpen, ChevronRight,
  Activity, Clock, AlertCircle, CheckCircle2, Zap, Bell, Upload,
  Shield, AlertTriangle, Flame, Gauge, Users,
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

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function computeHealthScore(cases: any[]): { score: number; grade: 'Excellent' | 'Good' | 'Fair' | 'At Risk' | 'Critical'; color: string } {
  if (!cases || cases.length === 0) return { score: 100, grade: 'Excellent', color: '#57F287' };
  const resolved = cases.filter((c: any) => c.outcome === 'won' || c.status === 'won' || c.stage === 'resolved_won').length;
  const active = cases.filter((c: any) => !['won', 'denied', 'closed'].includes(c.status || '')).length;
  const hasUrgent = cases.some((c: any) => {
    if (!c.appeal_deadline) return false;
    return Math.max(0, Math.ceil((new Date(c.appeal_deadline).getTime() - Date.now()) / 86400000)) <= 3;
  });
  const score = Math.max(0, Math.min(100,
    (resolved / Math.max(cases.length, 1)) * 50 +
    (1 - active / Math.max(cases.length, 1)) * 30 +
    (hasUrgent ? -20 : 20)
  ));
  if (score >= 85) return { score: Math.round(score), grade: 'Excellent', color: '#57F287' };
  if (score >= 70) return { score: Math.round(score), grade: 'Good', color: '#7BD389' };
  if (score >= 50) return { score: Math.round(score), grade: 'Fair', color: '#FEE75C' };
  if (score >= 30) return { score: Math.round(score), grade: 'At Risk', color: '#FAA61A' };
  return { score: Math.round(score), grade: 'Critical', color: '#ED4245' };
}

function computeRiskIndicator(cases: any[]): { level: 'low' | 'medium' | 'high' | 'critical'; label: string; color: string } {
  if (!cases || cases.length === 0) return { level: 'low', label: 'No active risks', color: '#57F287' };
  const urgentDeadlines = cases.filter((c: any) => {
    if (!c.appeal_deadline) return false;
    return Math.max(0, Math.ceil((new Date(c.appeal_deadline).getTime() - Date.now()) / 86400000)) <= 3;
  }).length;
  const unresolved = cases.filter((c: any) => !['won', 'denied', 'closed'].includes(c.status || '')).length;
  if (urgentDeadlines >= 3 || unresolved >= 5) return { level: 'critical', label: `${urgentDeadlines} urgent appeals`, color: '#ED4245' };
  if (urgentDeadlines >= 1 || unresolved >= 3) return { level: 'high', label: `${urgentDeadlines} deadline${urgentDeadlines > 1 ? 's' : ''} approaching`, color: '#FAA61A' };
  if (unresolved >= 1) return { level: 'medium', label: `${unresolved} active case${unresolved > 1 ? 's' : ''}`, color: '#FEE75C' };
  return { level: 'low', label: 'No active risks', color: '#57F287' };
}

// ─── Notification Feed Widget ─────────────────────────────────────────
function NotificationFeed({ notifications }: { notifications: any[] }) {
  const navigate = useNavigate();
  const ICON_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
    status_change: { icon: <Clock size={14} />, color: '#5865F2' },
    message: { icon: <MessageSquare size={14} />, color: '#57F287' },
    case_resolved: { icon: <CheckCircle2 size={14} />, color: '#FEE75C' },
    deadline: { icon: <AlertCircle size={14} />, color: '#ED4245' },
    policy: { icon: <AlertTriangle size={14} />, color: '#FAA61A' },
  };
  return (
    <Card noHover className="!p-0 !overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Bell size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Recent Activity</span>
        </div>
        <button onClick={() => navigate('/notifications')} className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>View all</button>
      </div>
      <div className="divide-y divide-[var(--border)] max-h-[240px] overflow-y-auto no-scrollbar">
        {notifications.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)] text-xs">
            <Bell size={24} className="mx-auto mb-2 opacity-50" />
            No recent activity
          </div>
        ) : notifications.slice(0, 6).map((n: any, i: number) => {
          const meta = ICON_MAP[n.type] || { icon: <Bell size={14} />, color: '#5865F2' };
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(n.case_id ? `/cases/${n.case_id}` : '/notifications')}
              className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-glass-hover)] transition-colors"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${meta.color}15`, color: meta.color }}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{n.title || n.message?.slice(0, 60)}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-1.5" style={{ boxShadow: '0 0 4px var(--accent-glow)' }} />}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Upcoming Deadlines Widget ────────────────────────────────────────
function UpcomingDeadlines({ cases }: { cases: any[] }) {
  const navigate = useNavigate();
  const deadlines = useMemo(() => {
    if (!cases) return [];
    return cases
      .filter((c: any) => c.appeal_deadline && !['won', 'denied', 'closed'].includes(c.status || ''))
      .map((c: any) => ({
        ...c,
        daysLeft: Math.max(0, Math.ceil((new Date(c.appeal_deadline).getTime() - Date.now()) / 86400000)),
      }))
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [cases]);

  if (deadlines.length === 0) return null;
  return (
    <Card noHover className="!p-0 !overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Upcoming Deadlines</span>
        </div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {deadlines.map((c: any) => (
          <div key={c.id} onClick={() => navigate(`/cases/${c.id}`)}
            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-glass-hover)] transition-colors"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
              c.daysLeft <= 3 ? 'bg-[rgba(237,66,69,0.12)] text-[#ED4245]' :
              c.daysLeft <= 7 ? 'bg-[rgba(250,166,26,0.12)] text-[#FAA61A]' :
              'bg-[rgba(88,101,242,0.12)] text-[#5865F2]'
            }`}>
              {c.daysLeft}d
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{c.violation_type || 'Case'} · @{c.account_username}</div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {c.daysLeft === 0 ? 'Due today!' : `${c.daysLeft} day${c.daysLeft > 1 ? 's' : ''} remaining`}
              </div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { data: cases, isLoading } = useCases();
  const { data: notifData } = useNotifications();
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

  const health = useMemo(() => computeHealthScore(withStage), [withStage]);
  const risk = useMemo(() => computeRiskIndicator(withStage), [withStage]);

  const notifications = notifData?.notifications || [];

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

      {/* Health Score + Risk Indicator Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {/* Account Health Score */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
        >
          <Card noHover className="!p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-[var(--text-muted)] uppercase font-semibold tracking-wider flex items-center gap-1.5">
                <Gauge size={13} /> Account Health
              </span>
              <Badge variant={health.score >= 70 ? 'success' : health.score >= 50 ? 'warning' : 'danger'} size="sm">
                {health.grade}
              </Badge>
            </div>
            {isLoading ? (
              <div className="h-12 skeleton rounded" />
            ) : (
              <div className="flex items-center gap-4">
                <Progress value={health.score} className="flex-1 h-2.5" glowColor={health.color} />
                <span className="text-lg font-extrabold shrink-0" style={{ color: health.color }}>{health.score}%</span>
              </div>
            )}
            <div className="text-[10px] text-[var(--text-muted)] mt-1.5">
              Based on {total} case{total !== 1 ? 's' : ''} · {resolved} resolved
            </div>
          </Card>
        </motion.div>

        {/* TikTok Risk Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card noHover className="!p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-[var(--text-muted)] uppercase font-semibold tracking-wider flex items-center gap-1.5">
                <Shield size={13} /> Risk Level
              </span>
              <Badge variant={risk.level === 'critical' ? 'danger' : risk.level === 'high' ? 'warning' : risk.level === 'medium' ? 'warning' : 'success'} size="sm">
                {risk.level === 'critical' || risk.level === 'high' ? <Flame size={10} /> : <CheckCircle2 size={10} />}
                {risk.level}
              </Badge>
            </div>
            {isLoading ? (
              <div className="h-12 skeleton rounded" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-bold">{risk.label}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {active} active · {buckets.action_required.length} need attention
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${risk.color}18`, color: risk.color }}>
                  {risk.level === 'critical' || risk.level === 'high' ? <AlertTriangle size={20} /> : <Shield size={20} />}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

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

      {/* Widgets Row — 3 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {/* Compliance Score */}
        <ComplianceWidget discordId={user?.discord_id} />

        {/* Notification Feed */}
        <NotificationFeed notifications={notifications} />

        {/* Upcoming Deadlines */}
        <UpcomingDeadlines cases={withStage} />
      </div>

      {/* Knowledge Base Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
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
        <Card onClick={() => navigate('/specialists')} className="!p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(155,89,182,0.12)', color: '#9B6BFF' }}>
                <Users size={18} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Specialists</div>
                <div className="text-sm font-bold mt-0.5">Meet our team</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Expert TikTok recovery specialists.</div>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--accent)' }} />
          </div>
        </Card>
        <Card onClick={() => navigate('/policies')} className="!p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(250,166,26,0.12)', color: '#FAA61A' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Policy Alerts</div>
                <div className="text-sm font-bold mt-0.5">TikTok policy updates</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Stay informed on policy changes.</div>
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
                              {c.staff_name && (
                                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                  <Users size={10} /> {c.staff_name}
                                </span>
                              )}
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
        <Button variant="outline" onClick={() => navigate('/cases')} className="flex-1 min-w-[150px]">
          <Upload size={16} /> Upload Evidence
        </Button>
      </div>
    </div>
  );
}