// "Ask Elite" — staff-only AI chat panel pinned to the right edge of every
// admin page. Streams orchestrator events via SSE (POST /api/ai/ask).
//
// UX:
//   • Sidebar toggle (panel remembers open/closed in localStorage)
//   • Cmd/Ctrl+J global hotkey to focus the input
//   • Citation chips render below each answer with deep-links
//   • Tool steps render as transient "Searching cases…" status lines
//   • Suggested prompts when the thread is empty
//   • Slash-commands: /case 123, /client <id>, /deadline, /policy <topic>
//
// Threads: lazy-loaded from /api/ai/threads and rendered as a collapsible list.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Source { type: string; id: string | number; label: string; url?: string; snippet?: string }
interface Step { tool: string; ok?: boolean; summary?: string }
interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  steps?: Step[];
  pending?: boolean;
  errored?: boolean;
}
interface ThreadSummary { id: number; title: string; updated_at: string; message_count: number; pinned?: boolean }

const SUGGESTIONS = [
  'Which cases have an appeal deadline in the next 48 hours?',
  'Summarise everything we know about case #1.',
  'What did the client say in Discord vs in the portal for the most recent case?',
  'Show me cases where evidence is missing.',
  'Which appeal templates have the highest win rate for "consumer health"?',
  'Who on staff is least loaded right now?',
];

const SLASH_TEMPLATES: Record<string, string> = {
  '/case': 'Summarise case #',
  '/client': 'Show me everything about client ',
  '/deadline': 'List all cases with appeal deadlines in the next 7 days, ordered by urgency.',
  '/policy': 'Summarise the latest policy alerts about ',
  '/dossier': 'Build a full dossier for case #',
};

function panelOpenInitial(): boolean {
  try { return localStorage.getItem('askElite:open') === '1'; } catch { return false; }
}

export default function AskElitePanel() {
  const [open, setOpen] = useState<boolean>(panelOpenInitial);
  const [showHistory, setShowHistory] = useState(false);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist open state
  useEffect(() => {
    try { localStorage.setItem('askElite:open', open ? '1' : '0'); } catch {}
  }, [open]);

  // Cmd/Ctrl+J → toggle + focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((v) => {
          const next = !v;
          if (next) setTimeout(() => inputRef.current?.focus(), 80);
          return next;
        });
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    const onOpen = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 80);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('ask-elite:open', onOpen as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ask-elite:open', onOpen as EventListener);
    };
  }, [open]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Load thread list when history opens
  useEffect(() => {
    if (!showHistory) return;
    fetch('/api/ai/threads', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setThreads(d.threads || []))
      .catch(() => {});
  }, [showHistory]);

  const loadThread = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/ai/threads/${id}`, { credentials: 'include' });
      const d = await r.json();
      const msgs: AssistantMessage[] = (d.messages || []).map((m: any) => ({
        id: String(m.id), role: m.role, content: m.content, sources: m.sources || [],
      }));
      setMessages(msgs);
      setThreadId(id);
      setShowHistory(false);
    } catch {}
  }, []);

  const newThread = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setThreadId(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const send = useCallback(async (questionRaw: string) => {
    const question = questionRaw.trim();
    if (!question || busy) return;

    const userMsg: AssistantMessage = { id: `u-${Date.now()}`, role: 'user', content: question };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: AssistantMessage = { id: assistantId, role: 'assistant', content: '', steps: [], pending: true };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/ai/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ question, thread_id: threadId || undefined }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => 'Request failed');
        throw new Error(text || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const ev of events) {
          const line = ev.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          let data: any;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }
          setMessages((cur) => cur.map((m) => {
            if (m.id !== assistantId) return m;
            if (data.type === 'thread') { setThreadId(data.thread_id); return m; }
            if (data.type === 'step') return { ...m, steps: [...(m.steps || []), { tool: data.tool }] };
            if (data.type === 'tool_result') {
              const steps = [...(m.steps || [])];
              for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i].tool === data.tool && steps[i].ok === undefined) {
                  steps[i] = { ...steps[i], ok: data.ok, summary: data.summary };
                  break;
                }
              }
              return { ...m, steps };
            }
            if (data.type === 'sources') return { ...m, sources: data.sources };
            if (data.type === 'token') return { ...m, content: m.content + data.text };
            if (data.type === 'replace') return { ...m, content: data.text };
            if (data.type === 'done') return { ...m, pending: false };
            if (data.type === 'error') return { ...m, content: data.message, errored: true, pending: false };
            return m;
          }));
        }
      }
    } catch (err: any) {
      setMessages((cur) => cur.map((m) =>
        m.id === assistantId ? { ...m, content: err?.message || 'Request failed', errored: true, pending: false } : m
      ));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy, threadId]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const slashHint = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;
    const cmd = trimmed.split(/\s/)[0];
    const expansion = SLASH_TEMPLATES[cmd];
    return expansion ? `↳ ${expansion}` : null;
  }, [input]);

  // ── Launcher button (floats above sidebar bottom) ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ask Elite (Cmd/Ctrl + J)"
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 9999,
          width: 54, height: 54, borderRadius: 27,
          background: 'linear-gradient(135deg, #5865F2, #EB459E)',
          border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(88,101,242,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✨
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 'min(440px, 95vw)',
        background: '#0c0c0e', borderLeft: '1px solid #1d1d22',
        zIndex: 9998, display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.45)', color: '#e7e7ea',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1d1d22', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #5865F2, #EB459E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Ask Elite</div>
          <div style={{ fontSize: 10, color: '#7e7e87' }}>Read-only · staff only · cites everything</div>
        </div>
        <button title="History" onClick={() => setShowHistory((v) => !v)} style={iconBtn}>🕘</button>
        <button title="New thread" onClick={newThread} style={iconBtn}>＋</button>
        <button title="Close (Esc)" onClick={() => setOpen(false)} style={iconBtn}>✕</button>
      </div>

      {/* History panel */}
      {showHistory && (
        <div style={{ padding: 10, borderBottom: '1px solid #1d1d22', maxHeight: 280, overflowY: 'auto' }}>
          {threads.length === 0 && <div style={{ color: '#666', fontSize: 12, padding: 8 }}>No saved threads yet.</div>}
          {threads
            .slice()
            .sort((a, b) => Number(b.pinned || 0) - Number(a.pinned || 0))
            .map((t) => (
            <div key={t.id}
              style={{ padding: '8px 10px', borderRadius: 6, fontSize: 12, color: '#bbb', background: t.id === threadId ? '#1a1a22' : 'transparent', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div onClick={() => loadThread(t.id)} style={{ flex: 1, cursor: 'pointer', overflow: 'hidden' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.pinned ? '📌 ' : ''}{t.title || `Thread #${t.id}`}
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{t.message_count} msg · {new Date(t.updated_at).toLocaleString()}</div>
              </div>
              <button title="Rename" style={iconBtn} onClick={async () => {
                const name = window.prompt('New thread title:', t.title || '');
                if (name == null) return;
                await fetch(`/api/ai/threads/${t.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: name }) });
                setThreads((cur) => cur.map((x) => x.id === t.id ? { ...x, title: name } : x));
              }}>✎</button>
              <button title={t.pinned ? 'Unpin' : 'Pin'} style={iconBtn} onClick={async () => {
                const next = !t.pinned;
                await fetch(`/api/ai/threads/${t.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: next }) });
                setThreads((cur) => cur.map((x) => x.id === t.id ? { ...x, pinned: next } : x));
              }}>{t.pinned ? '📍' : '📌'}</button>
              <button title="Delete" style={iconBtn} onClick={async () => {
                if (!window.confirm('Delete this thread?')) return;
                await fetch(`/api/ai/threads/${t.id}`, { method: 'DELETE', credentials: 'include' });
                setThreads((cur) => cur.filter((x) => x.id !== t.id));
                if (t.id === threadId) newThread();
              }}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {messages.length === 0 && (
          <div>
            <div style={{ color: '#9c9ca6', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
              I can see every case, message, evidence file, KB article, audit event, and the full Discord transcript. Ask me anything about your operation.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} style={suggBtn}>{s}</button>
              ))}
            </div>
            <div style={{ color: '#5a5a64', fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
              Tips: <kbd style={kbd}>Cmd/Ctrl+J</kbd> to toggle · type <code style={code}>/case 123</code>, <code style={code}>/client</code>, <code style={code}>/deadline</code>, <code style={code}>/policy</code>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 14 }}>
            {m.role === 'user' ? (
              <div style={{ background: '#1a1a22', padding: '10px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
                {m.content}
              </div>
            ) : (
              <div>
                {(m.steps || []).length > 0 && (
                  <details style={{ marginBottom: 8 }} open={m.pending}>
                    <summary style={{ fontSize: 11, color: '#7a7a85', cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
                      🔎 Investigation · {(m.steps || []).length} step{(m.steps || []).length === 1 ? '' : 's'}
                      {m.pending && <span style={{ color: '#5865F2' }}> · running…</span>}
                    </summary>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 12, borderLeft: '2px solid #26262e' }}>
                      {(m.steps || []).map((s, i) => (
                        <div key={i} style={{ fontSize: 11, color: s.ok === false ? '#ed4245' : s.ok ? '#57f287' : '#7a7a85' }}>
                          {s.ok === undefined ? '⋯ ' : s.ok ? '✓ ' : '✗ '}
                          <code style={code}>{s.tool}</code>
                          {s.summary && <span style={{ color: '#666' }}> · {s.summary}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: m.errored ? '#ed4245' : '#e7e7ea' }}>
                  {m.content || (m.pending ? '…' : '')}
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {m.sources.map((s, i) => {
                      const chip = (
                        <span key={i} title={s.snippet || ''} style={{
                          fontSize: 10, padding: '4px 8px', borderRadius: 12,
                          background: '#1a1a22', border: '1px solid #2a2a33', color: '#9c9ca6',
                          maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'inline-block',
                        }}>
                          <span style={{ color: '#5865F2', fontWeight: 700 }}>#{i + 1}</span> {s.label}
                        </span>
                      );
                      return s.url
                        ? <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{chip}</a>
                        : chip;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} style={{ padding: 10, borderTop: '1px solid #1d1d22' }}>
        {slashHint && <div style={{ fontSize: 10, color: '#7e7e87', padding: '0 6px 6px' }}>{slashHint}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={busy ? 'Thinking…' : 'Ask anything about cases, clients, Discord, KB…'}
            disabled={busy}
            style={{
              flex: 1, resize: 'none', padding: 10, borderRadius: 8,
              background: '#16161b', color: '#e7e7ea', border: '1px solid #26262e',
              fontSize: 13, fontFamily: 'inherit',
            }}
          />
          <button
            type="submit" disabled={busy || !input.trim()}
            style={{
              padding: '10px 14px', borderRadius: 8, border: 'none', cursor: busy ? 'wait' : 'pointer',
              background: busy ? '#333' : 'linear-gradient(135deg, #5865F2, #EB459E)',
              color: '#fff', fontWeight: 600, fontSize: 13,
            }}>
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#9c9ca6', cursor: 'pointer', fontSize: 14, padding: 6 };
const suggBtn: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 12,
  background: '#16161b', color: '#bbb', border: '1px solid #26262e', cursor: 'pointer',
};
const kbd: React.CSSProperties = { background: '#1a1a22', border: '1px solid #26262e', padding: '1px 5px', borderRadius: 3, fontSize: 10 };
const code: React.CSSProperties = { background: '#1a1a22', padding: '1px 5px', borderRadius: 3, fontSize: 11, color: '#ddd' };
