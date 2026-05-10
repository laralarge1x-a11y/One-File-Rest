import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useCase } from '../../hooks/queries/useCases';
import { Card, Badge, Button, Avatar, Skeleton, Tabs, TabContent, Progress } from '../../components/ui';
import { CaseTimeline } from '../../components/case';
import StageChip from '../../components/case/StageChip';
import DocumentChecklist from '../../components/case/DocumentChecklist';
import { STAGES, statusToStage, getStageMeta } from '@shared/stages';
import { useToast } from '../../components/customer/Toast';
import {
  ArrowLeft, Clock, Send, Image as ImageIcon, FileText, Download,
  ChevronRight, MessageSquare, AlertCircle, Activity, X, Upload as UploadIcon,
} from 'lucide-react';
import EvidenceUploader from '../../components/evidence/EvidenceUploader';

interface Message {
  id: number;
  sender_discord_id: string;
  sender_type: 'client' | 'staff' | 'ai' | 'system';
  content: string;
  created_at: string;
  is_read?: boolean;
}

const NEXT_ACTION: Record<string, string> = {
  pending: 'Our team will review and contact you within 24 hours.',
  intake: 'We may message you for clarifying details.',
  profile_built: 'We are drafting your appeal now.',
  appeal_drafted: 'Final review before submission to TikTok.',
  appeal_submitted: 'Waiting for TikTok response (1–14 days typically).',
  awaiting_tiktok: 'TikTok is reviewing — we will notify you.',
  response_received: 'We are evaluating their response.',
  won: 'Your appeal was successful!',
  denied: 'Review the case notes for next steps.',
};

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
  const label = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return { expired: false, label, urgent: ms < 24 * 3_600_000 };
}

function pickNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}
function pickString(v: unknown): string { return typeof v === 'string' ? v : ''; }
function pickSenderType(v: unknown): Message['sender_type'] {
  return v === 'staff' || v === 'ai' || v === 'system' || v === 'client' ? v : 'client';
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinCase, leaveCase } = useSocket();
  const { data: caseData, isLoading } = useCase(id);
  const { toast } = useToast();
  const [tab, setTab] = useState<'timeline' | 'evidence' | 'messages'>('timeline');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    joinCase(parseInt(id));
    return () => leaveCase(parseInt(id));
  }, [id]);

  useEffect(() => {
    if (caseData?.messages) setMessages(caseData.messages);
  }, [caseData?.messages]);

  useEffect(() => {
    if (!socket || !id) return;
    const numericId = parseInt(id);
    const onMsg = (payload: unknown) => {
      const raw = (typeof payload === 'object' && payload !== null) ? payload as any : {};
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
      setMessages((p) => [...p, normalized]);
    };
    // Typing indicator handler
    const onTyping = (data: { user: string; isTyping: boolean }) => {
      if (data.user === user?.discord_username) return;
      if (data.isTyping) {
        setTypingUsers((prev) => prev.includes(data.user) ? prev : [...prev, data.user]);
        clearTimeout(typingTimeoutRef.current[data.user]);
        typingTimeoutRef.current[data.user] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== data.user));
        }, 4000);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u !== data.user));
      }
    };
    socket.on('message:new', onMsg);
    socket.on('typing:indicator', onTyping);
    return () => {
      socket.off('message:new', onMsg);
      socket.off('typing:indicator', onTyping);
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
    };
  }, [socket, id, user?.discord_username]);

  useEffect(() => {
    if (tab === 'messages') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, tab]);

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

  const countdown = useCountdown(caseData?.appeal_deadline);
  const myDiscordId = user?.discord_id;

  const handleEvidenceUpload = useCallback(async (files: File[]) => {
    if (!id) return;
    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      for (const f of files) formData.append('files', f);
      formData.append('case_id', id);
      const r = await fetch('/api/evidence/upload', {
        method: 'POST', credentials: 'include',
        body: formData,
      });
      if (!r.ok) throw new Error('Upload failed');
      toast('Evidence uploaded successfully', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally { setUploadingEvidence(false); }
  }, [id, toast]);

  if (isLoading) return (
    <div className="page-wrap">
      <Skeleton height={20} width={120} />
      <Skeleton height={32} width="60%" className="mt-4" />
      <Skeleton height={16} width="40%" className="mt-2" />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <Skeleton height={400} />
        <Skeleton height={300} />
      </div>
    </div>
  );

  if (!caseData) return (
    <div className="page-wrap text-center py-20">
      <AlertCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
      <h2 className="text-xl font-bold">Case not found</h2>
      <p className="text-sm text-[var(--text-secondary)] mt-2 mb-6">This case may have been deleted or you don't have access.</p>
      <Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
    </div>
  );

  const stage = caseData.stage || statusToStage(caseData.status, caseData.outcome);
  const stageMeta = getStageMeta(stage);
  const isImage = (t?: string, name?: string) =>
    (t || '').toLowerCase().includes('image') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name || '');

  return (
    <div className="page-wrap">
      {/* Back */}
      <button onClick={() => navigate('/cases')} className="flex items-center gap-1.5 mb-3 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={14} /> My Cases
      </button>

      {/* Header */}
      <div className="flex items-center flex-wrap gap-2 mb-1">
        <span className="text-[11px] font-bold px-1.5 py-0.5 bg-[var(--bg-glass)] border border-[var(--border)] rounded text-[var(--text-muted)] font-mono">
          Case #{caseData.id}
        </span>
        <StageChip stage={stage} long />
        {countdown && (
          <Badge variant={countdown.urgent ? 'danger' : 'warning'} size="sm">
            <Clock size={10} /> {countdown.label}
          </Badge>
        )}
        {caseData.staff_name && (
          <span className="text-xs text-[var(--text-muted)] ml-1">
            · Assigned <strong className="text-[var(--text-primary)]">{caseData.staff_name}</strong>
          </span>
        )}
      </div>
      <h1 className="text-2xl font-extrabold mt-1 mb-1" style={{ letterSpacing: -0.5 }}>
        {(caseData.violation_type || 'case').replace(/_/g, ' ')} · <span className="text-[var(--text-muted)] font-semibold">@{caseData.account_username}</span>
      </h1>
      <div className="flex gap-3 text-xs text-[var(--text-muted)] mb-4">
        <span>Opened {new Date(caseData.created_at).toLocaleDateString()}</span>
      </div>

      {/* Stage Progress */}
      <ProgressStrip currentStage={stage} />

      {/* What's happening */}
      <Card noHover className="!p-4 !mb-5" style={{ background: 'rgba(88,101,242,0.04)', border: '1px solid rgba(88,101,242,0.2)' }}>
        <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>What's happening now</div>
        <div className="text-sm font-bold">{stageMeta.label}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
          {NEXT_ACTION[caseData.status] || 'We will keep you posted.'}
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Left: Tabbed Content */}
        <Card noHover className="!p-0 !overflow-hidden">
          <Tabs
            tabs={[
              { key: 'timeline', label: 'Timeline' },
              { key: 'evidence', label: `Evidence (${caseData.evidence?.length || 0})` },
              { key: 'messages', label: `Messages (${messages.length})` },
            ]}
            active={tab}
            onChange={(k) => setTab(k as any)}
          />
          <div className="p-5 min-h-[320px]">
            <TabContent active={tab} value="timeline">
              <CaseTimeline stages={caseData.timeline} currentStatus={caseData.status} />
            </TabContent>

            <TabContent active={tab} value="evidence">
              {/* Upload area */}
              <div className="mb-4">
                <EvidenceUploader onUpload={handleEvidenceUpload} />
                {uploadingEvidence && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
                    <span className="spin-dot" /> Uploading...
                  </div>
                )}
              </div>
              {caseData.evidence?.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                  {caseData.evidence.map((e: any) => {
                    if (isImage(e.file_type, e.file_name)) {
                      return (
                        <button key={e.id} onClick={() => setLightbox(e.file_url)}
                          className="aspect-square rounded-xl overflow-hidden bg-[var(--bg-glass)] border border-[var(--border)] cursor-zoom-in p-0"
                        >
                          <img src={e.file_url} alt={e.description || ''} loading="lazy" className="w-full h-full object-cover" />
                        </button>
                      );
                    }
                    return (
                      <a key={e.id} href={e.file_url} target="_blank" rel="noreferrer"
                        className="aspect-square rounded-xl bg-[var(--bg-glass)] border border-[var(--border)] flex flex-col items-center justify-center gap-1 text-xs text-[var(--text-secondary)]"
                      >
                        <FileText size={20} />
                        <span className="text-[10px] px-1 text-center leading-tight line-clamp-2">{e.file_name || 'Open'}</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <ImageIcon size={36} className="mx-auto mb-3" />
                  <p>No evidence uploaded yet. Drag & drop or click above to upload.</p>
                </div>
              )}
            </TabContent>

            <TabContent active={tab} value="messages">
              <div className="flex flex-col h-[460px]">
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pb-2">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">
                      <MessageSquare size={36} className="mx-auto mb-3" />
                      <p>No messages yet. Send your first message below.</p>
                    </div>
                  ) : (() => {
                    let prevDay = '';
                    const out: React.ReactNode[] = [];
                    messages.forEach((m) => {
                      const day = new Date(m.created_at).toDateString();
                      if (day !== prevDay) {
                        out.push(
                          <div key={`d-${day}`} className="text-center text-[11px] text-[var(--text-muted)] py-1 px-3 bg-[var(--bg-glass)] rounded-full mx-auto" style={{ width: 'fit-content' }}>
                            {formatDayLabel(m.created_at)}
                          </div>
                        );
                        prevDay = day;
                      }
                      const mine = m.sender_discord_id === myDiscordId || m.sender_type === 'client';
                      out.push(
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed"
                            style={{
                              background: mine ? 'var(--accent)' : 'var(--bg-glass)',
                              color: mine ? '#fff' : 'var(--text-primary)',
                              border: `1px solid ${mine ? 'var(--accent)' : 'var(--border)'}`,
                              borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            }}
                          >
                            <div className="whitespace-pre-wrap break-words">{m.content}</div>
                            <div className="mt-1 text-[10px] opacity-65 flex justify-end gap-1">
                              <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {mine && <span style={{ color: m.is_read ? '#57F287' : 'var(--text-muted)' }}>{m.is_read ? '✓✓' : '✓'}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    });
                    return out;
                  })()}
                  <div ref={messagesEndRef} />
                </div>
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 pb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '200ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '400ms' }} />
                    </span>
                    <span className="italic">{typingUsers.join(', ')} typing...</span>
                  </div>
                )}
                <div className="border-t border-[var(--border)] pt-3 flex gap-2 items-end">
                  <textarea
                    ref={taRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (taRef.current) {
                        taRef.current.style.height = 'auto';
                        taRef.current.style.height = Math.min(120, taRef.current.scrollHeight) + 'px';
                      }
                      // Emit typing
                      if (socket && id) {
                        socket.emit('typing:start', parseInt(id));
                        clearTimeout((taRef as any).__typingTimer);
                        (taRef as any).__typingTimer = setTimeout(() => socket.emit('typing:stop', parseInt(id)), 1500);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message... (Shift+Enter for new line)"
                    maxLength={2000}
                    className="flex-1 bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] p-3 text-sm resize-none min-h-[44px] max-h-[120px] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] transition-all"
                  />
                  <button onClick={handleSend} disabled={sending || !text.trim()}
                    className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--accent)] text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-all hover:brightness-110"
                  >
                    {sending ? <span className="spin-dot" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </TabContent>
          </div>
        </Card>

        {/* Right: Facts Panel */}
        <Card noHover className="!p-5 sticky top-[calc(var(--nav-h)+20px)]">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Case Facts</h3>
          <div className="space-y-2.5">
            <Info label="Priority" value={caseData.priority || 'normal'} />
            <Info label="Outcome" value={caseData.outcome || 'pending'} />
            <Info label="Total GMV" value={`$${(caseData.total_gmv || 0).toLocaleString()}`} />
            <Info label="Face Videos" value={caseData.face_videos_posted ?? 0} />
            <Info label="Commission" value={caseData.commission_frozen ? 'Frozen' : 'Active'} />
            <Info label="Deadline" value={caseData.appeal_deadline ? new Date(caseData.appeal_deadline).toLocaleString() : '—'} />
          </div>
          <div className="h-px bg-[var(--border)] my-4" />
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Checklist</h4>
          <DocumentChecklist caseId={caseData.id} currentStage={caseData.status} canEdit />

          {caseData.complianceScore && (
            <>
              <div className="h-px bg-[var(--border)] my-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Compliance</h4>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--bg-glass)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="3"
                      strokeDasharray={`${(caseData.complianceScore.score / 100) * 97} 97`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-extrabold">{caseData.complianceScore.score}</span>
                    <span className="text-[8px] uppercase text-[var(--text-muted)]">{caseData.complianceScore.grade}</span>
                  </div>
                </div>
                <div className="flex-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                  {caseData.complianceScore.recommendations?.slice(0, 2).map((r: string, i: number) => (
                    <div key={i} className="flex gap-1.5"><span className="text-[var(--accent)]">•</span>{r}</div>
                  ))}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[500] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.92)' }}
          >
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={lightbox} alt=""
              className="max-w-full max-h-[90vh] rounded-xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
    <div className="flex justify-between items-center gap-2.5 text-xs">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <strong className="text-[var(--text-primary)] capitalize">{value}</strong>
    </div>
  );
}

function ProgressStrip({ currentStage }: { currentStage: string }) {
  const visible = STAGES.filter((s) => !s.terminal);
  const currentIdx = visible.findIndex((s) => s.id === currentStage);
  const isResolved = currentStage === 'resolved_won' || currentStage === 'resolved_lost';
  const meta = getStageMeta(currentStage);

  return (
    <div className="flex items-stretch gap-1 mb-4 p-3 bg-[var(--bg-glass)] border border-[var(--border)] rounded-xl overflow-x-auto">
      {visible.map((s, i) => {
        const done = isResolved || i < currentIdx;
        const active = !isResolved && i === currentIdx;
        const color = active ? meta.color : done ? '#57F287' : '#3a3a44';
        return (
          <div key={s.id} className="flex-1 min-w-[80px] text-center" title={s.description}>
            <div className="h-1 rounded-sm mb-1.5 transition-all" style={{
              background: color,
              boxShadow: active ? `0 0 10px ${meta.glow}` : 'none',
            }} />
            <div className="text-[9px] font-semibold uppercase tracking-wider" style={{
              color: active ? meta.color : done ? '#57F287' : 'var(--text-muted)',
            }}>{s.short}</div>
          </div>
        );
      })}
      {isResolved && (
        <div className="flex-[1_0_90px] text-center">
          <div className="h-1 rounded-sm mb-1.5" style={{ background: meta.color, boxShadow: `0 0 10px ${meta.glow}` }} />
          <div className="text-[9px] font-bold uppercase" style={{ color: meta.color }}>{meta.short}</div>
        </div>
      )}
    </div>
  );
}