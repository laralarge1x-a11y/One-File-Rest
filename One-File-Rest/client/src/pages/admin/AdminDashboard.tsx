// Staff Command Center — smart dispatcher with hot/stalled/in-flight/my-queue/snoozed tabs.
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';

interface QueueCase {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  priority: string;
  appeal_deadline: string | null;
  staff_assigned_id: string | null;
  snoozed_until: string | null;
  snooze_reason: string | null;
  updated_at: string;
  discord_username: string;
  plan: string | null;
  staff_name: string | null;
  hours_to_deadline: number | null;
  hours_since_update: number;
  unread_client: number;
  last_msg_at: string | null;
}

type TabKey = 'hot' | 'stalled' | 'in_flight' | 'my_queue' | 'snoozed';

const TABS: Array<{ key: TabKey; label: string; emoji: string; color: string }> = [
  { key: 'hot',       label: 'Hot',       emoji: '🔥', color: '#ED4245' },
  { key: 'stalled',   label: 'Stalled',   emoji: '⏳', color: '#F5A623' },
  { key: 'in_flight', label: 'In Flight', emoji: '✈️', color: '#5865F2' },
  { key: 'my_queue',  label: 'My Queue',  emoji: '⭐', color: '#FEE75C' },
  { key: 'snoozed',   label: 'Snoozed',   emoji: '💤', color: '#888' },
];

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ED4245', high: '#F5A623', normal: '#5865F2', low: '#888',
};

function fmtHours(h: number | null): string {
  if (h === null || h === undefined) return '—';
  if (h < 0) return `${Math.round(-h)}h overdue`;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [tab, setTab] = useState<TabKey>('hot');
  const [data, setData] = useState<Record<TabKey, QueueCase[]>>({ hot: [], stalled: [], in_flight: [], my_queue: [], snoozed: [] });
  const [counts, setCounts] = useState<Record<TabKey, number>>({ hot: 0, stalled: 0, in_flight: 0, my_queue: 0, snoozed: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoverPreview, setHoverPreview] = useState<{ id: number; data: any; x: number; y: number } | null>(null);
  const [snoozeModal, setSnoozeModal] = useState<{ ids: number[] } | null>(null);
  const [staffList, setStaffList] = useState<Array<{ discord_id: string; name: string }>>([]);
  const [presence, setPresence] = useState<Record<string, boolean>>({});

  const list = data[tab] || [];

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/queue', { credentials: 'include' });
      if (r.ok) {
        const j = await r.json();
        setData({ hot: j.hot || [], stalled: j.stalled || [], in_flight: j.in_flight || [], my_queue: j.my_queue || [], snoozed: j.snoozed || [] });
        setCounts(j.counts || { hot: 0, stalled: 0, in_flight: 0, my_queue: 0, snoozed: 0 });
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    fetch('/api/admin/staff', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((arr: any[]) => setStaffList(arr.map((s) => ({ discord_id: s.discord_id, name: s.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onCase = () => load();
    const onPresence = (p: { discordId: string; online: boolean }) => {
      setPresence((prev) => ({ ...prev, [p.discordId]: p.online }));
    };
    socket.on('case:created', onCase);
    socket.on('case:status_changed', onCase);
    socket.on('case:updated', onCase);
    socket.on('presence:update', onPresence);
    return () => {
      socket.off('case:created', onCase);
      socket.off('case:status_changed', onCase);
      socket.off('case:updated', onCase);
      socket.off('presence:update', onPresence);
    };
  }, [socket, load]);

  // Reset active index on tab change
  useEffect(() => { setActiveIdx(0); setSelected(new Set()); }, [tab]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (snoozeModal) return;
      const cur = list[activeIdx];
      if (e.key === 'j') { setActiveIdx((i) => Math.min(list.length - 1, i + 1)); e.preventDefault(); }
      else if (e.key === 'k') { setActiveIdx((i) => Math.max(0, i - 1)); e.preventDefault(); }
      else if (e.key === 'x' && cur) {
        setSelected((prev) => { const s = new Set(prev); s.has(cur.id) ? s.delete(cur.id) : s.add(cur.id); return s; });
        e.preventDefault();
      }
      else if (e.key === 'a' && cur) { bulk('assign', user?.discord_id, [cur.id]); e.preventDefault(); }
      else if (e.key === 's' && cur) { setSnoozeModal({ ids: [cur.id] }); e.preventDefault(); }
      else if ((e.key === 'e' || e.key === 'Enter') && cur) { navigate(`/admin/cases/${cur.id}`); }
      else if (e.key === '1') setTab('hot');
      else if (e.key === '2') setTab('stalled');
      else if (e.key === '3') setTab('in_flight');
      else if (e.key === '4') setTab('my_queue');
      else if (e.key === '5') setTab('snoozed');
      else if (e.key === '?') { alert('Shortcuts:\nj/k → navigate\nx → toggle select\na → assign to me\ns → snooze\ne / Enter → open case\n1-5 → switch tabs'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, activeIdx, user, navigate, snoozeModal]);

  const bulk = async (action: string, value: any, idsArg?: number[]) => {
    const ids = idsArg ?? Array.from(selected);
    if (ids.length === 0) return;
    const r = await fetch('/api/admin/cases/bulk', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action, value }),
    });
    if (r.ok) {
      setSelected(new Set());
      load();
    }
  };

  const snoozeApply = async (until: Date, reason: string) => {
    if (!snoozeModal) return;
    if (snoozeModal.ids.length === 1) {
      await fetch(`/api/admin/cases/${snoozeModal.ids[0]}/snooze`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ until: until.toISOString(), reason }),
      });
    } else {
      await bulk('snooze', until.toISOString(), snoozeModal.ids);
    }
    setSnoozeModal(null);
    load();
  };

  const handleHover = async (e: React.MouseEvent, c: QueueCase) => {
    if (hoverPreview?.id === c.id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverPreview({ id: c.id, data: null, x: rect.right + 12, y: rect.top });
    try {
      const r = await fetch(`/api/admin/cases/${c.id}/preview`, { credentials: 'include' });
      if (r.ok) {
        const j = await r.json();
        setHoverPreview((h) => h && h.id === c.id ? { ...h, data: j } : h);
      }
    } catch {}
  };

  const allSelected = list.length > 0 && list.every((c) => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(list.map((c) => c.id)));
  };

  return (
    <div style={{ padding: 28, color: '#fff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Command Center</h1>
          <div style={{ fontSize: 13, color: '#888' }}>
            {Object.values(counts).reduce((a, b) => a + b, 0)} active cases •
            <span style={{ marginLeft: 8, color: '#666' }}>Press <kbd style={kbd}>?</kbd> for shortcuts</span>
          </div>
        </div>
        <button onClick={load} style={{ ...btn, background: '#1a1a1a' }}>↻ Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #1a1a1a', flexWrap: 'wrap' }}>
        {TABS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px', background: 'transparent', border: 'none',
              borderBottom: '2px solid ' + (tab === t.key ? t.color : 'transparent'),
              color: tab === t.key ? '#fff' : '#888',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
            <span style={{
              padding: '1px 7px', fontSize: 11, fontWeight: 700,
              background: tab === t.key ? t.color : '#1a1a1a',
              color: tab === t.key ? '#000' : '#888',
              borderRadius: 999,
            }}>{counts[t.key]}</span>
            <span style={{ fontSize: 9, color: '#444', marginLeft: 4 }}>{i + 1}</span>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '10px 14px', background: '#1a1a1a',
            border: '1px solid #5865F2', borderRadius: 10,
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
          <select onChange={(e) => { if (e.target.value) bulk('assign', e.target.value); e.target.value = ''; }} style={sel}>
            <option value="">Assign to…</option>
            {staffList.map((s) => <option key={s.discord_id} value={s.discord_id}>{s.name}</option>)}
          </select>
          <select onChange={(e) => { if (e.target.value) bulk('priority', e.target.value); e.target.value = ''; }} style={sel}>
            <option value="">Set priority…</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <button onClick={() => setSnoozeModal({ ids: Array.from(selected) })} style={{ ...btn, background: '#333' }}>💤 Snooze</button>
          <button onClick={() => setSelected(new Set())} style={{ ...btn, background: 'transparent', border: '1px solid #333' }}>Clear</button>
        </motion.div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#666', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{TABS.find((t) => t.key === tab)?.emoji}</div>
          <div style={{ fontSize: 14 }}>No cases in this lane.</div>
        </div>
      ) : (
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 140px 120px 120px 90px 60px', gap: 10, padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #1a1a1a' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: '#5865F2' }} />
            <div>Case</div>
            <div>Assigned</div>
            <div>Status</div>
            <div>{tab === 'snoozed' ? 'Until' : tab === 'stalled' ? 'Stalled' : 'Deadline'}</div>
            <div>Plan</div>
            <div></div>
          </div>
          {list.map((c, i) => (
            <div
              key={c.id}
              onMouseEnter={(e) => handleHover(e, c)}
              onMouseLeave={() => setHoverPreview(null)}
              onClick={() => setActiveIdx(i)}
              onDoubleClick={() => navigate(`/admin/cases/${c.id}`)}
              style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 140px 120px 120px 90px 60px',
                gap: 10, padding: '12px 14px',
                borderBottom: '1px solid #161616',
                background: activeIdx === i ? 'rgba(88,101,242,0.08)' : selected.has(c.id) ? 'rgba(88,101,242,0.04)' : 'transparent',
                borderLeft: '3px solid ' + (activeIdx === i ? '#5865F2' : 'transparent'),
                alignItems: 'center', cursor: 'pointer',
              }}
            >
              <input
                type="checkbox" checked={selected.has(c.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  setSelected((prev) => { const s = new Set(prev); e.target.checked ? s.add(c.id) : s.delete(c.id); return s; });
                }}
                style={{ accentColor: '#5865F2' }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  #{c.id} • @{c.account_username}
                  {c.unread_client > 0 && <span style={{ background: '#ED4245', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>{c.unread_client} unread</span>}
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_COLOR[c.priority] || '#888' }} />
                </div>
                <div style={{ fontSize: 11, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.violation_type} • {c.discord_username}
                  {c.snooze_reason && tab === 'snoozed' && ` — ${c.snooze_reason}`}
                </div>
              </div>
              <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.staff_assigned_id ? (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: presence[c.staff_assigned_id] ? '#57F287' : '#444' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.staff_name || '?'}</span>
                  </>
                ) : (
                  <span style={{ color: '#666', fontStyle: 'italic' }}>Unassigned</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#aaa', textTransform: 'capitalize' }}>{c.status.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 11, color: tab === 'stalled' ? '#F5A623' : (c.hours_to_deadline !== null && c.hours_to_deadline < 24 ? '#ED4245' : '#aaa') }}>
                {tab === 'snoozed' && c.snoozed_until ? new Date(c.snoozed_until).toLocaleString() :
                 tab === 'stalled' ? `${Math.round(c.hours_since_update)}h idle` :
                 fmtHours(c.hours_to_deadline)}
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>{c.plan ? c.plan.replace(/_/g, ' ').slice(0, 10) : '—'}</div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/cases/${c.id}`); }} title="Open" style={iconBtn}>→</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hover preview */}
      <AnimatePresence>
        {hoverPreview && (
          <motion.div
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', left: Math.min(hoverPreview.x, window.innerWidth - 340),
              top: Math.min(hoverPreview.y, window.innerHeight - 280),
              width: 320, background: '#0a0a0a', border: '1px solid #2a2a2a',
              borderRadius: 10, padding: 14, zIndex: 1000, pointerEvents: 'none',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            }}
          >
            {!hoverPreview.data ? (
              <div style={{ color: '#666', fontSize: 12 }}>Loading…</div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>#{hoverPreview.data.id} • @{hoverPreview.data.account_username}</div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                  {hoverPreview.data.violation_type} • {hoverPreview.data.discord_username}
                </div>
                {hoverPreview.data.violation_description && (
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, lineHeight: 1.5 }}>
                    {String(hoverPreview.data.violation_description).slice(0, 220)}
                    {String(hoverPreview.data.violation_description).length > 220 ? '…' : ''}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666', marginBottom: 8 }}>
                  <span>💬 {hoverPreview.data.msg_count}</span>
                  <span>📎 {hoverPreview.data.ev_count}</span>
                  {hoverPreview.data.compliance_score !== null && hoverPreview.data.compliance_score !== undefined && (
                    <span style={{ color: '#57F287' }}>Score {Math.round(hoverPreview.data.compliance_score)}</span>
                  )}
                </div>
                {hoverPreview.data.last_message && (
                  <div style={{ fontSize: 11, color: '#888', borderLeft: '2px solid #333', paddingLeft: 8, fontStyle: 'italic' }}>
                    "{String(hoverPreview.data.last_message).slice(0, 140)}"
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Snooze modal */}
      <AnimatePresence>
        {snoozeModal && (
          <SnoozeModal onClose={() => setSnoozeModal(null)} onApply={snoozeApply} count={snoozeModal.ids.length} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SnoozeModal({ onClose, onApply, count }: { onClose: () => void; onApply: (d: Date, r: string) => void; count: number }) {
  const [reason, setReason] = useState('');
  const presets = [
    { label: '4h', hours: 4 }, { label: 'Tomorrow 9am', hours: -1 },
    { label: '2 days', hours: 48 }, { label: '1 week', hours: 168 },
  ];
  const apply = (hours: number) => {
    let when: Date;
    if (hours === -1) {
      when = new Date(); when.setDate(when.getDate() + 1); when.setHours(9, 0, 0, 0);
    } else when = new Date(Date.now() + hours * 3600_000);
    onApply(when, reason);
  };
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 380, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 14, padding: 20 }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#fff' }}>Snooze {count} case{count === 1 ? '' : 's'}</h3>
        <input
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', marginBottom: 12, fontSize: 13, outline: 'none' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {presets.map((p) => (
            <button key={p.label} onClick={() => apply(p.hours)} style={{ padding: '10px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 12, width: '100%', padding: 10, background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
      </motion.div>
    </motion.div>
  );
}

const btn: React.CSSProperties = { padding: '8px 14px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const iconBtn: React.CSSProperties = { padding: '4px 10px', background: 'transparent', border: '1px solid #2a2a2a', color: '#888', borderRadius: 6, fontSize: 14, cursor: 'pointer' };
const sel: React.CSSProperties = { padding: '7px 10px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: 6, fontSize: 12 };
const kbd: React.CSSProperties = { padding: '1px 6px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', color: '#aaa' };
