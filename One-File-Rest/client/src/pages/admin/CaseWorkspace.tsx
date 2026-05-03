import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { CaseTimeline, AISummaryPanel } from '../../components/case';
import MobileCameraButton from '../../components/admin/MobileCameraButton';

const STATUS_OPTIONS = [
  'pending', 'intake', 'profile_built', 'appeal_drafted',
  'appeal_submitted', 'awaiting_tiktok', 'response_received',
  'won', 'denied', 'escalated', 'closed',
];
const STATUS_COLORS: Record<string, string> = {
  pending: '#FEE75C', intake: '#5865F2', profile_built: '#9B59B6', appeal_drafted: '#EB459E',
  appeal_submitted: '#57F287', awaiting_tiktok: '#F5A623', response_received: '#5865F2',
  won: '#57F287', denied: '#ED4245', escalated: '#FF6B6B', closed: '#666',
};
const PLAN_COLORS: Record<string, string> = {
  basic_guard: '#5865F2', fortnightly_defense: '#57F287', proshield_creator: '#FFD700',
};

const S = {
  page: { display: 'flex', height: '100vh', background: '#0a0a0a', color: '#fff', overflow: 'hidden' } as React.CSSProperties,
  pane: { display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 14 } as React.CSSProperties,
  label: { fontSize: 10, color: '#666', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 } as React.CSSProperties,
};

interface CaseRow {
  id: number;
  account_username: string;
  status: string;
  priority: string;
  appeal_deadline?: string;
  plan?: string;
  discord_username: string;
  staff_name?: string;
  staff_assigned_id?: string | null;
  unread_count?: number;
  created_at: string;
}

interface AdminMessage {
  id: number;
  sender_discord_id: string;
  sender_type: 'client' | 'staff' | 'ai' | 'system';
  content: string;
  is_read?: boolean;
  created_at: string;
}

interface AdminEvidence {
  id: number;
  file_url: string;
  file_type?: string;
  file_name?: string;
  description?: string;
  ai_analysis?: string | null;
  uploaded_at: string;
}

interface AdminNote {
  id: number;
  staff_username?: string;
  note: string;
  created_at: string;
}

interface AuditEntry {
  id?: number;
  action?: string;
  created_at?: string;
  details?: unknown;
}

interface CaseDetailData {
  id: number;
  account_username: string;
  status: string;
  priority?: string;
  outcome?: string;
  staff_assigned_id?: string | null;
  staff_name?: string;
  discord_username: string;
  discord_avatar?: string;
  user_id?: number;
  plan?: string;
  violation_type?: string;
  violation_description?: string;
  appeal_deadline?: string;
  total_gmv?: number;
  face_videos_posted?: number;
  commission_frozen?: boolean;
  created_at: string;
  updated_at: string;
  messages?: AdminMessage[];
  evidence?: AdminEvidence[];
  internal_notes?: AdminNote[];
  audit_log?: AuditEntry[];
  timeline?: import('../../components/case/CaseTimeline').TimelineStage[];
  onboarding?: {
    total_gmv?: number;
    face_videos_posted?: number;
    account_purchase_date?: string;
    commission_frozen?: boolean;
    raw_onboarding?: Record<string, unknown> & {
      metrics?: { commissionFrozenAmount?: number; accountsUnderDocs?: number };
      purchase?: { wasPurchased?: boolean | null; changesMade?: string; timeAfterPurchase?: string };
      verification?: { verifiedBySelf?: boolean | null; notes?: string };
      previousAppeals?: { appealedBefore?: boolean | null; previousScript?: string };
      selectedPlan?: string;
    };
    violation_specific_answers?: Array<{ description?: string; screenshots?: { name: string }[] }>;
  };
  complianceScore?: { score: number; recommendations?: string[] };
}

type CenterTab = 'overview' | 'intake' | 'evidence' | 'messages' | 'notes' | 'ai' | 'history';

export default function CaseWorkspace() {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(routeId ? Number(routeId) : null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterUnread, setFilterUnread] = useState<boolean>(false);
  const [filterAssignedToMe, setFilterAssignedToMe] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<CaseDetailData | null>(null);
  const [centerTab, setCenterTab] = useState<CenterTab>('overview');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [aiDraft, setAiDraft] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myDiscordId = user?.discord_id;

  // When staff opens (or switches into) the Messages tab on a case, mark
  // inbound client messages as read so the unread queue / needs-attention
  // pollution clears immediately.
  useEffect(() => {
    if (!selectedId || centerTab !== 'messages') return;
    fetch(`/api/messages/read/${selectedId}`, { method: 'PATCH', credentials: 'include' })
      .then((r) => { if (r.ok) { fetchCases(); fetchDetail(selectedId); } })
      .catch(() => { /* noop */ });
    // intentionally not depending on fetchCases/fetchDetail (stable closures)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, centerTab, detail?.messages?.length]);

  // Sync route changes (deep links + back/forward)
  useEffect(() => {
    if (routeId) setSelectedId(Number(routeId));
  }, [routeId]);

  const fetchCases = useCallback(async () => {
    try {
      const sp = new URLSearchParams();
      if (search) sp.set('search', search);
      if (filterStatus === 'active') sp.set('status', 'all');
      else if (filterStatus !== 'all') sp.set('status', filterStatus);
      sp.set('limit', '100');
      const r = await fetch(`/api/admin/cases?${sp.toString()}`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        let rows: CaseRow[] = d.cases || [];
        if (filterStatus === 'active') rows = rows.filter((c) => !['won', 'denied', 'closed'].includes(c.status));
        if (filterPriority !== 'all') rows = rows.filter((c) => (c.priority || 'normal') === filterPriority);
        if (filterPlan !== 'all') rows = rows.filter((c) => c.plan === filterPlan);
        if (filterUnread) rows = rows.filter((c) => (c.unread_count ?? 0) > 0);
        if (filterAssignedToMe && myDiscordId) {
          rows = rows.filter((c) => c.staff_assigned_id === myDiscordId);
        }
        setCases(rows);
        if (!selectedId && rows.length > 0) setSelectedId(rows[0].id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterStatus, filterPriority, filterPlan, filterUnread, filterAssignedToMe, myDiscordId, selectedId]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const fetchDetail = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/admin/cases/${id}`, { credentials: 'include' });
      if (r.ok) setDetail(await r.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      // Keep the URL in sync for deep-linking without remounting the page
      if (String(selectedId) !== routeId) {
        navigate(`/admin/cases/${selectedId}`, { replace: true });
      }
    }
  }, [selectedId, fetchDetail, routeId, navigate]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;
    const onMsg = (payload: unknown) => {
      const raw = isRecord(payload) ? payload : {};
      const cid = pickNumber(raw.case_id ?? raw.caseId);
      if (selectedId && cid === selectedId) {
        const m: AdminMessage = {
          id: pickNumber(raw.id) ?? Date.now(),
          sender_discord_id: pickString(raw.sender_discord_id),
          sender_type: pickSenderType(raw.sender_type),
          content: pickString(raw.content),
          is_read: raw.is_read === true,
          created_at: pickString(raw.created_at) || new Date().toISOString(),
        };
        setDetail((p) => p ? { ...p, messages: [...(p.messages || []), m] } : p);
      }
    };
    const onStatus = () => { if (selectedId) fetchDetail(selectedId); fetchCases(); };
    socket.on('message:new', onMsg);
    socket.on('case:status_changed', onStatus);
    socket.emit('join:admin');
    if (selectedId) socket.emit('case:join', selectedId);
    return () => {
      socket.off('message:new', onMsg);
      socket.off('case:status_changed', onStatus);
      if (selectedId) socket.emit('case:leave', selectedId);
    };
  }, [socket, selectedId, fetchDetail, fetchCases]);

  useEffect(() => {
    if (centerTab === 'messages') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length, centerTab]);

  const updateCase = async (patch: Record<string, unknown>) => {
    if (!selectedId) return;
    try {
      const r = await fetch(`/api/admin/cases/${selectedId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (r.ok) { fetchDetail(selectedId); fetchCases(); }
    } catch (e) { console.error(e); }
  };

  const requestInfo = async () => {
    const what = window.prompt('What information do you need from the client?');
    if (!what) return;
    setReply(`Hi! To move your case forward, we need: ${what}\n\nReply here when you have it. Thanks!`);
    setCenterTab('messages');
  };

  const reassign = async () => {
    const newId = window.prompt('Enter staff Discord ID to assign (blank to unassign):', detail?.staff_assigned_id || '');
    if (newId === null) return;
    await updateCase({ staff_assigned_id: newId.trim() || null });
  };

  const generateAiReply = async () => {
    if (!selectedId) return;
    setAiDraftLoading(true);
    try {
      const r = await fetch('/api/ai/case-summary', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: selectedId, mode: 'reply_draft' }),
      });
      if (r.ok) {
        const d = await r.json();
        setAiDraft(d.summary || d.text || '');
      }
    } catch (e) { console.error(e); }
    finally { setAiDraftLoading(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    try {
      await fetch('/api/messages', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: selectedId, content: reply }),
      });
      setReply('');
    } finally { setSending(false); }
  };

  const addNote = async () => {
    if (!noteText.trim() || !selectedId) return;
    try {
      await fetch('/api/admin/notes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: selectedId, note: noteText }),
      });
      setNoteText('');
      fetchDetail(selectedId);
    } catch (e) { console.error(e); }
  };

  return (
    <div style={S.page}>
      {/* LEFT — Case list */}
      <aside style={{
        width: 320, minWidth: 280, borderRight: '1px solid #1a1a1a',
        background: '#0d0d0d', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 14, borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Cases</h2>
            <span style={{ fontSize: 11, color: '#666' }}>{cases.length}</span>
          </div>
          <input
            placeholder="Search cases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 12,
              background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#fff',
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {['active', 'all', 'pending', 'awaiting_tiktok', 'won', 'denied'].map((f) => (
              <button key={f} onClick={() => setFilterStatus(f)} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 600,
                borderRadius: 12, cursor: 'pointer',
                background: filterStatus === f ? '#5865F2' : '#1a1a1a',
                color: filterStatus === f ? '#fff' : '#888', border: 'none',
                textTransform: 'capitalize',
              }}>{f.replace(/_/g, ' ')}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={miniSelect}>
              <option value="all">All priority</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} style={miniSelect}>
              <option value="all">All plans</option>
              <option value="basic_guard">Basic Guard</option>
              <option value="fortnightly_defense">Fortnightly Defense</option>
              <option value="proshield_creator">Pro Shield Creator</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#888' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={filterUnread} onChange={(e) => setFilterUnread(e.target.checked)} /> Unread
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={filterAssignedToMe} onChange={(e) => setFilterAssignedToMe(e.target.checked)} /> Assigned to me
            </label>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 20, color: '#666', fontSize: 12 }}>Loading…</div> :
           cases.length === 0 ? <div style={{ padding: 20, color: '#555', fontSize: 12 }}>No cases match.</div> :
           cases.map((c) => {
            const active = c.id === selectedId;
            const overdue = c.appeal_deadline && new Date(c.appeal_deadline).getTime() < Date.now();
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
                width: '100%', textAlign: 'left',
                padding: '12px 14px',
                background: active ? '#5865F215' : 'transparent',
                borderLeft: `3px solid ${active ? '#5865F2' : 'transparent'}`,
                borderTop: 'none', borderRight: 'none',
                borderBottom: '1px solid #161616',
                cursor: 'pointer', color: '#fff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#888', fontFamily: 'monospace' }}>#{c.id}</span>
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase',
                    background: `${STATUS_COLORS[c.status] || '#333'}22`, color: STATUS_COLORS[c.status] || '#888',
                  }}>{c.status.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{c.account_username}
                </div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.discord_username}
                  {c.plan && <span style={{ color: PLAN_COLORS[c.plan] || '#666', marginLeft: 6 }}>· {c.plan.replace(/_/g, ' ')}</span>}
                </div>
                {overdue && <div style={{ marginTop: 4, fontSize: 10, color: '#ED4245', fontWeight: 700 }}>⚠ OVERDUE</div>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER — Detail */}
      <main style={{ ...S.pane, flex: 1, minWidth: 0 }}>
        {!detail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            {selectedId ? 'Loading…' : 'Select a case to begin.'}
          </div>
        ) : (
          <>
            {/* Header bar */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', fontWeight: 700 }}>CASE #{detail.id}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase',
                    background: `${STATUS_COLORS[detail.status] || '#333'}22`, color: STATUS_COLORS[detail.status] || '#888',
                  }}>{detail.status.replace(/_/g, ' ')}</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  @{detail.account_username} <span style={{ color: '#666', fontWeight: 500, fontSize: 14 }}>· {detail.discord_username}</span>
                </h1>
                {detail.appeal_deadline && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                    Deadline: {new Date(detail.appeal_deadline).toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={detail.status} onChange={(e) => updateCase({ status: e.target.value })} style={selectStyle}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={detail.priority || 'normal'} onChange={(e) => updateCase({ priority: e.target.value })} style={selectStyle}>
                  {['normal', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={() => setCenterTab('messages')} style={btnPrimary}>Reply</button>
                <button onClick={() => updateCase({ status: 'won', outcome: 'won' })} style={btnSuccess}>Mark Won</button>
                <button onClick={() => updateCase({ status: 'closed' })} style={btnGhost}>Resolved</button>
                <button onClick={requestInfo} style={btnGhost}>Request Info</button>
                <button onClick={reassign} style={btnGhost}>Reassign</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a', padding: '0 22px' }}>
              {[
                { k: 'overview', l: 'Overview' },
                { k: 'intake',   l: 'Intake Answers' },
                { k: 'evidence', l: `Evidence (${detail.evidence?.length || 0})` },
                { k: 'messages', l: `Messages (${detail.messages?.length || 0})` },
                { k: 'notes',    l: `Notes (${detail.internal_notes?.length || 0})` },
                { k: 'ai',       l: 'AI Assistant' },
                { k: 'history',  l: 'History' },
              ].map((t) => (
                <button key={t.k} onClick={() => setCenterTab(t.k as CenterTab)} style={{
                  padding: '12px 16px', background: 'transparent', border: 'none',
                  borderBottom: centerTab === t.k ? '2px solid #5865F2' : '2px solid transparent',
                  color: centerTab === t.k ? '#fff' : '#888', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}>{t.l}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              {centerTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  <div style={S.card}>
                    <div style={S.label}>Timeline</div>
                    <div style={{ marginTop: 12 }}>
                      <CaseTimeline stages={detail.timeline} currentStatus={detail.status} orientation="horizontal" compact />
                    </div>
                  </div>
                  <div style={S.card}>
                    <div style={S.label}>Account Info</div>
                    <div style={{ marginTop: 10, fontSize: 12, color: '#ddd', lineHeight: 1.8 }}>
                      <Row k="Plan" v={detail.plan?.replace(/_/g, ' ') || '—'} />
                      <Row k="Violation" v={(detail.violation_type || '').replace(/_/g, ' ') || '—'} />
                      <Row k="Created" v={new Date(detail.created_at).toLocaleString()} />
                      <Row k="Updated" v={new Date(detail.updated_at).toLocaleString()} />
                      <Row k="Total GMV" v={`$${(detail.total_gmv || 0).toLocaleString()}`} />
                      <Row k="Face Videos" v={detail.face_videos_posted ?? 0} />
                      <Row k="Commission" v={detail.commission_frozen ? 'Frozen' : 'Active'} />
                      <Row k="Outcome" v={detail.outcome || 'pending'} />
                    </div>
                  </div>
                  {detail.violation_description && (
                    <div style={{ ...S.card, gridColumn: '1 / -1' }}>
                      <div style={S.label}>Client Submission</div>
                      <p style={{ marginTop: 8, fontSize: 13, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{detail.violation_description}</p>
                    </div>
                  )}
                </div>
              )}
              {centerTab === 'evidence' && (
                <>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <MobileCameraButton
                      caseId={detail.id}
                      onUploaded={() => { if (selectedId) void fetchDetail(selectedId); }}
                    />
                  </div>
                  {(detail.evidence?.length ?? 0) > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {(detail.evidence ?? []).map((e) => {
                      const isImg = (e.file_type || '').includes('image') || /^data:image/.test(e.file_url);
                      // Pull tag-like keywords out of the AI analysis blob, if any.
                      const tags = (e.ai_analysis || '')
                        .split(/[,;\n]/)
                        .map((t) => t.trim())
                        .filter((t) => t && t.length < 32)
                        .slice(0, 4);
                      const attachToReply = () => {
                        const ref = e.file_name || `evidence #${e.id}`;
                        setReply((prev) => (prev ? prev + '\n' : '') + `Attaching evidence: ${ref}`);
                        setCenterTab('messages');
                      };
                      return (
                        <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#0e0e0e', border: '1px solid #1f1f1f', borderRadius: 10, overflow: 'hidden' }}>
                          {isImg ? (
                            <button type="button" onClick={() => setLightbox(e.file_url)}
                              style={{ aspectRatio: '1 / 1', padding: 0, border: 'none', background: '#1a1a1a', cursor: 'zoom-in' }}>
                              <img src={e.file_url} alt={e.description || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </button>
                          ) : (
                            <a href={e.file_url} target="_blank" rel="noreferrer"
                              style={{ aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: '#1a1a1a', textDecoration: 'none' }}>📎</a>
                          )}
                          <div style={{ padding: '6px 10px 8px' }}>
                            {e.file_name && <div style={{ fontSize: 11, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.file_name}>{e.file_name}</div>}
                            {tags.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                {tags.map((t, i) => (
                                  <span key={i} style={{ fontSize: 9, background: 'rgba(155,89,182,0.15)', color: '#9B59B6', padding: '2px 6px', borderRadius: 3, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t}</span>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              <button onClick={attachToReply} title="Reference this in a reply"
                                style={{ flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 6px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                                + Reply
                              </button>
                              <a href={e.file_url} target="_blank" rel="noreferrer"
                                style={{ flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 6px', textAlign: 'center', background: 'transparent', color: '#888', border: '1px solid #2a2a2a', borderRadius: 4, textDecoration: 'none' }}>
                                Open
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <div style={{ color: '#555', fontSize: 13 }}>No evidence files for this case.</div>}
                </>
              )}
              {centerTab === 'messages' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(() => {
                      const msgs = detail.messages || [];
                      const myStaffMessages = msgs.filter((mm) => mm.sender_type === 'staff');
                      const lastMineId = myStaffMessages.length ? myStaffMessages[myStaffMessages.length - 1].id : null;
                      let prevDay = '';
                      const out: React.ReactNode[] = [];
                      msgs.forEach((m) => {
                        const day = new Date(m.created_at).toDateString();
                        if (day !== prevDay) {
                          out.push(
                            <div key={`d-${day}`} style={{ alignSelf: 'center', fontSize: 11, color: '#666', padding: '4px 10px', background: '#1a1a1a', borderRadius: 12, margin: '6px 0' }}>
                              {formatDayLabelAdmin(m.created_at)}
                            </div>
                          );
                          prevDay = day;
                        }
                        const staff = m.sender_type === 'staff';
                        out.push(
                          <div key={m.id} style={{ display: 'flex', justifyContent: staff ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                              maxWidth: '78%', padding: '10px 14px',
                              background: staff ? '#5865F2' : '#1a1a1a',
                              color: staff ? '#fff' : '#ddd',
                              borderRadius: staff ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                              fontSize: 13, lineHeight: 1.5,
                            }}>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {staff && m.id === lastMineId && (
                                  <span aria-label={m.is_read ? 'Read by client' : 'Sent'}>{m.is_read ? '✓✓' : '✓'}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                      return out;
                    })()}
                    <div ref={messagesEndRef} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #1a1a1a' }}>
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      placeholder="Reply to client…"
                      style={{ flex: 1, padding: 10, background: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 6, resize: 'none', minHeight: 60, fontSize: 13, fontFamily: 'inherit' }} />
                    <button onClick={sendReply} disabled={sending || !reply.trim()} style={{ padding: '10px 18px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {sending ? '…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
              {centerTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add an internal note (only staff can see)…"
                      style={{ flex: 1, padding: 10, background: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 6, resize: 'vertical', minHeight: 60, fontSize: 13, fontFamily: 'inherit' }} />
                    <button onClick={addNote} disabled={!noteText.trim()} style={{ padding: '10px 18px', background: '#9B59B6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' }}>Add Note</button>
                  </div>
                  {(detail.internal_notes || []).map((n) => (
                    <div key={n.id} style={{ ...S.card, borderColor: 'rgba(155,89,182,0.3)' }}>
                      <div style={{ fontSize: 11, color: '#9B59B6', fontWeight: 700, marginBottom: 6 }}>
                        {n.staff_username || 'Staff'} · {new Date(n.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 13, color: '#ddd', whiteSpace: 'pre-wrap' }}>{n.note}</div>
                    </div>
                  ))}
                  {(detail.internal_notes || []).length === 0 && <div style={{ color: '#555', fontSize: 13 }}>No notes yet.</div>}
                </div>
              )}
              {centerTab === 'intake' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!detail.onboarding ? (
                    <div style={{ color: '#555', fontSize: 13 }}>No intake data captured for this case.</div>
                  ) : (
                    <>
                      <div style={S.card}>
                        <div style={S.label}>Metrics</div>
                        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8 }}>
                          <Row k="Total GMV" v={`$${Number(detail.onboarding.total_gmv || 0).toLocaleString()}`} />
                          <Row k="Face Videos Posted" v={detail.onboarding.face_videos_posted ?? 0} />
                          <Row k="Account Purchase Date" v={detail.onboarding.account_purchase_date || '—'} />
                          <Row k="Commission Frozen" v={detail.onboarding.commission_frozen ? `Yes — $${Number(detail.onboarding.raw_onboarding?.metrics?.commissionFrozenAmount || 0).toLocaleString()}` : 'No'} />
                          <Row k="Accounts Under Documents" v={detail.onboarding.raw_onboarding?.metrics?.accountsUnderDocs ?? '—'} />
                        </div>
                      </div>
                      <div style={S.card}>
                        <div style={S.label}>Account & Purchase</div>
                        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8 }}>
                          <Row k="Account Username" v={detail.account_username || '—'} />
                          <Row k="Was Purchased" v={detail.onboarding.raw_onboarding?.purchase?.wasPurchased === null ? '—' : (detail.onboarding.raw_onboarding?.purchase?.wasPurchased ? 'Yes' : 'No')} />
                          <Row k="Changes After Purchase" v={detail.onboarding.raw_onboarding?.purchase?.changesMade || '—'} />
                          <Row k="Time After Purchase" v={detail.onboarding.raw_onboarding?.purchase?.timeAfterPurchase || '—'} />
                        </div>
                      </div>
                      <div style={S.card}>
                        <div style={S.label}>Verification</div>
                        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8 }}>
                          <Row k="Verified by Self" v={detail.onboarding.raw_onboarding?.verification?.verifiedBySelf === null ? '—' : (detail.onboarding.raw_onboarding?.verification?.verifiedBySelf ? 'Yes' : 'No')} />
                          <Row k="Notes" v={detail.onboarding.raw_onboarding?.verification?.notes || '—'} />
                        </div>
                      </div>
                      <div style={S.card}>
                        <div style={S.label}>Prior Appeals</div>
                        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8 }}>
                          <Row k="Appealed Before" v={detail.onboarding.raw_onboarding?.previousAppeals?.appealedBefore === null ? '—' : (detail.onboarding.raw_onboarding?.previousAppeals?.appealedBefore ? 'Yes' : 'No')} />
                          {detail.onboarding.raw_onboarding?.previousAppeals?.previousScript && (
                            <div style={{ marginTop: 6, padding: 10, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6, color: '#ccc', whiteSpace: 'pre-wrap' }}>
                              {detail.onboarding.raw_onboarding.previousAppeals.previousScript}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={S.card}>
                        <div style={S.label}>Selected Plan</div>
                        <div style={{ marginTop: 10, fontSize: 12, color: '#ddd', textTransform: 'capitalize' }}>
                          {(detail.onboarding.raw_onboarding?.selectedPlan || detail.plan || '—').toString().replace(/_/g, ' ')}
                        </div>
                      </div>
                      {Array.isArray(detail.onboarding.violation_specific_answers) && detail.onboarding.violation_specific_answers.length > 0 && (
                        <div style={S.card}>
                          <div style={S.label}>Violations Reported</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            {detail.onboarding.violation_specific_answers.map((v: { description?: string; screenshots?: { name: string }[] }, i: number) => (
                              <div key={i} style={{ padding: 10, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6 }}>
                                <div style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Violation {i + 1}</div>
                                <div style={{ fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap' }}>{v.description || '—'}</div>
                                {Array.isArray(v.screenshots) && v.screenshots.length > 0 && (
                                  <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                                    {v.screenshots.length} screenshot(s): {v.screenshots.map((s) => s.name).join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {centerTab === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={S.label}>AI Suggested Reply</div>
                      <button onClick={generateAiReply} disabled={aiDraftLoading} style={btnPrimary}>
                        {aiDraftLoading ? 'Generating…' : 'Generate'}
                      </button>
                    </div>
                    <textarea value={aiDraft} onChange={(e) => setAiDraft(e.target.value)}
                      placeholder="Click Generate to draft a reply with AI."
                      style={{ width: '100%', minHeight: 160, padding: 12, background: '#1a1a1a', color: '#ddd', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => { setReply(aiDraft); setCenterTab('messages'); }} disabled={!aiDraft.trim()} style={btnPrimary}>Use as Reply</button>
                      <button onClick={() => { navigator.clipboard.writeText(aiDraft).catch(() => {}); }} disabled={!aiDraft.trim()} style={btnGhost}>Copy</button>
                    </div>
                  </div>
                  <AISummaryPanel
                    caseId={selectedId!}
                    onUseReply={(text) => { setReply(text); setCenterTab('messages'); }}
                  />
                </div>
              )}
              {centerTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(detail.audit_log || []).length === 0 && <div style={{ color: '#555', fontSize: 13 }}>No audit events yet.</div>}
                  {(detail.audit_log || []).map((t: { id?: number; action?: string; created_at?: string; details?: unknown }, i: number) => (
                    <div key={t.id ?? i} style={{ ...S.card, padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{t.action || 'event'}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>{t.created_at && new Date(t.created_at).toLocaleString()}</div>
                      {t.details ? (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{typeof t.details === 'string' ? t.details : JSON.stringify(t.details)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* RIGHT — AI side panel */}
      <aside style={{
        width: 340, minWidth: 280, borderLeft: '1px solid #1a1a1a',
        background: '#0d0d0d', overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Client</h2>
        {selectedId && detail ? (
          <>
            <ClientIdentityCard userId={detail.user_id} username={detail.discord_username} plan={detail.plan} avatar={detail.discord_avatar} />
            <h2 style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Insights</h2>
            <AISummaryPanel caseId={selectedId} compact />
            {detail?.complianceScore && (
              <div style={S.card}>
                <div style={S.label}>Compliance Score</div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: `conic-gradient(#57F287 ${(detail.complianceScore.score || 0) * 3.6}deg, #1a1a1a 0)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {detail.complianceScore.score}
                    </div>
                  </div>
                  <div style={{ flex: 1, fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
                    {(detail.complianceScore.recommendations || []).slice(0, 3).map((r: string, i: number) => (
                      <div key={i}>• {r}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : <div style={{ color: '#555', fontSize: 12 }}>Select a case to view AI insights.</div>}
      </aside>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24, cursor: 'zoom-out',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Close preview"
            style={{
              position: 'absolute', top: 16, right: 18, background: 'transparent',
              border: '1px solid #333', color: '#fff', borderRadius: 6,
              padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            }}
          >Close ✕</button>
          <img
            src={lightbox}
            alt="Evidence preview"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '95%', maxHeight: '92vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}
    </div>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function pickNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}
function pickString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function pickSenderType(v: unknown): AdminMessage['sender_type'] {
  return v === 'staff' || v === 'ai' || v === 'system' || v === 'client' ? v : 'client';
}

function formatDayLabelAdmin(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, background: '#1a1a1a', color: '#fff',
  border: '1px solid #2a2a2a', borderRadius: 6, fontWeight: 600, textTransform: 'capitalize',
};

const btnGhost: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#888',
  border: '1px solid #2a2a2a', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, background: '#5865F2', color: '#fff',
  border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
};

const btnSuccess: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, background: '#57F287', color: '#0a0a0a',
  border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
};

const miniSelect: React.CSSProperties = {
  padding: '4px 8px', fontSize: 11, background: '#1a1a1a', color: '#ddd',
  border: '1px solid #2a2a2a', borderRadius: 4, fontWeight: 500,
};

function ClientIdentityCard({ userId, username, plan, avatar }: { userId?: number | string; username: string; plan?: string; avatar?: string }) {
  const [stats, setStats] = useState<{ totalCases: number; won: number; winRate: number } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/admin/clients/${userId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelled || !d) return;
        const all = d.cases || [];
        const won = all.filter((c: { outcome?: string }) => c.outcome === 'won').length;
        const resolved = all.filter((c: { outcome?: string }) => c.outcome === 'won' || c.outcome === 'denied').length;
        setStats({ totalCases: all.length, won, winRate: resolved > 0 ? Math.round((won / resolved) * 100) : 0 });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {avatar ? (
          <img src={avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {(username || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</div>
          {plan && <div style={{ fontSize: 10, color: '#888', textTransform: 'capitalize' }}>{plan.replace(/_/g, ' ')}</div>}
        </div>
      </div>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
          <Stat label="Cases" value={stats.totalCases} />
          <Stat label="Won" value={stats.won} />
          <Stat label="Win rate" value={`${stats.winRate}%`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6, padding: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: '#666', textTransform: 'capitalize' }}>{k}</span>
      <strong style={{ color: '#ddd', textTransform: 'capitalize' }}>{String(v)}</strong>
    </div>
  );
}
