import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const LABELS: Record<string, string> = {
  admin: 'Admin',
  cases: 'Cases',
  clients: 'Clients',
  'stage-board': 'Stage Board',
  ai: 'AI Tools',
  analytics: 'Analytics',
  staff: 'Staff',
  broadcast: 'Broadcast',
  templates: 'Templates',
  policies: 'Policies',
  kb: 'Knowledge Base',
  settings: 'Settings',
};

/**
 * Slash-separated breadcrumbs derived from the URL. Mounted at the top of
 * every admin page (rendered by AdminLayout).
 */
export default function Breadcrumbs() {
  const loc = useLocation();
  const segs = loc.pathname.split('/').filter(Boolean);
  if (segs.length === 0 || segs[0] !== 'admin') return null;

  const crumbs = segs.map((seg, i) => {
    const to = '/' + segs.slice(0, i + 1).join('/');
    const isLast = i === segs.length - 1;
    // Numeric ids → render as `#123`, no link
    const isId = /^\d+$/.test(seg);
    const label = isId ? `#${seg}` : (LABELS[seg] || seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    return { to, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '12px 24px', fontSize: 12,
      borderBottom: '1px solid #1a1a1a', background: '#0a0a0a',
      color: 'rgba(255,255,255,0.5)',
    }}>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.to}>
          {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
          {c.isLast ? (
            <span style={{ color: '#fff', fontWeight: 600 }}>{c.label}</span>
          ) : (
            <Link to={c.to} style={{ color: 'inherit', textDecoration: 'none' }}>{c.label}</Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
