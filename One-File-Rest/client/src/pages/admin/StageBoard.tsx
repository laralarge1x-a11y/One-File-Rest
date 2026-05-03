import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDroppable, useDraggable, useSensor, useSensors,
} from '@dnd-kit/core';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../components/customer';
import StageChip from '../../components/case/StageChip';
import { STAGES, type StageId, type StageMeta } from '@shared/stages';

interface KanbanCase {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  stage: StageId;
  priority: 'normal' | 'high' | 'critical';
  appeal_deadline: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  user_discord_id: string;
  staff_assigned_id: string | null;
  discord_username: string;
  discord_avatar?: string | null;
  plan?: string | null;
  staff_name?: string | null;
  unread_count: number;
}

interface BoardData {
  stages: Array<StageMeta & { total: number; cases: KanbanCase[] }>;
  smart: { needs_my_attention: KanbanCase[] };
}

interface StageHistoryRow {
  id: number;
  case_id: number;
  from_stage: StageId | null;
  to_stage: StageId;
  from_status: string | null;
  to_status: string;
  actor_discord_id: string | null;
  actor_username: string | null;
  actor_name: string | null;
  source: string;
  note: string | null;
  created_at: string;
}

interface StaffOption { discord_id: string; name: string }

const PLAN_OPTIONS = [
  { value: '',          label: 'All plans' },
  { value: 'free',      label: 'Free' },
  { value: 'basic_guard', label: 'Basic Guard' },
  { value: 'plus',      label: 'Plus' },
  { value: 'elite',     label: 'Elite' },
];
const PRIORITY_OPTIONS = [
  { value: '',         label: 'Any priority' },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High' },
  { value: 'normal',   label: 'Normal' },
];
const AGE_OPTIONS = [
  { value: '0', label: 'Any age' },
  { value: '3', label: 'Idle 3+ days' },
  { value: '7', label: 'Idle 7+ days' },
  { value: '14', label: 'Idle 14+ days' },
];

export default function StageBoard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyFor, setHistoryFor] = useState<KanbanCase | null>(null);
  const [history, setHistory] = useState<StageHistoryRow[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<StageId>>(new Set(['resolved_won', 'resolved_lost']));
  const [smartOpen, setSmartOpen] = useState(false);
  const [staff, setStaff] = useState<StaffOption[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const fPlan     = params.get('plan')     || '';
  const fPriority = params.get('priority') || '';
  const fAge      = params.get('ageDays')  || '0';
  const fAssigned = params.get('assigned') || '';
  const fMine     = params.get('mine')     === '1';

  const setFilterParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  const fetchBoard = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (fPlan)     qs.set('plan', fPlan);
      if (fPriority) qs.set('priority', fPriority);
      if (fAge && fAge !== '0') qs.set('ageDays', fAge);
      if (fAssigned) qs.set('assigned', fAssigned);
      if (fMine)     qs.set('mine', '1');
      const r = await fetch(`/api/admin/stage-board?${qs.toString()}`, { credentials: 'include' });
      if (r.ok) setData(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [fPlan, fPriority, fAge, fAssigned, fMine]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  useEffect(() => {
    fetch('/api/admin/staff', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) return setStaff([]);
        setStaff(rows.map((s: { discord_id: string; name: string }) => ({ discord_id: s.discord_id, name: s.name })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchBoard();
    socket.on('case:status_changed', refresh);
    return () => { socket.off('case:status_changed', refresh); };
  }, [socket, fetchBoard]);

  const allCases = useMemo(() => {
    const m = new Map<number, KanbanCase>();
    if (!data) return m;
    for (const s of data.stages) for (const c of s.cases) m.set(c.id, c);
    return m;
  }, [data]);

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId || !data) return;
    const caseId = Number(e.active.id);
    const toStage = String(overId).replace(/^col-/, '') as StageId;
    const card = allCases.get(caseId);
    if (!card || card.stage === toStage) return;

    // If the dragged card is part of a multi-select, move all of them.
    const ids = selected.has(caseId) ? Array.from(selected) : [caseId];

    setData((prev) => {
      if (!prev) return prev;
      const next = prev.stages.map((s) => ({ ...s, cases: [...s.cases] }));
      const toCol = next.find((s) => s.id === toStage);
      if (!toCol) return prev;
      for (const id of ids) {
        const c = allCases.get(id);
        if (!c || c.stage === toStage) continue;
        const fromCol = next.find((s) => s.id === c.stage);
        if (!fromCol) continue;
        fromCol.cases = fromCol.cases.filter((cc) => cc.id !== id);
        fromCol.total = Math.max(0, fromCol.total - 1);
        toCol.cases = [{ ...c, stage: toStage }, ...toCol.cases];
        toCol.total += 1;
      }
      return { ...prev, stages: next };
    });
    setSelected(new Set());

    try {
      if (ids.length > 1) {
        const r = await fetch('/api/admin/stage-board/bulk-move', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseIds: ids, toStage }),
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        const meta = STAGES.find((s) => s.id === toStage);
        toast(`Moved ${j.moved} case${j.moved === 1 ? '' : 's'} → ${meta?.label || toStage}`, 'success');
      } else {
        const r = await fetch('/api/admin/stage-board/move', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, toStage }),
        });
        if (!r.ok) throw new Error(await r.text());
        const meta = STAGES.find((s) => s.id === toStage);
        toast(`#${caseId} → ${meta?.label || toStage}`, 'success');
      }
    } catch (err) {
      console.error(err);
      toast('Move failed — reverting', 'error');
      fetchBoard();
    }
  };

  const openHistory = async (c: KanbanCase) => {
    setHistoryFor(c);
    setHistory([]);
    try {
      const r = await fetch(`/api/admin/stage-board/history/${c.id}`, { credentials: 'include' });
      if (r.ok) {
        const j: { history: StageHistoryRow[] } = await r.json();
        setHistory(j.history || []);
      }
    } catch { /* ignored */ }
  };

  const filtered: BoardData | null = useMemo(() => {
    if (!data) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return data;
    const match = (c: KanbanCase) =>
      String(c.id).includes(q) ||
      (c.account_username || '').toLowerCase().includes(q) ||
      (c.violation_type || '').toLowerCase().includes(q) ||
      (c.discord_username || '').toLowerCase().includes(q);
    return {
      ...data,
      stages: data.stages.map((s) => ({ ...s, cases: s.cases.filter(match) })),
      smart: { needs_my_attention: data.smart.needs_my_attention.filter(match) },
    };
  }, [data, filter]);

  const toggleSelect = (id: number, additive: boolean) => {
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set<number>();
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCollapsed = (id: StageId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkMove = async (toStage: StageId) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setSelected(new Set());
    try {
      const r = await fetch('/api/admin/stage-board/bulk-move', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseIds: ids, toStage }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      toast(`Moved ${j.moved} of ${ids.length} cases`, 'success');
      fetchBoard();
    } catch {
      toast('Bulk move failed', 'error');
      fetchBoard();
    }
  };

  const bulkAssign = async () => {
    if (selected.size === 0) return;
    const choices = ['(unassign)', ...staff.map((s) => s.name)].join('\n  ');
    const pick = window.prompt(`Assign ${selected.size} cases to:\n  ${choices}\n\nType the staff name (or "unassign"):`, '');
    if (pick === null) return;
    const trimmed = pick.trim().toLowerCase();
    const staffMatch = trimmed === 'unassign' || trimmed === '' || trimmed === '(unassign)'
      ? null
      : staff.find((s) => s.name.toLowerCase() === trimmed);
    if (trimmed && trimmed !== 'unassign' && trimmed !== '(unassign)' && !staffMatch) {
      toast(`No staff named "${pick}"`, 'error');
      return;
    }
    const ids = Array.from(selected);
    setSelected(new Set());
    try {
      const r = await fetch('/api/admin/stage-board/bulk-assign', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseIds: ids, staffDiscordId: staffMatch ? staffMatch.discord_id : null }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      toast(`Assigned ${j.assigned} of ${ids.length} cases`, 'success');
      fetchBoard();
    } catch {
      toast('Bulk assign failed', 'error');
      fetchBoard();
    }
  };

  const bulkSnooze = async () => {
    if (selected.size === 0) return;
    const hoursStr = window.prompt(`Snooze ${selected.size} cases for how many hours? (1–720)`, '24');
    if (!hoursStr) return;
    const hours = parseInt(hoursStr);
    if (!hours || hours < 1) { toast('Invalid hours', 'error'); return; }
    const reason = window.prompt('Reason (optional, shown in audit log):', '') || '';
    const ids = Array.from(selected);
    setSelected(new Set());
    try {
      const r = await fetch('/api/admin/stage-board/bulk-snooze', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseIds: ids, hours, reason: reason || undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      toast(`Snoozed ${j.snoozed} of ${ids.length} cases for ${hours}h`, 'success');
      fetchBoard();
    } catch {
      toast('Bulk snooze failed', 'error');
      fetchBoard();
    }
  };

  const bulkNudge = async () => {
    if (selected.size === 0) return;
    const message = window.prompt(`Send a nudge to ${selected.size} customers:`, 'Your specialist is actively working on your case.');
    if (!message) return;
    const ids = Array.from(selected);
    setSelected(new Set());
    try {
      const r = await fetch('/api/admin/stage-board/bulk-nudge', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseIds: ids, message }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      toast(`Nudged ${j.nudged} of ${ids.length} customers`, 'success');
    } catch {
      toast('Bulk nudge failed', 'error');
    }
  };

  const selectAllInColumn = (stage: StageId) => {
    if (!filtered) return;
    const col = filtered.stages.find((s) => s.id === stage);
    if (!col) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = col.cases.every((c) => next.has(c.id));
      if (allSelected) {
        for (const c of col.cases) next.delete(c.id);
      } else {
        for (const c of col.cases) next.add(c.id);
      }
      return next;
    });
  };

  if (loading) return <div style={{ padding: 24, color: '#888' }}>Loading stage board…</div>;
  if (!filtered) return <div style={{ padding: 24, color: '#888' }}>Stage board unavailable.</div>;

  const activeCard = activeId !== null ? allCases.get(activeId) : null;
  const filtersActive = !!(fPlan || fPriority || fAssigned || fMine || (fAge && fAge !== '0'));
  const smartCount = filtered.smart.needs_my_attention.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      <header style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>Stage Board</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
            Drag cases between columns — multi-select with ⌘/Ctrl-click for bulk moves. Customers and Discord are notified instantly.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter @user, #id, violation…"
            style={{
              padding: '8px 12px', borderRadius: 8,
              background: '#101015', border: '1px solid #2a2a32',
              color: '#fff', fontSize: 12, width: 220,
            }}
          />
          <button onClick={fetchBoard} style={ghostBtn}>↻ Refresh</button>
        </div>
      </header>

      {/* ── Filter row ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 24px 12px',
        flexWrap: 'wrap',
      }}>
        <FilterChip
          label={smartCount > 0 ? `Needs my attention · ${smartCount}` : 'Needs my attention'}
          active={smartOpen}
          onClick={() => setSmartOpen((v) => !v)}
          accent="#FAA61A"
        />
        <FilterChip
          label={fMine ? 'Assigned to me ✓' : 'Assigned to me'}
          active={fMine}
          onClick={() => setFilterParam('mine', fMine ? '' : '1')}
        />

        <Select value={fAssigned} onChange={(v) => setFilterParam('assigned', v)} options={[
          { value: '',           label: 'Anyone' },
          { value: 'unassigned', label: 'Unassigned' },
          ...staff.map((s) => ({ value: s.discord_id, label: s.name })),
        ]} />
        <Select value={fPlan}     onChange={(v) => setFilterParam('plan', v)}     options={PLAN_OPTIONS} />
        <Select value={fPriority} onChange={(v) => setFilterParam('priority', v)} options={PRIORITY_OPTIONS} />
        <Select value={fAge}      onChange={(v) => setFilterParam('ageDays', v === '0' ? '' : v)} options={AGE_OPTIONS} />

        {filtersActive && (
          <button onClick={() => setParams(new URLSearchParams(), { replace: true })} style={{ ...ghostBtn, color: '#FAA61A', borderColor: '#FAA61A55' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* ── Smart bucket strip ────────────────────────────────────────────── */}
      {smartOpen && (
        <div style={{
          margin: '0 24px 12px', padding: 12,
          background: 'linear-gradient(180deg, rgba(250,166,26,0.08), rgba(250,166,26,0.02))',
          border: '1px solid rgba(250,166,26,0.3)', borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FAA61A', textTransform: 'uppercase', letterSpacing: 0.08 }}>
              Needs my attention · {smartCount}
            </div>
            <button onClick={() => setSmartOpen(false)} style={{ ...ghostBtn, padding: '4px 8px' }}>Hide</button>
          </div>
          {smartCount === 0 ? (
            <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>Inbox zero — nothing waiting on you right now.</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {filtered.smart.needs_my_attention.slice(0, 12).map((c) => (
                <div key={c.id} style={{ minWidth: 220, maxWidth: 240 }}>
                  <Card c={c} onOpen={() => navigate(`/admin/cases/${c.id}`)} onHistory={() => openHistory(c)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bulk action toolbar ───────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div style={{
          margin: '0 24px 12px', padding: '10px 14px',
          background: '#1c1c2a', border: '1px solid #5865F255', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {selected.size} selected
          </div>
          <button onClick={bulkAssign} style={{ ...ghostBtn, color: '#5865F2', borderColor: '#5865F255' }}>Assign…</button>
          <button onClick={bulkSnooze} style={{ ...ghostBtn, color: '#FAA61A', borderColor: '#FAA61A55' }}>Snooze…</button>
          <button onClick={bulkNudge} style={{ ...ghostBtn, color: '#57F287', borderColor: '#57F28755' }}>Nudge…</button>
          <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>Move all to:</span>
          {STAGES.map((s) => (
            <button key={s.id} onClick={() => bulkMove(s.id)} style={{
              padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: `${s.color}22`, border: `1px solid ${s.color}55`, color: s.color,
              cursor: 'pointer',
            }}>{s.short}</button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{ ...ghostBtn, marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="kanban-grid" style={{
          flex: 1, overflowX: 'auto', padding: '4px 16px 24px',
          display: 'grid', gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(260px, 1fr)',
          gap: 12, alignItems: 'start',
        }}>
          {filtered.stages.map((col) => (
            <Column
              key={col.id}
              stage={col}
              collapsed={collapsed.has(col.id) && col.terminal}
              onToggleCollapsed={() => toggleCollapsed(col.id)}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSelectAll={() => selectAllInColumn(col.id)}
              onOpenCase={(id) => navigate(`/admin/cases/${id}`)}
              onOpenHistory={openHistory}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard ? <Card c={activeCard} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {historyFor && (
        <HistoryDrawer
          c={historyFor}
          history={history}
          onClose={() => setHistoryFor(null)}
          onOpen={() => navigate(`/admin/cases/${historyFor.id}`)}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .kanban-grid { grid-auto-columns: minmax(240px, 80vw); padding: 4px 12px 24px; }
        }
      `}</style>
    </div>
  );
}

function Column({
  stage, collapsed, onToggleCollapsed, selected, onToggleSelect, onSelectAll, onOpenCase, onOpenHistory,
}: {
  stage: BoardData['stages'][number];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  selected: Set<number>;
  onToggleSelect: (id: number, additive: boolean) => void;
  onSelectAll: () => void;
  onOpenCase: (id: number) => void;
  onOpenHistory: (c: KanbanCase) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage.id}` });
  const visibleIds = stage.cases.map((c) => c.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id));
  return (
    <div ref={setNodeRef} style={{
      background: isOver ? '#15151c' : '#0e0e13',
      border: `1px solid ${isOver ? stage.color + '66' : '#1a1a22'}`,
      borderTop: `3px solid ${stage.color}`,
      borderRadius: 12, display: 'flex', flexDirection: 'column',
      minHeight: collapsed ? 60 : 200, transition: 'background 0.15s, border-color 0.15s',
    }}>
      <button
        type="button"
        onClick={stage.terminal ? onToggleCollapsed : undefined}
        title={stage.description}
        style={{
          background: 'transparent', border: 'none', padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: collapsed ? 'none' : '1px solid #1a1a22',
          cursor: stage.terminal ? 'pointer' : 'default',
          width: '100%', color: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {visibleIds.length > 0 && (
            <input
              type="checkbox"
              aria-label={`Select all in ${stage.label}`}
              title={allSelected ? 'Clear column selection' : 'Select all in this column'}
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onClick={(e) => e.stopPropagation()}
              onChange={onSelectAll}
              style={{ accentColor: stage.color, cursor: 'pointer' }}
            />
          )}
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, boxShadow: `0 0 8px ${stage.glow}` }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.2 }}>{stage.label.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#888', background: '#1a1a22', padding: '2px 8px', borderRadius: 999 }}>
            {stage.total}
          </span>
          {stage.terminal && <span style={{ fontSize: 10, color: '#666' }}>{collapsed ? '▶' : '▼'}</span>}
        </div>
      </button>
      {!collapsed && (
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          {stage.cases.length === 0 ? (
            <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: '#444', fontStyle: 'italic' }}>
              No cases here.
            </div>
          ) : stage.cases.map((c) => (
            <DraggableCard
              key={c.id} c={c}
              isSelected={selected.has(c.id)}
              onSelect={(additive) => onToggleSelect(c.id, additive)}
              onOpen={() => onOpenCase(c.id)}
              onHistory={() => onOpenHistory(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableCard({ c, isSelected, onSelect, onOpen, onHistory }: {
  c: KanbanCase; isSelected: boolean; onSelect: (additive: boolean) => void;
  onOpen: () => void; onHistory: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <Card
        c={c} isSelected={isSelected} onSelect={onSelect}
        onOpen={onOpen} onHistory={onHistory}
        dragHandleProps={listeners}
      />
    </div>
  );
}

type DragHandleProps = ReturnType<typeof useDraggable>['listeners'];

function Card({
  c, dragging, isSelected, onSelect, onOpen, onHistory, dragHandleProps,
}: {
  c: KanbanCase; dragging?: boolean; isSelected?: boolean;
  onSelect?: (additive: boolean) => void;
  onOpen?: () => void; onHistory?: () => void;
  dragHandleProps?: DragHandleProps;
}) {
  const overdue = !!c.appeal_deadline && new Date(c.appeal_deadline).getTime() < Date.now();
  return (
    <div
      onClick={(e) => {
        if (!onSelect) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) { e.stopPropagation(); onSelect(true); }
      }}
      style={{
        background: isSelected ? '#1c1c2a' : '#13131a',
        border: `1px solid ${isSelected ? '#5865F2' : '#1f1f28'}`,
        borderRadius: 10,
        padding: 12, cursor: dragging ? 'grabbing' : 'grab',
        boxShadow: dragging ? '0 12px 32px rgba(0,0,0,0.5)' : 'none',
        transform: dragging ? 'rotate(-1.5deg)' : 'none',
      }}
      {...(dragHandleProps || {})}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#666' }}>#{c.id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {c.priority === 'critical' && <span title="Critical" style={{ color: '#ED4245', fontSize: 10, fontWeight: 700 }}>● HIGH</span>}
          {c.unread_count > 0 && (
            <span title={`${c.unread_count} unread`} style={{ fontSize: 10, color: '#fff', background: '#5865F2', padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>
              {c.unread_count}
            </span>
          )}
        </div>
      </div>
      <div
        onClick={(e) => { if (onOpen && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.stopPropagation(); onOpen(); } }}
        style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4, cursor: 'pointer' }}
      >
        @{c.account_username || 'unknown'}
      </div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {c.violation_type || 'No violation type'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#666' }}>
        <span>{c.staff_name || c.discord_username}</span>
        {overdue ? (
          <span style={{ color: '#ED4245', fontWeight: 700 }}>OVERDUE</span>
        ) : c.appeal_deadline ? (
          <span>Due {new Date(c.appeal_deadline).toLocaleDateString()}</span>
        ) : (
          <span>{new Date(c.updated_at).toLocaleDateString()}</span>
        )}
      </div>
      {onHistory && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); onHistory(); }} style={tinyBtn}>History</button>
          {onOpen && <button onClick={(e) => { e.stopPropagation(); onOpen(); }} style={tinyBtn}>Open →</button>}
        </div>
      )}
    </div>
  );
}

function HistoryDrawer({ c, history, onClose, onOpen }: {
  c: KanbanCase; history: StageHistoryRow[]; onClose: () => void; onOpen: () => void;
}) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div style={{ width: 'min(440px, 100%)', height: '100%', background: '#0e0e13', borderLeft: '1px solid #1a1a22', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a22', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, color: '#888' }}>Case #{c.id}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>@{c.account_username}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <StageChip stage={c.stage} long />
          </div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.08, color: '#5865F2', fontWeight: 700, marginBottom: 8 }}>Stage history</div>
          {history.length === 0 ? (
            <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>No moves recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((h) => (
                <div key={h.id} style={{ padding: 10, background: '#13131a', border: '1px solid #1f1f28', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                    {h.from_stage && <StageChip stage={h.from_stage} size="xs" />}
                    <span style={{ color: '#666' }}>→</span>
                    <StageChip stage={h.to_stage} size="xs" />
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {h.actor_name || h.actor_username || 'system'} · {new Date(h.created_at).toLocaleString()} · <span style={{ color: '#555' }}>{h.source}</span>
                  </div>
                  {h.note && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{h.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #1a1a22' }}>
          <button onClick={onOpen} style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#5865F2', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Open full case →
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick, accent }: {
  label: string; active: boolean; onClick: () => void; accent?: string;
}) {
  const color = accent || '#5865F2';
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: active ? `${color}22` : '#13131a',
      color: active ? color : '#aaa',
      border: `1px solid ${active ? `${color}66` : '#1f1f28'}`,
      cursor: 'pointer',
    }}>{label}</button>
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      padding: '6px 10px', borderRadius: 8,
      background: '#13131a', border: '1px solid #1f1f28',
      color: '#ccc', fontSize: 11, cursor: 'pointer',
    }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const tinyBtn: React.CSSProperties = {
  flex: 1, padding: '4px 8px', fontSize: 10, borderRadius: 5,
  background: '#1a1a22', color: '#aaa', border: '1px solid #2a2a32',
  cursor: 'pointer', fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, background: '#1a1a22',
  border: '1px solid #2a2a32', color: '#ccc', fontSize: 12, cursor: 'pointer',
};
