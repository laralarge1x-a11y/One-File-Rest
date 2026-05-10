import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from './Toast';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  case_id?: number | null;
  action_url?: string | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ICON_FOR: Record<string, string> = {
  status_change: '🔄',
  message: '💬',
  case_resolved: '🏆',
  deadline: '⏰',
  policy: '📋',
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const discordId = user?.discord_id;

  const fetchAll = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications', { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setItems(d.notifications || []);
        setUnread(d.unread || 0);
      }
    } catch { /* network error swallowed */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Socket: subscribe to user room and listen for new notifications
  useEffect(() => {
    if (!discordId) return;
    // Socket auth is derived from the express session cookie on the server.
    // The user's private room (`user:<discord_id>`) is joined automatically
    // — we do NOT emit a client-supplied identity.
    const socket = io(window.location.origin, { reconnection: true, withCredentials: true });
    socketRef.current = socket;
    socket.on('notification:new', (n: Notification) => {
      setItems((prev) => [n, ...prev].slice(0, 50));
      setUnread((u) => u + 1);
      try { toast(n.title, 'info'); } catch { /* toast unavailable */ }
    });
    return () => { socket.disconnect(); };
  }, [discordId, toast]);

  // Click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnread((u) => Math.max(0, u - 1));
    fetch(`/api/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
  };

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const onClickItem = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    if (n.action_url) navigate(n.action_url);
    else if (n.case_id) navigate(`/cases/${n.case_id}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        style={{
          position: 'relative',
          width: 36, height: 36, borderRadius: 10,
          background: open ? 'var(--bg-glass-hover, rgba(255,255,255,0.08))' : 'var(--bg-glass, rgba(255,255,255,0.04))',
          border: '1px solid var(--border, #2a2a2a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'var(--transition, all 0.15s)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-primary, #fff)' }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 10,
            background: '#ED4245', color: '#fff',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-primary, #0a0a0a)',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 360, maxHeight: 480, overflow: 'hidden',
              background: 'rgba(20,20,20,0.98)',
              border: '1px solid var(--border, #2a2a2a)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column',
              zIndex: 200,
            }}
          >
            <div style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--border, #2a2a2a)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Notifications {unread > 0 && <span style={{ color: '#ED4245' }}>({unread})</span>}</div>
              {unread > 0 && (
                <button onClick={markAll} style={{
                  fontSize: 11, color: '#5865F2', fontWeight: 600,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}>Mark all read</button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {items.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#666', fontSize: 13 }}>
                  No notifications yet
                </div>
              ) : items.map((n) => (
                <button
                  key={n.id} onClick={() => onClickItem(n)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 16px',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    background: n.is_read ? 'transparent' : 'rgba(88,101,242,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer', border: 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(88,101,242,0.06)')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(88,101,242,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>{ICON_FOR[n.type] || '🔔'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5865F2', flexShrink: 0, marginTop: 6 }} />}
                </button>
              ))}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border, #2a2a2a)', textAlign: 'center' }}>
              <button onClick={() => { setOpen(false); navigate('/notifications'); }} style={{
                fontSize: 12, color: '#5865F2', fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer', width: '100%',
              }}>View all notifications →</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
