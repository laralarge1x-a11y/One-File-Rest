import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePolicyAlerts } from '../../hooks/queries/usePolicyAlerts';
import { useSocket } from '../../hooks/useSocket';
import { Badge, Skeleton, Input, Button } from '../../components/ui';
import { AlertTriangle, Info, ShieldAlert, ChevronDown, ChevronUp, Clock, Filter } from 'lucide-react';

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  critical: {
    label: 'Critical',
    color: '#ED4245',
    bg: 'rgba(237,66,69,0.08)',
    icon: <ShieldAlert size={18} />,
  },
  high: {
    label: 'High',
    color: '#FAA61A',
    bg: 'rgba(250,166,26,0.08)',
    icon: <AlertTriangle size={18} />,
  },
  warning: {
    label: 'Warning',
    color: '#FEE75C',
    bg: 'rgba(254,231,92,0.06)',
    icon: <AlertTriangle size={18} />,
  },
  info: {
    label: 'Info',
    color: '#5865F2',
    bg: 'rgba(88,101,242,0.06)',
    icon: <Info size={18} />,
  },
};

export default function PolicyAlerts() {
  const { data: alerts, isLoading } = usePolicyAlerts();
  const { socket } = useSocket();
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    if (!socket) return;
    const handler = (alert: any) => {
      setLiveAlerts((prev) => [alert, ...prev]);
    };
    socket.on('policy:new_alert', handler);
    return () => { socket.off('policy:new_alert'); };
  }, [socket]);

  const allAlerts = [...(alerts || []), ...liveAlerts];
  const filtered = severityFilter === 'all'
    ? allAlerts
    : allAlerts.filter((a: any) => a.severity === severityFilter);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="page-wrap" style={{ maxWidth: 900 }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert size={24} style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ letterSpacing: -0.5 }}>Policy Alerts</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          Stay updated with the latest TikTok policy changes and alerts.
        </p>
      </motion.div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { value: 'all', label: 'All', color: '' },
          { value: 'critical', label: 'Critical', color: '#ED4245' },
          { value: 'high', label: 'High', color: '#FAA61A' },
          { value: 'warning', label: 'Warning', color: '#FEE75C' },
          { value: 'info', label: 'Info', color: '#5865F2' },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => setSeverityFilter(s.value)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: severityFilter === s.value ? (s.color || 'var(--accent)') : 'var(--bg-glass)',
              color: severityFilter === s.value ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${severityFilter === s.value ? (s.color || 'var(--accent)') : 'var(--border)'}`,
            }}
          >
            {s.value !== 'all' && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            )}
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--border)] p-5 bg-[var(--bg-glass)]">
              <Skeleton height={14} width="25%" />
              <Skeleton height={16} width="50%" className="mt-3" />
              <Skeleton height={12} width="80%" className="mt-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Info size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-bold">No alerts</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">No policy alerts match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert: any, i: number) => {
            const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
            const isExpanded = expanded.has(alert.id);
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-[var(--radius-lg)] border overflow-hidden transition-all hover:border-[var(--border-hover)]"
                style={{ background: cfg.bg, borderColor: i === 0 && liveAlerts.includes(alert) ? cfg.color : 'var(--border)' }}
              >
                <button
                  onClick={() => toggleExpand(alert.id)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${cfg.color}18`, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{alert.title}</span>
                      <Badge
                        variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className={`text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {alert.content || alert.summary || alert.full_content}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                        <Clock size={10} />
                        {new Date(alert.created_at || alert.published_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded ? 'Less' : 'More'}
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}