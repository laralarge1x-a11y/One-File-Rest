import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { GlassCard, StatusBadge, LoadingSpinner, EmptyState, useToast } from '../components/customer';

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
  complianceScore?: { score: number; grade: string; factors: any[]; recommendations: string[] };
  messages: Array<{ id: number; sender_discord_id: string; sender_type: string; content: string; created_at: string; sender_avatar?: string; sender_name?: string }>;
  evidence: Array<{ id: number; file_url: string; file_type: string; created_at: string }>;
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
  const secs = Math.floor((ms % 60_000) / 1000);
  let label = '';
  if (days > 0) label = `${days}d ${hours}h remaining`;
  else if (hours > 0) label = `${hours}h ${mins}m remaining`;
  else label = `${mins}m ${secs}s remaining`;
  return { expired: false, label, urgent: ms < 24 * 3_600_000 };
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinCase, leaveCase, sendMessage } = useSocket();
  const { toast } = useToast();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
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
    const handler = (raw: any) => {
      // Defensive normalization: server emits both snake_case and camelCase shapes
      const incomingCaseId = raw.case_id ?? raw.caseId;
      if (incomingCaseId != null && Number(incomingCaseId) !== numericId) return;
      const normalized = {
        id: raw.id,
        sender_discord_id: raw.sender_discord_id ?? raw.senderDiscordId ?? '',
        sender_type: raw.sender_type ?? raw.senderType ?? 'client',
        content: raw.content ?? '',
        created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
        sender_avatar: raw.sender_avatar,
        sender_name: raw.sender_name ?? raw.sender,
      };
      setCaseData((p) => p ? { ...p, messages: [...p.messages, normalized] } : p);
    };
    socket.on('message:new', handler);
    return () => { socket.off('message:new', handler); };
  }, [socket, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [caseData?.messages.length]);

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
      sendMessage(parseInt(id), text, 'text');
      setText('');
      if (taRef.current) taRef.current.style.height = 'auto';
    } catch (e: any) { toast(e.message || 'Failed to send', 'error'); }
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
  const myDiscordId = (user as any)?.discord_id;

  if (loading) return <LoadingSpinner fullScreen label="Loading case..." />;
  if (!caseData) return (
    <div className="page-wrap">
      <EmptyState title="Case not found" subtitle="This case may have been deleted or you don't have access." actionLabel="Back to dashboard" onAction={() => navigate('/dashboard')} />
    </div>
  );

  const isImage = (t?: string) => (t || '').toLowerCase().includes('image') || /\.(png|jpe?g|gif|webp|svg)$/i.test(t || '');

  return (
    <div className="page-wrap">
      <button onClick={() => navigate('/cases')} style={{
        marginBottom: 14, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
      }}>← My Cases</button>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '4px 10px',
          background: 'var(--bg-glass)', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-muted)', fontFamily: 'monospace',
        }}>Case #{caseData.id}</span>
        <StatusBadge status={caseData.status} />
      </div>
      <h1 style={{ margin: '6px 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
        {caseData.violation_type || 'Case'} · <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>@{caseData.account_username}</span>
      </h1>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>
        <span>Created {new Date(caseData.created_at).toLocaleDateString()}</span>
        {countdown && (
          <span style={{ color: countdown.urgent ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
            ⏱ {countdown.label}
          </span>
        )}
      </div>

      <div className="case-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassCard noHover style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Violation Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Info label="Priority" value={caseData.priority || 'Normal'} />
              <Info label="Outcome" value={caseData.outcome || 'Pending'} />
              <Info label="Total GMV" value={`$${(caseData.total_gmv || 0).toLocaleString()}`} />
              <Info label="Face Videos" value={caseData.face_videos_posted ?? 0} />
              <Info label="Commission" value={caseData.commission_frozen ? 'Frozen' : 'Active'} />
              <Info label="Deadline" value={caseData.appeal_deadline ? new Date(caseData.appeal_deadline).toLocaleDateString() : '—'} />
            </div>
            {caseData.violation_description && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Description</div>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {caseData.violation_description}
                </p>
              </>
            )}
          </GlassCard>

          {caseData.evidence?.length > 0 && (
            <GlassCard noHover style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Evidence ({caseData.evidence.length})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {caseData.evidence.map((e) => {
                  const tileStyle: React.CSSProperties = {
                    aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', padding: 0,
                  };
                  if (isImage(e.file_type)) {
                    return (
                      <button key={e.id} type="button" onClick={() => setLightbox(e.file_url)}
                        aria-label="Open evidence image" style={{ ...tileStyle, cursor: 'zoom-in' }}>
                        <img src={e.file_url} alt="evidence" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    );
                  }
                  return (
                    <a key={e.id} href={e.file_url} target="_blank" rel="noreferrer"
                      style={{ ...tileStyle, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                      <div style={{ textAlign: 'center', padding: 8, fontSize: 12 }}>
                        <div style={{ fontSize: 24 }}>📎</div>
                        <div style={{ marginTop: 4, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>Open file</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {caseData.complianceScore && (
            <GlassCard noHover style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Compliance Score</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: `conic-gradient(var(--accent) ${(caseData.complianceScore.score || 0) * 3.6}deg, var(--bg-glass) 0)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--bg-primary)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{caseData.complianceScore.score}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{caseData.complianceScore.grade}</span>
                  </div>
                </div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {caseData.complianceScore.recommendations?.slice(0, 2).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <span style={{ color: 'var(--accent)' }}>•</span>{r}
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        <GlassCard noHover className="msg-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 640, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Messages</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Real-time chat with our recovery team
            </p>
          </div>
          <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 280 }}>
            {caseData.messages.length === 0 ? (
              <EmptyState icon="💬" title="No messages yet" subtitle="Send your first message below to get started." />
            ) : caseData.messages.map((m) => {
              const mine = m.sender_discord_id === myDiscordId || m.sender_type === 'client';
              return (
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
                    <div title={new Date(m.created_at).toLocaleString()} style={{
                      marginTop: 4, fontSize: 10, opacity: 0.65,
                    }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={taRef}
              value={text}
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <motion.img
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              src={lightbox} alt=""
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 992px) {
          .case-grid { grid-template-columns: 1fr 420px !important; align-items: start; }
          .msg-card { position: sticky; top: calc(var(--nav-h) + 20px); }
        }
      `}</style>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
