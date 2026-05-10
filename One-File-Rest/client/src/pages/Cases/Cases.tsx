import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCases } from '../../hooks/queries/useCases';
import { useSocket } from '../../hooks/useSocket';
import { Card, Badge, Button, Input, CardSkeleton, Tabs, TabContent } from '../../components/ui';
import { StageChip } from '../../components/case';
import { statusToStage, type StageId } from '@shared/stages';
import {
  List, Columns, Layout, Search, Plus, ChevronRight, Clock,
  AlertCircle, CheckCircle2, Filter, SlidersHorizontal, X,
} from 'lucide-react';

type ViewMode = 'list' | 'kanban' | 'timeline';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Pending' },
  { value: 'active', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
] as const;

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ED4245',
  high: '#FAA61A',
  normal: '#5865F2',
  low: 'var(--text-muted)',
};

function filterCases(cases: any[], filter: string, search: string) {
  return cases.filter((c) => {
    const s = (c.status || '').toLowerCase();
    if (filter === 'open') return ['pending', 'intake'].includes(s);
    if (filter === 'active') return !['won', 'denied', 'closed', 'pending', 'intake'].includes(s);
    if (filter === 'resolved') return ['won', 'denied', 'closed'].includes(s);
    if (search) {
      const q = search.toLowerCase();
      return (
        c.account_username?.toLowerCase().includes(q) ||
        c.violation_type?.toLowerCase().includes(q) ||
        String(c.id).includes(q)
      );
    }
    return true;
  });
}

export default function Cases() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: cases, isLoading } = useCases();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const view = (searchParams.get('view') || 'list') as ViewMode;

  const setView = (v: ViewMode) => {
    const p = new URLSearchParams(searchParams);
    p.set('view', v);
    setSearchParams(p);
  };

  const processed = useMemo(() => {
    if (!cases) return [];
    return cases.map((c: any) => ({
      ...c,
      stage: c.stage || statusToStage(c.status, c.outcome),
    }));
  }, [cases]);

  const filtered = useMemo(() => filterCases(processed, filter, search), [processed, filter, search]);

  const { data: socketData } = useSocket() as any;

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-extrabold m-0" style={{ letterSpacing: -0.5 }}>My Cases</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {cases?.length || 0} {cases?.length === 1 ? 'case' : 'cases'} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-glass)] rounded-[var(--radius-md)] border border-[var(--border)] p-0.5">
            {([
              { v: 'list', icon: <List size={15} /> },
              { v: 'kanban', icon: <Columns size={15} /> },
              { v: 'timeline', icon: <Layout size={15} /> },
            ] as const).map(({ v, icon }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center transition-all"
                style={{
                  background: view === v ? 'var(--bg-glass-hover)' : 'transparent',
                  color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
                title={`${v} view`}
              >
                {icon}
              </button>
            ))}
          </div>
          <Button onClick={() => navigate('/cases/new')}>
            <Plus size={15} /> New Case
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] pl-9 pr-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-glow)] transition-all"
            placeholder="Search by username, violation, or case ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: active ? 'var(--accent)' : 'var(--bg-glass)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <CardSkeleton count={6} />
        </div>
      ) : filtered.length === 0 ? (
        <Card noHover className="!p-8">
          <div className="text-center py-12">
            <Search size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg font-bold">
              {search || filter !== 'all' ? 'No cases match your search' : 'No cases yet'}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 mb-6">
              {search || filter !== 'all' ? 'Try different filters or keywords.' : 'Submit your first case to get started.'}
            </p>
            {!search && filter === 'all' && (
              <Button onClick={() => navigate('/cases/new')}>
                <Plus size={15} /> Submit New Case
              </Button>
            )}
          </div>
        </Card>
      ) : view === 'list' ? (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {filtered.map((c: any, i: number) => {
              const priColor = PRIORITY_COLORS[c.priority] || 'var(--text-muted)';
              const daysLeft = c.appeal_deadline
                ? Math.max(0, Math.ceil((new Date(c.appeal_deadline).getTime() - Date.now()) / 86400000))
                : null;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card onClick={() => navigate(`/cases/${c.id}`)} noHover={false} className="!p-0 !overflow-hidden flex items-stretch">
                    <div className="w-1 shrink-0" style={{ background: priColor }} />
                    <div className="flex-1 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[11px] font-bold px-1.5 py-0.5 bg-[var(--bg-glass)] border border-[var(--border)] rounded text-[var(--text-muted)] font-mono">
                            #{c.id}
                          </span>
                          <StageChip stage={c.stage} size="sm" />
                          {daysLeft !== null && daysLeft <= 3 && (
                            <Badge variant="danger" size="sm">
                              <Clock size={10} /> {daysLeft}d left
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm font-semibold mb-0.5">
                          {c.violation_type || 'Case'} · <span className="text-[var(--text-muted)]">@{c.account_username}</span>
                        </div>
                        {c.violation_description && (
                          <div className="text-xs text-[var(--text-secondary)] line-clamp-1">{c.violation_description}</div>
                        )}
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[
            { stage: 'intake', label: 'Intake', color: '#5865F2' },
            { stage: 'appeal_drafting', label: 'Drafting', color: '#9B6BFF' },
            { stage: 'appeal_sent', label: 'Sent', color: '#3BA9FF' },
            { stage: 'tiktok_replied', label: 'Replied', color: '#FEE75C' },
            { stage: 'needs_retry', label: 'Retry', color: '#FFA94D' },
            { stage: 'resolved_won', label: 'Won', color: '#57F287' },
            { stage: 'resolved_lost', label: 'Lost', color: '#ED4245' },
          ].map((col) => {
            const colCases = filtered.filter((c: any) => c.stage === col.stage);
            return (
              <div key={col.stage}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{col.label}</span>
                  <span className="text-[11px] text-[var(--text-muted)] ml-auto">{colCases.length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {colCases.map((c: any) => (
                    <Card key={c.id} onClick={() => navigate(`/cases/${c.id}`)} className="!p-3">
                      <div className="text-[11px] font-mono text-[var(--text-muted)] mb-1">#{c.id}</div>
                      <div className="text-xs font-semibold leading-tight line-clamp-2">
                        {c.violation_type || 'Case'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">@{c.account_username}</div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Timeline View */
        <div className="relative pl-8">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--border)]" />
          <div className="space-y-4">
            {filtered.map((c: any, i: number) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                <div
                  className="absolute -left-8 top-1 w-[30px] h-[30px] rounded-full flex items-center justify-center border-2 z-10"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: PRIORITY_COLORS[c.priority] || '#5865F2',
                    color: PRIORITY_COLORS[c.priority] || '#5865F2',
                  }}
                >
                  <Clock size={12} />
                </div>
                <Card onClick={() => navigate(`/cases/${c.id}`)} className="!p-4 ml-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] font-mono">#{c.id}</span>
                    <StageChip stage={c.stage} size="sm" />
                  </div>
                  <div className="text-sm font-semibold">
                    {c.violation_type || 'Case'} · @{c.account_username}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-1">
                    {new Date(c.created_at).toLocaleDateString()}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}