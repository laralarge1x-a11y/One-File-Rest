import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  Button, Card, Badge, CardSkeleton, Progress, Tabs, TabContent,
} from '../../components/ui';
import { Dialog } from '../../components/ui/dialog';
import {
  CreditCard, CheckCircle, XCircle, Clock, TrendingUp, Users,
  Receipt, ExternalLink, Plus, Trash2, AlertCircle, Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface SubscriptionData {
  plan: string;
  plan_start: string;
  plan_expiry: string;
  status: 'active' | 'cancelled' | 'expired';
  price: number;
  currency: string;
  interval: 'month' | 'year';
  cancel_at_period_end: boolean;
  linked_accounts: TikTokAccount[];
  billing_history: BillingEntry[];
  usage: UsageStats;
  features: string[];
}

interface TikTokAccount {
  id: number;
  username: string;
  avatar_url?: string;
  status: 'linked' | 'unlinked' | 'suspended';
  active_cases: number;
}

interface BillingEntry {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
  invoice_url?: string;
}

interface UsageStats {
  appeals_used: number;
  appeals_limit: number;
  active_cases: number;
  period_start: string;
  period_end: string;
}

/* ------------------------------------------------------------------ */
/*  Theme map (mirrors Dashboard)                                     */
/* ------------------------------------------------------------------ */

const PLAN_THEMES: Record<string, { glow: string; accent: string; label: string }> = {
  basic_guard:         { glow: 'rgba(88,101,242,0.30)',  accent: '#5865F2', label: 'Basic Guard' },
  fortnightly_defense: { glow: 'rgba(87,242,135,0.30)',  accent: '#57F287', label: 'Fortnightly Defense' },
  proshield_creator:   { glow: 'rgba(254,231,92,0.30)',  accent: '#FEE75C', label: 'ProShield Creator' },
  free:                { glow: 'rgba(255,255,255,0.10)', accent: '#888888', label: 'Free' },
};

/* ------------------------------------------------------------------ */
/*  Fetch helper                                                      */
/* ------------------------------------------------------------------ */

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  label,
  value,
  accent,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
  isLoading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card noHover className="!p-4 h-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[var(--text-muted)] uppercase font-semibold tracking-wider">
            {label}
          </span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accent}1a`, color: accent }}
          >
            {icon}
          </div>
        </div>
        {isLoading ? (
          <div className="h-8 w-16 skeleton rounded" />
        ) : (
          <div
            className="text-[28px] font-extrabold leading-none"
            style={{ color: accent }}
          >
            {value}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badges                                                     */
/* ------------------------------------------------------------------ */

const STATUS_BADGE_MAP: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default' | 'info'; icon: React.ReactNode }> = {
  active:    { variant: 'success', icon: <CheckCircle size={12} /> },
  cancelled: { variant: 'warning', icon: <Clock size={12} /> },
  expired:   { variant: 'danger',  icon: <XCircle size={12} /> },
  paid:      { variant: 'success', icon: <CheckCircle size={12} /> },
  pending:   { variant: 'info',    icon: <Clock size={12} /> },
  failed:    { variant: 'danger',  icon: <AlertCircle size={12} /> },
};

/* ================================================================== */
/*  Main Page                                                         */
/* ================================================================== */

export default function Subscription() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ---- data fetching ---- */
  const {
    data: sub,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SubscriptionData>({
    queryKey: ['subscription'],
    queryFn: () => fetchJson('/api/subscriptions'),
  });

  /* ---- local state ---- */
  const [activeTab, setActiveTab] = useState('overview');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  /* ---- derived ---- */
  const planKey = (sub?.plan || user?.plan || 'free') as string;
  const planTheme = PLAN_THEMES[planKey] || PLAN_THEMES.free;

  const expiryDate = sub?.plan_expiry ? new Date(sub.plan_expiry) : null;
  const startDate = sub?.plan_start ? new Date(sub.plan_start) : null;
  const daysRemaining = expiryDate
    ? Math.max(0, Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const totalDays = planKey === 'fortnightly_defense' ? 14 : 30;
  const progressPct = daysRemaining !== null
    ? Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100)
    : 0;

  const usage = sub?.usage;
  const appealsRemaining = usage ? Math.max(0, usage.appeals_limit - usage.appeals_used) : 0;
  const daysLeftInPeriod = usage?.period_end
    ? Math.max(0, Math.round((new Date(usage.period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : daysRemaining ?? 0;

  const priceDisplay = sub?.price != null
    ? `$${sub.price}/${sub.interval === 'year' ? 'yr' : 'mo'}`
    : planKey === 'free' ? 'Free' : '—';

  /* ---- actions ---- */
  const handleCancelConfirm = useCallback(async () => {
    setCancelling(true);
    try {
      const r = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_period_end: true }),
      });
      if (!r.ok) throw new Error('Failed to cancel');
      await refetch();
      setCancelDialogOpen(false);
    } catch {
      /* error handled via query refetch failure */
    } finally {
      setCancelling(false);
    }
  }, [refetch]);

  /* ================================================================ */
  /*  Loading state                                                    */
  /* ================================================================ */
  if (isLoading) {
    return (
      <div className="page-wrap">
        <div className="mb-8">
          <h1 className="text-[26px] font-extrabold m-0" style={{ letterSpacing: -0.5 }}>
            Subscription
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your plan and billing
          </p>
        </div>
        <div className="space-y-4">
          <CardSkeleton count={1} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-glass)]"
              >
                <div className="h-4 w-20 skeleton rounded mb-3" />
                <div className="h-8 w-16 skeleton rounded" />
              </div>
            ))}
          </div>
          <CardSkeleton count={2} />
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  Error state                                                      */
  /* ================================================================ */
  if (isError) {
    return (
      <div className="page-wrap">
        <div className="mb-8">
          <h1 className="text-[26px] font-extrabold m-0" style={{ letterSpacing: -0.5 }}>
            Subscription
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your plan and billing
          </p>
        </div>
        <Card noHover className="!p-10 text-center">
          <AlertCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--danger)' }} />
          <h3 className="text-lg font-bold mb-2">Failed to load subscription data</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
          </p>
          <Button onClick={() => refetch()}>
            <TrendingUp size={16} />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  /* ================================================================ */
  /*  Main render                                                      */
  /* ================================================================ */
  return (
    <div className="page-wrap">
      {/* ---- Page header ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-[26px] font-extrabold m-0" style={{ letterSpacing: -0.5 }}>
          Subscription
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Manage your plan and billing
        </p>
      </motion.div>

      {/* ---- Tabs ---- */}
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'accounts', label: 'TikTok Accounts', count: sub?.linked_accounts?.length },
          { key: 'billing', label: 'Billing History' },
          { key: 'features', label: 'Plan Features' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {/* ============================================================ */}
      {/*  TAB: Overview                                               */}
      {/* ============================================================ */}
      <TabContent active={activeTab} value="overview">
        {/* --- Plan Overview Card --- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-4"
        >
          <Card glowing glowColor={planTheme.glow} noHover className="!p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">
                  Current Plan
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl font-extrabold">{planTheme.label}</span>
                  <Badge
                    variant={STATUS_BADGE_MAP[sub?.status || 'active']?.variant ?? 'default'}
                    size="sm"
                  >
                    {STATUS_BADGE_MAP[sub?.status || 'active']?.icon}
                    {(sub?.status || 'active').charAt(0).toUpperCase() + (sub?.status || 'active').slice(1)}
                  </Badge>
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">{priceDisplay}</div>
                {sub?.cancel_at_period_end && (
                  <div className="text-xs font-semibold mt-1.5" style={{ color: 'var(--warning)' }}>
                    Cancels at end of billing period
                  </div>
                )}
              </div>

              {/* Renewal countdown */}
              {daysRemaining !== null && (
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    {sub?.cancel_at_period_end ? 'Expires in' : 'Renews in'}
                  </div>
                  <div
                    className="text-[28px] font-extrabold mt-0.5 leading-none"
                    style={{
                      color: daysRemaining < 5 ? 'var(--danger)' : 'var(--text-primary)',
                    }}
                  >
                    {daysRemaining}
                    <span className="text-sm font-bold text-[var(--text-muted)] ml-0.5">days</span>
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {daysRemaining !== null && totalDays > 0 && (
              <div className="mt-4">
                <Progress
                  value={progressPct}
                  glowColor={planTheme.glow}
                />
                <div className="flex justify-between mt-1.5 text-[10px] text-[var(--text-muted)] font-medium">
                  <span>
                    {startDate ? startDate.toLocaleDateString() : 'Start'}
                  </span>
                  <span>{Math.round(progressPct)}% complete</span>
                  <span>
                    {expiryDate ? expiryDate.toLocaleDateString() : 'End'}
                  </span>
                </div>
              </div>
            )}

            {/* Plan features (preview) */}
            {sub?.features && sub.features.length > 0 && (
              <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-4 gap-y-1.5">
                {sub.features.slice(0, 4).map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    {f}
                  </div>
                ))}
                {sub.features.length > 4 && (
                  <div className="text-xs text-[var(--text-muted)] italic mt-0.5">
                    +{sub.features.length - 4} more features
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        {/* --- Usage Stats Grid --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard
            icon={<TrendingUp size={15} />}
            label="Appeals Used"
            value={usage ? `${usage.appeals_used} / ${usage.appeals_limit}` : '—'}
            accent={planTheme.accent}
            isLoading={isLoading}
          />
          <StatCard
            icon={<CheckCircle size={15} />}
            label="Appeals Remaining"
            value={usage ? appealsRemaining : '—'}
            accent={appealsRemaining < 3 ? 'var(--danger)' : 'var(--success)'}
            isLoading={isLoading}
          />
          <StatCard
            icon={<Users size={15} />}
            label="Active Cases"
            value={usage?.active_cases ?? 0}
            accent="#5865F2"
            isLoading={isLoading}
          />
          <StatCard
            icon={<Clock size={15} />}
            label="Days Left"
            value={daysLeftInPeriod}
            accent={daysLeftInPeriod < 5 ? 'var(--danger)' : 'var(--text-secondary)'}
            isLoading={isLoading}
          />
        </div>

        {/* --- Manage Subscription actions --- */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="flex gap-3 flex-wrap mb-4"
        >
          {planKey !== 'proshield_creator' && planKey !== 'free' && (
            <Button
              variant="secondary"
              onClick={() => navigate('/plans')}
            >
              <CreditCard size={16} />
              Upgrade Plan
            </Button>
          )}
          {planKey !== 'free' && !sub?.cancel_at_period_end && (
            <Button
              variant="danger"
              onClick={() => setCancelDialogOpen(true)}
            >
              <XCircle size={16} />
              Cancel Subscription
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => window.open('/contact', '_blank')}
          >
            <AlertCircle size={16} />
            Contact Support
          </Button>
        </motion.div>
      </TabContent>

      {/* ============================================================ */}
      {/*  TAB: TikTok Accounts                                         */}
      {/* ============================================================ */}
      <TabContent active={activeTab} value="accounts">
        <Card noHover className="!p-0 overflow-hidden">
          {(!sub?.linked_accounts || sub.linked_accounts.length === 0) ? (
            /* --- Empty state --- */
            <div className="text-center py-12 px-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(88,101,242,0.12)' }}
              >
                <Users size={28} style={{ color: '#5865F2' }} />
              </div>
              <h3 className="text-lg font-bold mb-1">No accounts linked</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                Connect your TikTok accounts to get started with appeal management and recovery.
              </p>
              <Button>
                <Plus size={16} />
                Link TikTok Account
              </Button>
            </div>
          ) : (
            /* --- Account list --- */
            <div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-muted)] uppercase font-semibold tracking-wider">
                  {sub.linked_accounts.length} account{sub.linked_accounts.length !== 1 ? 's' : ''} linked
                </span>
                <Button size="sm" variant="secondary">
                  <Plus size={14} />
                  Link Account
                </Button>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {sub.linked_accounts.map((account, idx) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-glass-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      {account.avatar_url ? (
                        <img
                          src={account.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-[var(--border)] shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: 'rgba(88,101,242,0.15)', color: '#5865F2' }}
                        >
                          @{account.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          @{account.username}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {account.active_cases} active case{account.active_cases !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant={account.status === 'linked' ? 'success' : account.status === 'suspended' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {account.status}
                      </Badge>
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(237,66,69,0.12)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => {
                          /* Remove account — use confirm for simplicity */
                          if (window.confirm(`Remove @${account.username} from your subscription?`)) {
                            fetch(`/api/accounts/${account.id}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            }).then(() => refetch());
                          }
                        }}
                        title="Remove account"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </TabContent>

      {/* ============================================================ */}
      {/*  TAB: Billing History                                         */}
      {/* ============================================================ */}
      <TabContent active={activeTab} value="billing">
        <Card noHover className="!p-0 overflow-hidden">
          {(!sub?.billing_history || sub.billing_history.length === 0) ? (
            /* --- Empty state --- */
            <div className="text-center py-12 px-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(88,101,242,0.12)' }}
              >
                <Receipt size={28} style={{ color: '#5865F2' }} />
              </div>
              <h3 className="text-lg font-bold mb-1">No billing history yet</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                Your invoices and payment records will appear here once you have an active paid plan.
              </p>
            </div>
          ) : (
            /* --- Table --- */
            <div>
              <div className="px-5 py-3 border-b border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-muted)] uppercase font-semibold tracking-wider">
                  Payment History
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-left px-5 py-3 font-medium">Description</th>
                      <th className="text-left px-5 py-3 font-medium">Amount</th>
                      <th className="text-left px-5 py-3 font-medium">Status</th>
                      <th className="text-right px-5 py-3 font-medium">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sub.billing_history.map((entry, idx) => {
                      const badgeInfo = STATUS_BADGE_MAP[entry.status] || STATUS_BADGE_MAP.pending;
                      return (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-glass-hover)] transition-colors"
                        >
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-5 py-3.5 text-[var(--text-secondary)]">
                            {entry.description}
                          </td>
                          <td className="px-5 py-3.5 font-semibold whitespace-nowrap">
                            ${entry.amount.toFixed(2)}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant={badgeInfo.variant as any} size="sm">
                              {badgeInfo.icon}
                              {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {entry.invoice_url ? (
                              <a
                                href={entry.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                                style={{ color: 'var(--accent)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                              >
                                <Download size={12} />
                                PDF
                              </a>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </TabContent>

      {/* ============================================================ */}
      {/*  TAB: Plan Features                                           */}
      {/* ============================================================ */}
      <TabContent active={activeTab} value="features">
        <Card noHover className="!p-6">
          <div className="mb-4">
            <h3 className="text-lg font-extrabold">{planTheme.label} Features</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Everything included in your current plan.
            </p>
          </div>

          {(!sub?.features || sub.features.length === 0) ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-muted)]">
                No feature details available for this plan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sub.features.map((feature, idx) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.035 }}
                  className="flex items-start gap-3 p-3 rounded-[var(--radius-md)]"
                  style={{ background: 'var(--bg-glass)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(87,242,135,0.12)' }}
                  >
                    <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium">{feature}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </TabContent>

      {/* ============================================================ */}
      {/*  Cancel Confirmation Dialog                                   */}
      {/* ============================================================ */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="Cancel Subscription"
      >
        <div className="space-y-4">
          <div
            className="flex items-start gap-3 p-4 rounded-[var(--radius-md)]"
            style={{ background: 'rgba(237,66,69,0.08)', border: '1px solid rgba(237,66,69,0.2)' }}
          >
            <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                Are you sure you want to cancel?
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                Your subscription will remain active until the end of the current billing period
                ({daysRemaining ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}` : 'soon'}).
                After that, your plan will be downgraded to Free and you may lose access to premium features.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setCancelDialogOpen(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="danger"
              loading={cancelling}
              onClick={handleCancelConfirm}
            >
              <XCircle size={16} />
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}