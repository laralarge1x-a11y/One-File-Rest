import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { GlassCard, LoadingSpinner, EmptyState, useToast } from '../components/customer';

interface Case {
  id: number; account_username: string; violation_type: string;
  status: string; created_at: string;
  last_message?: string; unread?: boolean;
}
interface Message {
  id: number; sender_discord_id: string; sender_type: string;
  content: string; created_at: string;
}

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinCase, leaveCase, sendMessage } = useSocket();
  const { toast } = useToast();
  const [cases, setCases] = useState<Case[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showThread, setShowThread] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fetchCases(); }, []);
  useEffect(() => {
    if (!activeId) return;
    setLoadingThread(true);
    setShowThread(true);
    joinCase(activeId);
    fetch(`/api/cases/${activeId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setMessages(d?.messages || []))
      .finally(() => setLoadingThread(false));
    return () => leaveCase(activeId);
  }, [activeId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (raw: any) => {
      const incomingCaseId = raw.case_id ?? raw.caseId;
      if (activeId != null && incomingCaseId != null && Number(incomingCaseId) !== activeId) return;
      const normalized: Message = {
        id: raw.id,
        sender_discord_id: raw.sender_discord_id ?? raw.senderDiscordId ?? '',
        sender_type: raw.sender_type ?? raw.senderType ?? 'client',
        content: raw.content ?? '',
        created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
      };
      setMessages((prev) => [...prev, normalized]);
    };
    socket.on('message:new', handler);
    return () => { socket.off('message:new', handler); };
  }, [socket, activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const fetchCases = async () => {
    try {
      const r = await fetch('/api/cases', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setCases(data);
        if (data.length && !activeId && window.innerWidth >= 768) setActiveId(data[0].id);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingList(false); }
  };

  const handleSend = async () => {
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      sendMessage(activeId, text, 'text');
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

  const myDiscordId = (user as any)?.discord_id;
  const filtered = cases.filter((c) =>
    !search ||
    c.account_username?.toLowerCase().includes(search.toLowerCase()) ||
    c.violation_type?.toLowerCase().includes(search.toLowerCase()) ||
    String(c.id).includes(search)
  );

  if (loadingList) return <LoadingSpinner fullScreen label="Loading messages..." />;

  return (
    <div className="page-wrap" style={{ paddingBottom: 20 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Messages</h1>
      <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>
        All conversations across your cases.
      </p>

      <div className="msg-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, position: 'relative' }}>
        <div className="msg-list" style={{ display: showThread ? 'none' : 'block' }}>
          <GlassCard noHover style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 480 }}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
              <input className="field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." />
            </div>
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {filtered.length === 0 ? (
                <EmptyState icon="📬" title="No conversations" subtitle="Submit a case to start chatting with our team."
                  actionLabel="Submit New Case" onAction={() => navigate('/cases/new')} />
              ) : filtered.map((c) => {
                const active = c.id === activeId;
                return (
                  <button key={c.id} onClick={() => setActiveId(c.id)} style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 12px', borderRadius: 'var(--radius-md)',
                    background: active ? 'var(--bg-glass-hover)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border-hover)' : 'transparent'}`,
                    display: 'flex', alignItems: 'center', gap: 12,
                    marginBottom: 4, transition: 'var(--transition)',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #5865F2, #7289DA)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14, flexShrink: 0,
                    }}>{(c.account_username || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          @{c.account_username}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>#{c.id}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.violation_type || '—'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>
        </div>

        <AnimatePresence>
          {(showThread || activeId) && (
            <motion.div
              key="thread"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="msg-thread"
              style={{ display: showThread ? 'block' : 'none' }}
            >
              <GlassCard noHover style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 480, maxHeight: '70vh' }}>
                <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => { setShowThread(false); setActiveId(null); }} className="msg-back" style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  }}>←</button>
                  {activeId && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        Case #{activeId} · @{cases.find((c) => c.id === activeId)?.account_username}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {cases.find((c) => c.id === activeId)?.violation_type}
                      </div>
                    </div>
                  )}
                  {activeId && (
                    <button onClick={() => navigate(`/cases/${activeId}`)} className="btn-ghost" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
                      Open Case
                    </button>
                  )}
                </div>
                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!activeId ? (
                    <EmptyState icon="💬" title="Select a conversation" subtitle="Pick a case from the list to view messages." />
                  ) : loadingThread ? (
                    <LoadingSpinner label="Loading thread..." />
                  ) : messages.length === 0 ? (
                    <EmptyState icon="✨" title="No messages yet" subtitle="Send your first message below." />
                  ) : messages.map((m) => {
                    const mine = m.sender_discord_id === myDiscordId || m.sender_type === 'client';
                    return (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '78%',
                          background: mine ? 'var(--accent)' : 'var(--bg-glass)',
                          color: mine ? '#fff' : 'var(--text-primary)',
                          border: `1px solid ${mine ? 'var(--accent)' : 'var(--border)'}`,
                          padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
                          borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        }}>
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                          <div title={new Date(m.created_at).toLocaleString()} style={{
                            marginTop: 4, fontSize: 10, opacity: 0.65,
                          }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                {activeId && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <textarea
                      ref={taRef}
                      value={text}
                      onChange={(e) => onTaChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a message..." maxLength={2000}
                      className="field"
                      style={{ flex: 1, minHeight: 44, maxHeight: 120, resize: 'none', padding: '12px 14px' }}
                    />
                    <button onClick={handleSend} disabled={sending || !text.trim()} className="btn-primary" style={{ height: 44, width: 44, padding: 0, flexShrink: 0 }}>
                      {sending ? <span className="spin-dot" style={{ color: '#fff' }} /> : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="#fff" /></svg>
                      )}
                    </button>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .msg-layout { grid-template-columns: 320px 1fr !important; }
          .msg-list { display: block !important; }
          .msg-thread { display: block !important; }
          .msg-back { display: none !important; }
        }
      `}</style>
    </div>
  );
}
