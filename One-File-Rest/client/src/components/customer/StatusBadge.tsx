import React from 'react';

interface Props { status: string; size?: 'sm' | 'md'; }

const MAP: Record<string, { label: string; color: string; mode: 'pulse' | 'spin' | 'static' }> = {
  open:        { label: 'Open',        color: '#FEE75C', mode: 'pulse' },
  pending:     { label: 'Pending',     color: '#FEE75C', mode: 'pulse' },
  in_progress: { label: 'In Progress', color: '#5865F2', mode: 'spin'  },
  in_review:   { label: 'In Review',   color: '#5865F2', mode: 'spin'  },
  appealing:   { label: 'Appealing',   color: '#5865F2', mode: 'spin'  },
  resolved:    { label: 'Resolved',    color: '#57F287', mode: 'static' },
  won:         { label: 'Won',         color: '#57F287', mode: 'static' },
  closed:      { label: 'Closed',      color: 'rgba(255,255,255,0.4)', mode: 'static' },
  denied:      { label: 'Denied',      color: '#ED4245', mode: 'static' },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = MAP[status?.toLowerCase()] || { label: status || 'Unknown', color: 'rgba(255,255,255,0.4)', mode: 'static' };
  const dot = cfg.mode === 'spin' ? <span className="spin-dot" style={{ color: cfg.color }} />
            : cfg.mode === 'pulse' ? <span className="pulse-dot" style={{ color: cfg.color }} />
            : <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: size === 'sm' ? '4px 10px' : '6px 12px',
      borderRadius: 999,
      background: `${cfg.color}15`,
      border: `1px solid ${cfg.color}30`,
      color: cfg.color,
      fontWeight: 600,
      fontSize: size === 'sm' ? 11 : 12,
      lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      {dot}{cfg.label}
    </span>
  );
}
