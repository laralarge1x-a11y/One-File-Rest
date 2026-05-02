import React, { useEffect, useState, useCallback, useRef } from 'react';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px', display: 'block' },
};

const PLAN_COLORS: Record<string, string> = { basic_guard: '#5865F2', fortnightly_defense: '#57F287', proshield_creator: '#FFD700' };
const STATUS_COLORS: Record<string, string> = {
  pending: '#FEE75C', intake: '#5865F2', profile_built: '#9B59B6', appeal_drafted: '#EB459E',
  appeal_submitted: '#57F287', awaiting_tiktok: '#F5A623', response_received: '#00b4d8',
  won: '#57F287', denied: '#ED4245', escalated: '#FF6B6B', closed: '#555',
};
const ALL_STATUSES = ['pending','intake','profile_built','appeal_drafted','appeal_submitted','awaiting_tiktok','response_received','won','denied','escalated','closed'];

function Badge({ value, colorMap }: { value: string; colorMap: Record<string,string> }) {
  const c = colorMap[value] || '#666';
  return <span style={{ background: `${c}22`, color: c, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>{value.replace(/_/g,' ')}</span>;
}

function Countdown({ deadline }: { deadline: string }) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return <span style={{ color: '#ED4245', fontWeight: '700', fontSize: '12px' }}>OVERDUE</span>;
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  const color = diff < 86400000 ? '#ED4245' : diff < 259200000 ? '#FEE75C' : '#57F287';
  return <span style={{ color, fontWeight: '700', fontSize: '12px' }}>{d > 0 ? `${d}d ` : ''}{h % 24}h</span>;
}

export default function CaseManagement() {
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [search, setSearch] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [filterStaff, setFilterStaff] = useState('all');

  const [replyContent, setReplyContent] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const searchTimeout = useRef<any>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterPlan !== 'all') params.set('plan', filterPlan);
      if (search) params.set('search', search);
      if (filterStaff !== 'all') params.set('staff', filterStaff);
      const r = await fetch(`/api/admin/cases?${params}`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setCases(d.cases || []); setTotal(d.total || 0); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterStatus, filterPlan, search, filterStaff]);

  useEffect(() => {
    fetch('/api/admin/staff', { credentials: 'include' }).then(r => r.json()).then(setStaffList).catch(() => {});
  }, []);
  useEffect(() => { fetchCases(); }, [fetchCases]);

  const openCase = async (c: any) => {
    setSelectedCase(c);
    setSlideOpen(true);
    setDetailLoading(true);
    setAiResult('');
    try {
      const r = await fetch(`/api/admin/cases/${c.id}`, { credentials: 'include' });
      if (r.ok) setCaseDetail(await r.json());
    } catch (e) { console.error(e); }
    setDetailLoading(false);
  };

  const updateStatus = async (caseId: number, status: string) => {
    setStatusUpdating(true);
    await fetch(`/api/admin/cases/${caseId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setStatusUpdating(false);
    fetchCases();
    if (caseDetail) setCaseDetail({ ...caseDetail, status });
  };

  const sendReply = async () => {
    if (!replyContent.trim() || !caseDetail) return;
    await fetch('/api/messages', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseDetail.id, content: replyContent }) });
    setReplyContent('');
    const r = await fetch(`/api/admin/cases/${caseDetail.id}`, { credentials: 'include' });
    if (r.ok) setCaseDetail(await r.json());
  };

  const addNote = async () => {
    if (!noteContent.trim() || !caseDetail) return;
    await fetch('/api/admin/notes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseDetail.id, note: noteContent }) });
    setNoteContent('');
    const r = await fetch(`/api/admin/cases/${caseDetail.id}`, { credentials: 'include' });
    if (r.ok) setCaseDetail(await r.json());
  };

  const runAI = async (type: string) => {
    if (!caseDetail) return;
    setAiLoading(type);
    setAiResult('');
    try {
      const r = await fetch(`/api/ai/${type}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseDetail.id, caseData: caseDetail }),
      });
      const d = await r.json();
      setAiResult(d.summary || d.draft || JSON.stringify(d.analysis, null, 2) || d.error || 'No result');
    } catch (e) { setAiResult('Error running AI'); }
    setAiLoading('');
  };

  const exportCSV = async () => {
    const r = await fetch('/api/admin/export/cases', { credentials: 'include' });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cases.csv'; a.click();
  };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Case Management <span style={{ color: '#444', fontSize: '14px', fontWeight: '400' }}>({total})</span></h1>
        <button onClick={exportCSV} style={{ ...S.btn, background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>⬇ Export CSV</button>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <input placeholder="🔍 Search case, client, ID..." style={{ ...S.input, flex: '1', minWidth: '200px' }} value={search}
          onChange={(e) => { setSearch(e.target.value); clearTimeout(searchTimeout.current); searchTimeout.current = setTimeout(fetchCases, 400); }} />
        <select style={S.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <select style={S.select} value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
          <option value="all">All Plans</option>
          <option value="basic_guard">Basic Guard</option>
          <option value="fortnightly_defense">Fortnightly Defense</option>
          <option value="proshield_creator">ProShield Creator</option>
        </select>
        <select style={S.select} value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
          <option value="all">All Staff</option>
          {staffList.map((s: any) => <option key={s.discord_id} value={s.discord_id}>{s.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ color: '#444', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.06em', borderBottom: '1px solid #1e1e1e' }}>
                {['#','Client','Plan','Violation','Status','Created','Deadline','Assigned',''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#444' }}>Loading...</td></tr>
              ) : cases.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#444' }}>No cases found</td></tr>
              ) : cases.map((c) => (
                <tr key={c.id} onClick={() => openCase(c)} style={{ cursor: 'pointer', borderBottom: '1px solid #141414', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#151515')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 12px', color: '#555' }}>#{c.id}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {c.discord_avatar ? <img src={`https://cdn.discordapp.com/avatars/${c.user_discord_id}/${c.discord_avatar}.png?size=24`} style={{ width: 24, height: 24, borderRadius: '50%' }} /> : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff' }}>{(c.discord_username||'?')[0]}</div>}
                      <span style={{ color: '#fff', fontWeight: '500' }}>{c.discord_username}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}><Badge value={c.plan || 'none'} colorMap={PLAN_COLORS} /></td>
                  <td style={{ padding: '10px 12px', color: '#aaa' }}>{c.violation_type || '—'}</td>
                  <td style={{ padding: '10px 12px' }}><Badge value={c.status} colorMap={STATUS_COLORS} /></td>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px' }}>{c.appeal_deadline ? <Countdown deadline={c.appeal_deadline} /> : <span style={{ color: '#444' }}>—</span>}</td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>{c.staff_name || <span style={{ color: '#333' }}>Unassigned</span>}</td>
                  <td style={{ padding: '10px 12px' }}><span style={{ color: '#5865F2', fontSize: '12px' }}>View →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out panel */}
      {slideOpen && (
        <>
          <div onClick={() => setSlideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '600px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRight: 'none', zIndex: 50, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>Case #{selectedCase?.id}</div>
                <div style={{ color: '#666', fontSize: '12px' }}>{selectedCase?.violation_type}</div>
              </div>
              <button onClick={() => setSlideOpen(false)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕ Close</button>
            </div>

            {detailLoading ? <div style={{ textAlign: 'center', padding: '40px', color: '#555' }}>Loading case details...</div> : caseDetail && (
              <>
                {/* Section 1 — Case header */}
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                    {caseDetail.discord_avatar ? <img src={`https://cdn.discordapp.com/avatars/${caseDetail.user_discord_id}/${caseDetail.discord_avatar}.png?size=40`} style={{ width: 40, height: 40, borderRadius: '50%' }} /> : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#fff' }}>{(caseDetail.discord_username||'?')[0]}</div>}
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>{caseDetail.discord_username}</div>
                      <Badge value={caseDetail.plan || 'none'} colorMap={PLAN_COLORS} />
                    </div>
                  </div>
                  {caseDetail.appeal_deadline && (
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>Deadline: <Countdown deadline={caseDetail.appeal_deadline} /></div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                    {statusUpdating ? <span style={{ color: '#5865F2', fontSize: '12px' }}>Updating...</span> : (
                      ['pending','intake','profile_built','appeal_drafted','appeal_submitted','awaiting_tiktok','won','denied'].map((s) => (
                        <button key={s} onClick={() => updateStatus(caseDetail.id, s)}
                          style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', border: `1px solid ${STATUS_COLORS[s] || '#333'}`, background: caseDetail.status === s ? `${STATUS_COLORS[s]}33` : 'transparent', color: STATUS_COLORS[s] || '#666' }}>
                          {s.replace(/_/g,' ')}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 2 — Details */}
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Case Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div><span style={{ color: '#555' }}>Account: </span><span style={{ color: '#ccc' }}>@{caseDetail.account_username}</span></div>
                    <div><span style={{ color: '#555' }}>Priority: </span><span style={{ color: caseDetail.priority === 'critical' ? '#ED4245' : caseDetail.priority === 'high' ? '#FEE75C' : '#666' }}>{caseDetail.priority}</span></div>
                  </div>
                  {caseDetail.violation_description && <div style={{ marginTop: '10px', color: '#aaa', fontSize: '12px', lineHeight: 1.6 }}>{caseDetail.violation_description}</div>}

                  {(caseDetail.evidence || []).length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ color: '#555', fontSize: '11px', marginBottom: '6px' }}>EVIDENCE ({caseDetail.evidence.length})</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                        {caseDetail.evidence.map((e: any) => (
                          <a key={e.id} href={e.file_url} target="_blank" rel="noopener noreferrer" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#5865F2', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📎 {e.file_name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3 — AI Tools */}
                <div style={{ background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#5865F2', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🤖 AI Tools</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {[['case-summary','Summarize'], ['generate-appeal','Appeal Letter'], ['analyze-violation','Analyze']].map(([type, label]) => (
                      <button key={type} onClick={() => runAI(type)} disabled={!!aiLoading}
                        style={{ ...S.btn, background: aiLoading === type ? '#5865F2' : '#1a1a2a', color: '#5865F2', border: '1px solid #5865F233', fontSize: '12px', padding: '6px 12px', opacity: aiLoading && aiLoading !== type ? 0.5 : 1 }}>
                        {aiLoading === type ? '⏳ Running...' : label}
                      </button>
                    ))}
                  </div>
                  {aiResult && (
                    <div style={{ background: '#0a0a16', border: '1px solid #2a2a4a', borderRadius: '8px', padding: '12px', position: 'relative' }}>
                      <pre style={{ color: '#ccc', fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0, maxHeight: '200px', overflowY: 'auto' }}>{aiResult}</pre>
                      <button onClick={() => navigator.clipboard.writeText(aiResult)} style={{ position: 'absolute', top: '8px', right: '8px', background: '#1a1a2a', border: '1px solid #333', color: '#5865F2', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>Copy</button>
                    </div>
                  )}
                </div>

                {/* Section 4 — Messages */}
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Messages ({(caseDetail.messages||[]).length})</div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {(caseDetail.messages || []).map((m: any) => (
                      <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.sender_type === 'staff' ? '#5865F2' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                          {m.sender_type === 'staff' ? '👨‍💼' : '👤'}
                        </div>
                        <div style={{ flex: 1, background: m.sender_type === 'staff' ? '#0d0d1a' : '#1a1a1a', borderRadius: '8px', padding: '8px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: m.sender_type === 'staff' ? '#5865F2' : '#888' }}>{m.sender_type}</span>
                            <span style={{ fontSize: '10px', color: '#444' }}>{new Date(m.created_at).toLocaleTimeString()}</span>
                          </div>
                          <div style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.5 }}>{m.content}</div>
                        </div>
                      </div>
                    ))}
                    {(caseDetail.messages||[]).length === 0 && <p style={{ color: '#444', fontSize: '12px', textAlign: 'center', padding: '16px' }}>No messages yet</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="Type staff reply..." rows={2}
                      style={{ ...S.input, flex: 1, resize: 'none', lineHeight: '1.5' }} />
                    <button onClick={sendReply} style={{ ...S.btn, background: '#5865F2', color: '#fff', alignSelf: 'flex-end' }}>Send</button>
                  </div>
                </div>

                {/* Section 5 — Internal Notes */}
                <div style={{ background: '#1a0a0a', border: '1px solid #2a1a1a', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#ED4245', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔒 Internal Notes (Staff Only)</div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '10px' }}>
                    {(caseDetail.internal_notes || []).map((n: any) => (
                      <div key={n.id} style={{ padding: '8px', background: '#111', borderRadius: '6px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#888', fontWeight: '600' }}>{n.staff_username || 'Staff'}</span>
                          <span style={{ fontSize: '10px', color: '#444' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ color: '#ccc', fontSize: '12px' }}>{n.note}</div>
                      </div>
                    ))}
                    {(caseDetail.internal_notes||[]).length === 0 && <p style={{ color: '#333', fontSize: '12px' }}>No notes yet</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Add internal note..." style={{ ...S.input, flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                    <button onClick={addNote} style={{ ...S.btn, background: '#ED4245', color: '#fff' }}>Add</button>
                  </div>
                </div>

                {/* Section 6 — Assignment */}
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assign Staff</div>
                  <select style={{ ...S.select, width: '100%' }} value={caseDetail.staff_assigned_id || ''} onChange={async (e) => {
                    await fetch('/api/admin/assign', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseDetail.id, staff_discord_id: e.target.value }) });
                    setCaseDetail({ ...caseDetail, staff_assigned_id: e.target.value });
                  }}>
                    <option value="">Unassigned</option>
                    {staffList.map((s: any) => <option key={s.discord_id} value={s.discord_id}>{s.name} ({s.role})</option>)}
                  </select>
                  {(caseDetail.timeline || []).length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ color: '#555', fontSize: '11px', marginBottom: '8px' }}>TIMELINE</div>
                      <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {caseDetail.timeline.map((t: any, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5865F2', flexShrink: 0, marginTop: '5px' }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ color: '#888', fontSize: '11px' }}>{t.action?.replace(/_/g,' ')}</span>
                              <span style={{ color: '#444', fontSize: '10px', marginLeft: '8px' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
