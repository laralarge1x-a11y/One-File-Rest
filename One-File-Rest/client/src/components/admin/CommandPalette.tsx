import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import StageChip from '../case/StageChip';

import type { StageId } from '@shared/stages';

interface SearchResults {
  cases: Array<{ id: number; account_username: string; violation_type: string; status: string; discord_username: string; stage: StageId }>;
  clients: Array<{ discord_id: string; discord_username: string; plan?: string }>;
  staff: Array<{ discord_id: string; name: string; role: string }>;
  kb: Array<{ id: number; slug: string; title: string }>;
  templates: Array<{ id: number; template_name: string; violation_type: string }>;
}

const EMPTY_RESULTS: SearchResults = { cases: [], clients: [], staff: [], kb: [], templates: [] };

interface CommandPaletteProps {
  /** "admin" surfaces all sections; "customer" hides admin-only nav. */
  scope?: 'admin' | 'customer';
}

interface NavTarget { label: string; to: string; hint: string; icon: string; scope: 'admin' | 'customer' | 'both' }

const QUICK_NAV: NavTarget[] = [
  { label: 'Stage Board',     to: '/admin/stage-board', hint: 'kanban',    icon: '🗂️', scope: 'admin' },
  { label: 'Overview',        to: '/admin',             hint: 'home',      icon: '🏠', scope: 'admin' },
  { label: 'All Cases',       to: '/admin/cases',       hint: 'list',      icon: '📋', scope: 'admin' },
  { label: 'Clients',         to: '/admin/clients',     hint: 'people',    icon: '👥', scope: 'admin' },
  { label: 'AI Tools',        to: '/admin/ai',          hint: 'ai',        icon: '🤖', scope: 'admin' },
  { label: 'Analytics',       to: '/admin/analytics',   hint: 'numbers',   icon: '📊', scope: 'admin' },
  { label: 'Knowledge Base',  to: '/admin/kb',          hint: 'docs',      icon: '📚', scope: 'admin' },
  { label: 'Templates',       to: '/admin/templates',   hint: 'snippets',  icon: '📝', scope: 'admin' },
  { label: 'Broadcast',       to: '/admin/broadcast',   hint: 'announce',  icon: '📢', scope: 'admin' },
  { label: 'Staff',           to: '/admin/staff',       hint: 'team',      icon: '👨‍💼', scope: 'admin' },
  { label: 'Settings',        to: '/admin/settings',    hint: 'config',    icon: '⚙️', scope: 'admin' },
  // Customer surfaces:
  { label: 'My Dashboard',    to: '/dashboard',         hint: 'home',      icon: '🏠', scope: 'customer' },
  { label: 'My Cases',        to: '/cases',             hint: 'list',      icon: '📋', scope: 'customer' },
  { label: 'Submit New Case', to: '/cases/new',         hint: 'create',    icon: '＋', scope: 'customer' },
  { label: 'Messages',        to: '/messages',          hint: 'chat',      icon: '💬', scope: 'customer' },
  { label: 'Knowledge Base',  to: '/kb',                hint: 'docs',      icon: '📚', scope: 'customer' },
  { label: 'Specialists',     to: '/specialists',       hint: 'team',      icon: '👨‍💼', scope: 'customer' },
];

/**
 * Cmd+K command palette. Mounted once at the AdminLayout level. Listens
 * globally for Cmd/Ctrl+K and surfaces fuzzy nav, recent searches, and
 * cross-search results from /api/admin/search.
 */
export default function CommandPalette({ scope = 'admin' }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const navItems = QUICK_NAV.filter((n) => n.scope === scope || n.scope === 'both');

  // Global Cmd+K / Ctrl+K listener — also `/` opens the palette like Linear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === '/' && !inField) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        // Customer scope hits the customer-safe endpoint that only returns
        // the caller's own cases + KB articles.
        const url = scope === 'customer'
          ? `/api/cases?q=${encodeURIComponent(query)}`
          : `/api/admin/search?q=${encodeURIComponent(query)}`;
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) return;
        if (scope === 'customer') {
          // Customer palette: pull own cases (server filters by owner) and
          // KB articles in parallel. We rely on the server-side `q=` filter
          // for cases (added in cases.ts) so we don't post-filter here.
          const cases = await r.json();
          const kbResp = await fetch(`/api/kb?q=${encodeURIComponent(query)}`, { credentials: 'include' });
          const kb = kbResp.ok ? await kbResp.json() : [];
          const safeCases: SearchResults['cases'] = Array.isArray(cases)
            ? (cases as SearchResults['cases']).slice(0, 6)
            : [];
          const safeKb: SearchResults['kb'] = Array.isArray(kb)
            ? (kb as SearchResults['kb']).slice(0, 5)
            : [];
          setResults({ ...EMPTY_RESULTS, cases: safeCases, kb: safeKb });
        } else {
          setResults(await r.json());
        }
      } catch { /* ignored */ }
      finally { setLoading(false); }
    }, 180);
  }, [query, open, scope]);

  const go = (to: string) => { setOpen(false); setQuery(''); navigate(to); };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <Command
        label="Command palette"
        style={{
          width: 'min(640px, 92vw)',
          background: '#101015', border: '1px solid #2a2a32',
          borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #1a1a22' }}>
          <span style={{ fontSize: 14, opacity: 0.5 }}>⌘</span>
          <Command.Input
            placeholder="Jump to a page or search cases, clients, articles…"
            value={query}
            onValueChange={setQuery}
            autoFocus
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: 15,
            }}
          />
          {loading && <span style={{ fontSize: 11, opacity: 0.5 }}>searching…</span>}
          <kbd style={{ fontSize: 10, padding: '3px 6px', borderRadius: 4, background: '#1a1a22', color: '#888' }}>ESC</kbd>
        </div>

        <Command.List style={{ maxHeight: 420, overflowY: 'auto', padding: 6 }}>
          <Command.Empty style={{ padding: '24px 16px', textAlign: 'center', color: '#666', fontSize: 13 }}>
            {query.trim().length < 2 ? 'Start typing to search…' : 'No matches found.'}
          </Command.Empty>

          <Command.Group heading="Jump to" style={groupStyle}>
            {navItems.map((item) => (
              <Command.Item
                key={item.to}
                value={`${item.label} ${item.hint}`}
                onSelect={() => go(item.to)}
                style={itemStyle}
              >
                <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 10, color: '#555' }}>{item.hint}</span>
              </Command.Item>
            ))}
          </Command.Group>

          {results.cases.length > 0 && (
            <Command.Group heading="Cases" style={groupStyle}>
              {results.cases.map((c) => (
                <Command.Item key={`case-${c.id}`} value={`case ${c.id} ${c.account_username} ${c.violation_type}`} onSelect={() => go(scope === 'customer' ? `/cases/${c.id}` : `/admin/cases/${c.id}`)} style={itemStyle}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 6px', background: '#1a1a22', borderRadius: 4, color: '#888' }}>#{c.id}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{c.account_username} <span style={{ color: '#666' }}>· {c.violation_type || '—'}</span>
                  </span>
                  <StageChip stage={c.stage} size="xs" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results.clients.length > 0 && (
            <Command.Group heading="Clients" style={groupStyle}>
              {results.clients.map((u) => (
                <Command.Item key={`client-${u.discord_id}`} value={`client ${u.discord_username} ${u.discord_id}`} onSelect={() => go(`/admin/clients/${u.discord_id}`)} style={itemStyle}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>👤</span>
                  <span style={{ flex: 1 }}>{u.discord_username}</span>
                  {u.plan && <span style={{ fontSize: 10, color: '#888' }}>{u.plan}</span>}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results.staff.length > 0 && (
            <Command.Group heading="Staff" style={groupStyle}>
              {results.staff.map((s) => (
                <Command.Item key={`staff-${s.discord_id}`} value={`staff ${s.name}`} onSelect={() => go(`/admin/staff`)} style={itemStyle}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>🛡️</span>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span style={{ fontSize: 10, color: '#888', textTransform: 'capitalize' }}>{s.role}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results.kb.length > 0 && (
            <Command.Group heading="Knowledge Base" style={groupStyle}>
              {results.kb.map((k) => (
                <Command.Item
                  key={`kb-${k.id}`}
                  value={`kb ${k.title}`}
                  onSelect={() => go(scope === 'customer' ? `/kb/${k.slug}` : `/admin/kb`)}
                  style={itemStyle}
                >
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>📄</span>
                  <span style={{ flex: 1 }}>{k.title}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results.templates.length > 0 && (
            <Command.Group heading="Templates" style={groupStyle}>
              {results.templates.map((t) => (
                <Command.Item key={`tmpl-${t.id}`} value={`template ${t.template_name}`} onSelect={() => go(`/admin/templates`)} style={itemStyle}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>📝</span>
                  <span style={{ flex: 1 }}>{t.template_name}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>{t.violation_type || ''}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        <div style={{ display: 'flex', gap: 12, padding: '8px 14px', borderTop: '1px solid #1a1a22', fontSize: 10, color: '#666', justifyContent: 'flex-end' }}>
          <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> open</span>
          <span><kbd style={kbdStyle}>⌘K</kbd> toggle</span>
        </div>
      </Command>
      <style>{`
        [cmdk-item][data-selected="true"] { background: #1c1c2a !important; color: #fff !important; }
        [cmdk-group-heading] { padding: 8px 10px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; font-weight: 700; }
      `}</style>
    </div>
  );
}

const groupStyle: React.CSSProperties = { marginBottom: 4 };
const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
  fontSize: 13, color: '#ccc',
};
const kbdStyle: React.CSSProperties = {
  fontFamily: 'monospace', padding: '2px 5px', borderRadius: 3,
  background: '#1a1a22', color: '#888',
};
