import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { GlassCard, StatusBadge, LoadingSpinner, EmptyState, useToast } from '../components/customer';
import { CaseTimeline, type TimelineStage } from '../components/case';

interface Message {
  id: number;
  sender_discord_id: string;
  sender_type: 'client' | 'staff' | 'ai' | 'system';
  content: string;
  created_at: string;
  is_read?: boolean;
}

interface CaseDetail {
  id: number;
  account_username: string;
  violation_type: string;
  violation_description: string;
  status: string;
  priority: string;
  appeal_deadline: string;
  outcome: string;
  total_gmv: number;
  face_videos_posted: number;
  commission_frozen: boolean;
  created_at: string;
  updated_at: string;
  staff_name?: string;
  complianceScore?: { score: number; grade: string; recommendations: string[] };
  messages: Message[];
  evidence: Array<{ id: number; file_url: string; file_type: string; file_name?: string; description?: string; uploaded_at: string }>;
  timeline?: TimelineStage[];
}

function useCountdown(deadline?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return { expired: true, label: 'Deadline passed', urgent: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  let label = days > 0 ? `${days}d ${hours}h remaining` : hours > 0 ? `${hours}h ${mins}m remaining` : `${mins}m remaining`;
  return { expired: false, label, urgent: ms < 24 * 3_600_000 };
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Submitted — awaiting team review',
  intake: 'Intake — gathering details',
  profile_built: 'Profile built — preparing appeal',
  appeal_drafted: 'Appeal drafted — under final review',
  appeal_submitted: 'Appeal sent to TikTok',
  awaiting_tiktok: 'Awaiting TikTok response',
  response_received: 'TikTok responded — reviewing',
  won: 'Resolved — Won 🎉',
  denied: 'Resolved — Denied',
  closed: 'Closed',
};

const NEXT_ACTION: Record<string, string> = {
  pending: 'Our team will review and contact you within 24 hours.',
  intake: 'We may message you for clarifying details.',
  profile_built: 'We are drafting your appeal now.',
  appeal_drafted: 'Final review before submission to TikTok.',
  appeal_submitted: 'Waiting for TikTok response (1–14 days typically).',
  awaiting_tiktok: 'TikTok is reviewing — we will notify you the moment they reply.',
  response_received: 'We are evaluating their response and planning next steps.',
  won: 'Your appeal was successful! Reach out if you need anything else.',
  denied: 'Review the case notes for next steps and escalation options.',
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinCase, leaveCase } = useSocket();
  const { toast } = useToast();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [tab, setTab] = useState<'timeline' | 'evidence' | 'messages'>('timeline');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchCase();
    joinCase(parseInt(id));
    return () => leaveCase(parseInt(id));
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    const numericId = parseInt(id);
    const onMsg = (payload: unknown) => {
      const raw = isRecord(payload) ? payload : {};
      const cid = pickNumber(raw.case_id ?? raw.caseId);
      if (cid != null && cid !== numericId) return;
      const normalized: Message = {
        id: pickNumber(raw.id) ?? Date.now(),
        sender_discord_id: pickString(raw.sender_discord_id),
        sender_type: pickSenderType(raw.sender_type),
        content: pickString(raw.content),
        created_at: pickString(raw.created_at) || new Date().toISOString(),
        is_read: raw.is_read === true,
      };
      setCaseData((p) => p ? { ...p, messages: [...p.messages, normalized] } : p);
    };
    const onStatus = (payload: unknown) => {
      const raw = isRecord(payload) ? payload : {};
      const cid = pickNumber(raw.caseId);
      if (cid !== numericId) return;
      const newStatus = pickString(raw.newStatus);
      if (!newStatus) return;
      setCaseData((p) => p ? { ...p, status: newStatus } : p);
      toast(`Status updated: ${newStatus.replace(/_/g, ' ')}`, 'info');
      fetchCase();
    };
    socket.on('message:new', onMsg);
    socket.on('case:status_changed', onStatus);
    return () => { socket.off('message:new', onMsg); socket.off('case:status_changed', onStatus); };
  }, [socket, id]);

  useEffect(() => {
    if (tab === 'messages') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Mark staff messages as read when the client opens the messages tab.
      if (id) {
        fetch(`/api/messages/read/${id}`, { method: 'PATCH', credentials: 'include' }).catch(() => { /* noop */ });
      }
    }
  }, [caseData?.messages.length, tab, id]);

  const fetchCase = async () => {
    try {
      const r = await fetch(`/api/cases/${id}`, { credentials: 'include' });
      if (r.ok) setCaseData(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!text.trim() || !id) return;
    setSending(true);
    try {
      const r = await fetch('/api/messages', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: parseInt(id), content: text }),
      });
      if (!r.ok) throw new Error('Failed to send');
      setText('');
      if (taRef.current) taRef.current.style.height = 'auto';
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed to send', 'error'); }
    finally { setSending(false); }
  };

  const onTaChange = (v: string) => {
    setText(v);
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = Math.min(120, taRef.current.scrollHeight) + 'px';
    }
  };

  const countdown = useCountdown(caseData?.appeal_deadline);
  const myDiscordId = user?.discord_id;

  if (loading) return <LoadingSpinner fullScreen label="Loading case..." />;
  if (!caseData) return (
    <div className="page-wrap">
      <EmptyState title="Case not found" subtitle="This case may have been deleted or you don't have access." actionLabel="Back to dashboard" onAction={() => navigate('/dashboard')} />
    </div>
  );

  const isImage = (t?: string, name?: string) =>
    (t || '').toLowerCase().includes('image') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name || '') || /^data:image/.test(t || '');

  return (
    <div className="page-wrap">
      <button onClick={() => navigate('/cases')} style={{
        marginBottom: 14, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
        background: 'transparent', border: 'none', cursor: 'pointer',
      }}>← My Cases</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '4px 10px',
          background: 'var(--bg-glass)', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-muted)', fontFamily: 'monospace',
        }}>Case #{caseData.id}</span>
        <StatusBadge status={caseData.status} />
        {caseData.staff_name && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· Assigned to <strong style={{ color: 'var(--text-primary)' }}>{caseData.staff_name}</strong></span>
        )}
      </div>
      <h1 style={{ margin: '6px 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
        {(caseData.violation_type || 'case').replace(/_/g, ' ')} · <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>@{caseData.account_username}</span>
      </h1>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <span>Opened {new Date(caseData.created_at).toLocaleDateString()}</span>
        {countdown && (
          <span style={{ color: countdown.urgent ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
            ⏱ {countdown.label}
          </span>
        )}
      </div>

      {/* "What's happening now" callout */}
      <GlassCard noHover style={{ padding: 18, marginBottom: 20, background: 'rgba(88,101,242,0.06)', border: '1px solid rgba(88,101,242,0.25)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          What's happening right now
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          {STATUS_LABEL[caseData.status] || caseData.status.replace(/_/g, ' ')}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {NEXT_ACTION[caseData.status] || 'We will keep you posted on next steps here.'}
        </div>
      </GlassCard>

      <div className="case-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* LEFT: tabbed content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassCard noHover style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {[
                { k: 'timeline', l: 'Timeline' },
                { k: 'evidence', l: `Evidence (${caseData.evidence?.length || 0})` },
                { k: 'messages', l: `Messages (${caseData.messages?.length || 0})` },
              ].map((t) => (
                <button key={t.k} onClick={() => setTab(t.k as 'timeline' | 'evidence' | 'messages')} style={{
                  flex: 1, padding: '14px 12px', background: 'transparent',
                  border: 'none', borderBottom: tab === t.k ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t.k ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'var(--transition)',
                }}>{t.l}</button>
              ))}
            </div>
            <div style={{ padding: 20, minHeight: 320 }}>
              {tab === 'timeline' && (
                <CaseTimeline stages={caseData.timeline} currentStatus={caseData.status} />
              )}
              {tab === 'evidence' && (
                caseData.evidence?.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                    {caseData.evidence.map((e) => {
                      const tile: React.CSSProperties = {
                        aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden',
                        background: 'var(--bg-glass)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                      };
                      if (isImage(e.file_type, e.file_name)) {
                        return (
                          <button key={e.id} type="button" onClick={() => setLightbox(e.file_url)}
                            style={{ ...tile, cursor: 'zoom-in', padding: 0, border: 'none' }}>
                            <img src={e.file_url} alt={e.description || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </button>
                        );
                      }
                      return (
                        <a key={e.id} href={e.file_url} target="_blank" rel="noreferrer"
                          style={{ ...tile, textDecoration: 'none', color: 'inherit' }}>
                          <div style={{ textAlign: 'center', padding: 8, fontSize: 12 }}>
                            <div style={{ fontSize: 22 }}>📎</div>
                            <div style={{ marginTop: 4, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{e.file_name || 'Open'}</div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon="📁" title="No evidence yet" subtitle="Files you uploaded will appear here." />
                )
              )}
              {tab === 'messages' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: 460 }}>
                  <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
                    {caseData.messages.length === 0 ? (
                      <EmptyState icon="💬" title="No messages yet" subtitle="Send your first message below." />
                    ) : (() => {
                      // Find the last message I sent so we can show a read-receipt below it.
                      const myMessages = caseData.messages.filter((mm) => mm.sender_type === 'client' || mm.sender_discord_id === myDiscordId);
                      const lastMineId = myMessages.length ? myMessages[myMessages.length - 1].id : null;
                      let prevDay = '';
                      const out: React.ReactNode[] = [];
                      caseData.messages.forEach((m) => {
                        const day = new Date(m.created_at).toDateString();
                        if (day !== prevDay) {
                          out.push(
                            <div key={`d-${day}`} style={{ alignSelf: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '4px 10px', background: 'var(--bg-glass)', borderRadius: 12, margin: '6px 0' }}>
                              {formatDayLabel(m.created_at)}
                            </div>
                          );
                          prevDay = day;
                        }
                        const mine = m.sender_discord_id === myDiscordId || m.sender_type === 'client';
                        out.push(
                          <motion.div key={m.id}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}
                          >
                            <div style={{
                              maxWidth: '78%',
                              background: mine ? 'var(--accent)' : 'var(--bg-glass)',
                              color: mine ? '#fff' : 'var(--text-primary)',
                              border: mine ? '1px solid var(--accent)' : '1px solid var(--border)',
                              padding: '10px 14px',
                              borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              fontSize: 14, lineHeight: 1.5,
                            }}>
                              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                              <div style={{ marginTop: 4, fontSize: 10, opacity: 0.65, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {mine && m.id === lastMineId && (
                                  <span aria-label={m.is_read ? 'Read' : 'Sent'}>{m.is_read ? '✓✓' : '✓'}</span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      });
                      return out;
                    })()}
                    <div ref={messagesEndRef} />
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <textarea
                      ref={taRef} value={text}
                      onChange={(e) => onTaChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a message... (Shift+Enter for new line)"
                      maxLength={2000}
                      className="field"
                      style={{ flex: 1, minHeight: 44, maxHeight: 120, resize: 'none', padding: '12px 14px' }}
                    />
                    <button onClick={handleSend} disabled={sending || !text.trim()} className="btn-primary" style={{ height: 44, width: 44, padding: 0, flexShrink: 0 }}>
                      {sending ? <span className="spin-dot" style={{ color: '#fff' }} /> : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="#fff" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {caseData.violation_description && (
            <GlassCard noHover style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>What you submitted</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                {caseData.violation_description}
              </p>
            </GlassCard>
          )}
        </div>

        {/* RIGHT: facts side panel */}
        <GlassCard noHover className="side-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Case Facts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Info label="Priority" value={caseData.priority || 'normal'} />
            <Info label="Outcome" value={caseData.outcome || 'pending'} />
            <Info label="Total GMV" value={`$${(caseData.total_gmv || 0).toLocaleString()}`} />
            <Info label="Face Videos" value={caseData.face_videos_posted ?? 0} />
            <Info label="Commission" value={caseData.commission_frozen ? 'Frozen' : 'Active'} />
            <Info label="Deadline" value={caseData.appeal_deadline ? new Date(caseData.appeal_deadline).toLocaleString() : '—'} />
          </div>
          {caseData.complianceScore && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
              <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Compliance</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: `conic-gradient(var(--accent) ${(caseData.complianceScore.score || 0) * 3.6}deg, var(--bg-glass) 0)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: '50%', background: 'var(--bg-primary)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{caseData.complianceScore.score}</span>
                    <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{caseData.complianceScore.grade}</span>
                  </div>
                </div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {caseData.complianceScore.recommendations?.slice(0, 2).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--accent)' }}>•</span>{r}</div>
                  ))}
                </div>
              </div>
            </>
          )}
        </GlassCard>
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(0,0,0,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={lightbox} alt=""
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 992px) {
          .case-grid { grid-template-columns: 1fr 320px !important; align-items: start; }
          .side-card { position: sticky; top: calc(var(--nav-h) + 20px); }
        }
      `}</style>
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
function pickSenderType(v: unknown): Message['sender_type'] {
  return v === 'staff' || v === 'ai' || v === 'system' || v === 'client' ? v : 'client';
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{value}</strong>
    </div>
  );
}
