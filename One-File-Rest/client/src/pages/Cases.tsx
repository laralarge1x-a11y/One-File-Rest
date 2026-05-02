import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, StatusBadge, LoadingSpinner, EmptyState } from '../components/customer';

interface Case {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  priority: string;
  created_at: string;
  appeal_deadline?: string;
  violation_description?: string;
}

const FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'open',        label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
] as const;

const STATUS_COLOR: Record<string, string> = {
  open: '#FEE75C', pending: '#FEE75C',
  in_progress: '#5865F2', appealing: '#5865F2', in_review: '#5865F2',
  resolved: '#57F287', won: '#57F287',
  closed: 'rgba(255,255,255,0.4)', denied: '#ED4245',
};

export default function Cases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/cases', { credentials: 'include' });
        if (r.ok) setCases(await r.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <LoadingSpinner fullScreen label="Loading cases..." />;

  const matches = (c: Case) => {
    const s = (c.status || '').toLowerCase();
    if (filter === 'all') return true;
    if (filter === 'open') return s === 'open' || s === 'pending';
    if (filter === 'in_progress') return ['in_progress', 'appealing', 'in_review'].includes(s);
    if (filter === 'resolved') return ['resolved', 'won', 'closed', 'denied'].includes(s);
    return true;
  };
  const filtered = cases.filter(matches);

  return (
    <div className="page-wrap">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>My Cases</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            {cases.length} {cases.length === 1 ? 'case' : 'cases'} total
          </p>
        </div>
        <button onClick={() => navigate('/cases/new')} className="btn-primary">+ New Case</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const count = f.value === 'all' ? cases.length : cases.filter((c) => {
            const s = (c.status || '').toLowerCase();
            if (f.value === 'open') return s === 'open' || s === 'pending';
            if (f.value === 'in_progress') return ['in_progress', 'appealing', 'in_review'].includes(s);
            if (f.value === 'resolved') return ['resolved', 'won', 'closed', 'denied'].includes(s);
            return true;
          }).length;
          return (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              padding: '8px 16px', borderRadius: 999,
              background: active ? 'var(--accent)' : 'var(--bg-glass)',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              color: active ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600,
              transition: 'var(--transition)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {f.label}
              <span style={{
                fontSize: 11,
                padding: '2px 7px', borderRadius: 999,
                background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-glass-hover)',
                color: active ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GlassCard noHover style={{ padding: 8 }}>
              <EmptyState
                icon={filter === 'all' ? '📭' : '🔍'}
                title={filter === 'all' ? 'No cases yet' : 'No cases match this filter'}
                subtitle={filter === 'all' ? 'Submit your first case to get started.' : 'Try a different filter or submit a new case.'}
                actionLabel="Submit New Case"
                onAction={() => navigate('/cases/new')}
              />
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div key={filter}
            initial="hidden" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {filtered.map((c) => {
              const color = STATUS_COLOR[(c.status || '').toLowerCase()] || 'rgba(255,255,255,0.4)';
              return (
                <motion.div key={c.id}
                  variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                  whileHover={{ x: 4 }}
                >
                  <GlassCard onClick={() => navigate(`/cases/${c.id}`)}
                    style={{ padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
                    <div style={{ width: 4, background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 8px',
                            background: 'var(--bg-glass)', border: '1px solid var(--border)',
                            borderRadius: 6, color: 'var(--text-muted)', fontFamily: 'monospace',
                          }}>#{c.id}</span>
                          <StatusBadge status={c.status} size="sm" />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                          {c.violation_type || 'Case'} · <span style={{ color: 'var(--text-muted)' }}>@{c.account_username}</span>
                        </div>
                        {c.violation_description && (
                          <div style={{
                            fontSize: 13, color: 'var(--text-secondary)',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>{c.violation_description}</div>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 22, flexShrink: 0 }}>→</span>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
