import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useCases } from '../../hooks/queries/useCases';
import { Card, Badge, Button, Input, Skeleton, Avatar } from '../../components/ui';
import { useToast } from '../../components/customer/Toast';
import { MessageSquare, Send, ArrowLeft, Search, ChevronRight, Circle } from 'lucide-react';

interface Message {
  id: number; sender_discord_id: string; sender_type: string;
  content: string; created_at: string;
}

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinCase, leaveCase } = useSocket();
  const { data: cases, isLoading } = useCases();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showThread, setShowThread] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const activeCase = useMemo(() => cases?.find((c: any) => c.id === activeId), [cases, activeId]);

  useEffect(() => {
    if (!activeId) return;
    setLoadingThread(true); setShowThread(true);
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
      setMessages((prev) => [...prev, {
        id: raw.id,
        sender_discord_id: raw.sender_discord_id ?? raw.senderDiscordId ?? '',
        sender_type: raw.sender_type ?? raw.senderType ?? 'client',
        content: raw.content ?? '',
        created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
      }]);
    };
    socket.on('message:new', handler);
    return () => { socket.off('message:new', handler); };
  }, [socket, activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      const r = await fetch('/api/messages', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: activeId, content: text }),
      });
      if (!r.ok) throw new Error('Failed');
      setText('');
      if (taRef.current) taRef.current.style.height = 'auto';
    } catch (e: any) { toast(e.message || 'Failed to send', 'error'); }
    finally { setSending(false); }
  };

  const myDiscordId = user?.discord_id;
  const filtered = cases?.filter((c: any) =>
    !search || c.account_username?.toLowerCase().includes(search.toLowerCase()) ||
    c.violation_type?.toLowerCase().includes(search.toLowerCase()) || String(c.id).includes(search)
  ) || [];

  return (
    <div className="page-wrap" style={{ paddingBottom: 20 }}>
      <h1 className="text-[26px] font-extrabold m-0 mb-1" style={{ letterSpacing: -0.5 }}>Messages</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-4">All conversations across your cases.</p>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 relative">
        {/* List */}
        <div className={showThread ? 'hidden md:block' : 'block'}>
          <Card noHover className="!p-0 flex flex-col" style={{ minHeight: 480 }}>
            <div className="p-3 border-b border-[var(--border)]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] pl-9 pr-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] transition-all"
                  placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton height={36} width={36} borderRadius="50%" />
                    <div className="flex-1"><Skeleton height={12} width="70%" /><Skeleton height={10} width="40%" className="mt-1" /></div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)] text-sm">
                  <MessageSquare size={32} className="mx-auto mb-3" />
                  {search ? 'No matches' : 'No conversations'}
                  {!search && <button onClick={() => navigate('/cases/new')} className="block mt-2 text-[var(--accent)] font-semibold text-xs">Submit a case</button>}
                </div>
              ) : filtered.map((c: any) => {
                const active = c.id === activeId;
                return (
                  <button key={c.id} onClick={() => { setActiveId(c.id); if (window.innerWidth < 768) setShowThread(true); }}
                    className={`w-full text-left p-3 rounded-[var(--radius-md)] flex items-center gap-3 mb-1 transition-all ${
                      active ? 'bg-[var(--bg-glass-hover)] border border-[var(--border-hover)]' : 'border border-transparent'
                    }`}
                  >
                    <Avatar name={c.account_username} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold truncate">@{c.account_username}</span>
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0">#{c.id}</span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{c.violation_type || '—'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Thread */}
        <AnimatePresence>
          {(showThread || activeId) && (
            <motion.div
              key="thread"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className={showThread ? 'block' : 'hidden md:block'}
            >
              <Card noHover className="!p-0 flex flex-col" style={{ minHeight: 480, maxHeight: '70vh' }}>
                <div className="p-3 border-b border-[var(--border)] flex items-center gap-2">
                  <button onClick={() => { setShowThread(false); setActiveId(null); }}
                    className="md:hidden w-9 h-9 rounded-lg bg-[var(--bg-glass)] border border-[var(--border)] flex items-center justify-center">
                    <ArrowLeft size={14} />
                  </button>
                  {activeCase && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">Case #{activeId} · @{activeCase.account_username}</div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">{activeCase.violation_type}</div>
                    </div>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => activeId && navigate(`/cases/${activeId}`)}>
                    Open Case
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2.5">
                  {!activeId ? (
                    <div className="text-center py-12 text-[var(--text-muted)] text-sm">
                      <MessageSquare size={32} className="mx-auto mb-3" />
                      Select a conversation
                    </div>
                  ) : loadingThread ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        <Skeleton height={40} width="60%" borderRadius="var(--radius-lg)" />
                      </div>
                    ))
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)] text-sm">
                      <MessageSquare size={32} className="mx-auto mb-3" />
                      No messages yet
                    </div>
                  ) : messages.map((m) => {
                    const mine = m.sender_discord_id === myDiscordId || m.sender_type === 'client';
                    return (
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
                          <div className="mt-1 text-[10px] opacity-65">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                {activeId && (
                  <div className="border-t border-[var(--border)] p-3 flex gap-2 items-end">
                    <textarea ref={taRef} value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        if (taRef.current) { taRef.current.style.height = 'auto'; taRef.current.style.height = Math.min(120, taRef.current.scrollHeight) + 'px'; }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a message..." maxLength={2000}
                      className="flex-1 bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] p-3 text-sm resize-none min-h-[44px] max-h-[120px] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] transition-all"
                    />
                    <button onClick={handleSend} disabled={sending || !text.trim()}
                      className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--accent)] text-white flex items-center justify-center shrink-0 disabled:opacity-50"
                    >
                      {sending ? <span className="spin-dot" /> : <Send size={16} />}
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}