import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/queries/useNotifications';
import { useNotificationStore } from '../../stores/notification-store';
import { Button, Badge, Skeleton, Input } from '../../components/ui';
import { Bell, CheckCheck, ArrowLeft, Filter, MessageSquare, AlertTriangle, Trophy, Clock, ExternalLink } from 'lucide-react';

const ICON_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  status_change: { icon: <Clock size={16} />, color: '#5865F2' },
  message: { icon: <MessageSquare size={16} />, color: '#57F287' },
  case_resolved: { icon: <Trophy size={16} />, color: '#FEE75C' },
  deadline: { icon: <AlertTriangle size={16} />, color: '#ED4245' },
  policy: { icon: <AlertTriangle size={16} />, color: '#FAA61A' },
};

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsCenter() {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const { markRead, markAllRead } = useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const items = data?.notifications || [];
  const filtered = items.filter((n: any) => {
    if (filter === 'unread' && n.is_read) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const handleClick = (n: any) => {
    if (!n.is_read) markRead(n.id);
    if (n.action_url) navigate(n.action_url);
    else if (n.case_id) navigate(`/cases/${n.case_id}`);
  };

  return (
    <div className="page-wrap" style={{ maxWidth: 800 }}>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-lg bg-[var(--bg-glass)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ letterSpacing: -0.5 }}>Notifications</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {data?.unread || 0} unread · {items.length} total
          </p>
        </div>
        {(data?.unread || 0) > 0 && (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck size={14} />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-glass)] text-[var(--text-secondary)] border border-[var(--border)]'
            }`}
          >
            {f === 'all' ? 'All' : `Unread (${data?.unread || 0})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-glass)]">
              <Skeleton height={14} width="30%" />
              <Skeleton height={12} width="60%" className="mt-2" />
              <Skeleton height={10} width="20%" className="mt-3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-bold">All caught up</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">No notifications match this filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n: any, i: number) => {
            const meta = ICON_MAP[n.type] || { icon: <Bell size={16} />, color: '#5865F2' };
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleClick(n)}
                className={`rounded-[var(--radius-lg)] border p-4 cursor-pointer transition-all hover:border-[var(--border-hover)] ${
                  n.is_read ? 'bg-[var(--bg-glass)] border-[var(--border)]' : 'border-[var(--accent)]'
                }`}
                style={!n.is_read ? { background: 'rgba(88,101,242,0.04)' } : {}}
              >
                <div className="flex gap-3 items-start">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${meta.color}18`, color: meta.color }}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{n.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{n.message}</p>
                    {n.case_id && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-[var(--accent)]">
                        <ExternalLink size={10} /> View case #{n.case_id}
                      </span>
                    )}
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 mt-1" style={{ boxShadow: '0 0 6px var(--accent-glow)' }} />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}