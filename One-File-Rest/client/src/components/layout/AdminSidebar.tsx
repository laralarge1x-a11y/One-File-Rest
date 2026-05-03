import React, { useEffect, useState, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface NavItem { to: string; label: string; icon: string; exact?: boolean }
interface SavedView {
  id: number;
  name: string;
  scope: string;
  query: Record<string, any>;
  pinned: boolean;
}

// Pinned section — most-used daily tools, ordered for muscle memory.
const PINNED: NavItem[] = [
  { to: '/admin',             label: 'Overview',     icon: '🏠', exact: true },
  { to: '/admin/stage-board', label: 'Stage Board',  icon: '🗂️' },
  { to: '/admin/cases',       label: 'Cases',        icon: '📋' },
  { to: '/admin/clients',     label: 'Clients',      icon: '👥' },
];

// "More" section — collapsible, lower-frequency tools.
const MORE: NavItem[] = [
  { to: '/admin/ai',         label: 'AI Tools',       icon: '🤖' },
  { to: '/admin/analytics',  label: 'Analytics',      icon: '📊' },
  { to: '/admin/templates',  label: 'Templates',      icon: '📝' },
  { to: '/admin/policies',   label: 'Policies',       icon: '📜' },
  { to: '/admin/kb',         label: 'Knowledge Base', icon: '📚' },
  { to: '/admin/broadcast',  label: 'Broadcast',      icon: '📢' },
  { to: '/admin/staff',      label: 'Staff',          icon: '👨‍💼' },
  { to: '/admin/settings',   label: 'Settings',       icon: '⚙️' },
];

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [systemOnline, setSystemOnline] = useState(true);
  const [moreOpen, setMoreOpen] = useState(true);
  const [views, setViews] = useState<SavedView[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const check = () => fetch('/health').then(() => setSystemOnline(true)).catch(() => setSystemOnline(false));
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  const refreshViews = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/saved-views', { credentials: 'include' });
      if (r.ok) { const j = await r.json(); setViews(j.views || []); }
    } catch {}
  }, []);
  useEffect(() => { refreshViews(); }, [refreshViews]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const goToView = (v: SavedView) => {
    const qs = new URLSearchParams();
    for (const [k, val] of Object.entries(v.query || {})) {
      if (val != null && val !== '') qs.set(k, String(val));
    }
    const dest = v.scope === 'stage-board' ? '/admin/stage-board' : '/admin/cases';
    navigate(`${dest}?${qs.toString()}`);
  };

  const saveCurrentView = async () => {
    if (!newName.trim()) return;
    const params = new URLSearchParams(location.search);
    const query: Record<string, string> = {};
    params.forEach((v, k) => { query[k] = v; });
    const scope = location.pathname.includes('stage-board') ? 'stage-board' : 'cases';
    await fetch('/api/admin/saved-views', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), scope, query, pinned: false }),
    });
    setNewName('');
    setShowSaveModal(false);
    refreshViews();
  };

  const deleteView = async (id: number) => {
    if (!confirm('Delete this saved view?')) return;
    await fetch(`/api/admin/saved-views/${id}`, { method: 'DELETE', credentials: 'include' });
    refreshViews();
  };

  const togglePinned = async (v: SavedView) => {
    await fetch(`/api/admin/saved-views/${v.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !v.pinned }),
    });
    refreshViews();
  };

  const sidebar = (
    <aside style={{
      width: 240, minWidth: 240, minHeight: '100vh',
      background: '#0F0F0F', display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #1a1a1a',
    }} className="admin-sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #5865F2, #EB459E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>⚡</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>Elite Tok Club</div>
            <div style={{ color: '#5865F2', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.08, marginTop: 2 }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        <button
          onClick={() => {
            // Dispatch a dedicated open event so clicking the sidebar item
            // always opens + focuses the Ask Elite panel.
            window.dispatchEvent(new CustomEvent('ask-elite:open'));
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            background: 'linear-gradient(135deg, rgba(88,101,242,0.15), rgba(235,69,158,0.15))',
            color: '#e7e7ea', fontSize: '13px', fontWeight: 600,
          }}>
          <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>✨</span>
          Ask Elite (⌘J)
        </button>

        <SectionHeader>Pinned</SectionHeader>
        {PINNED.map((item) => <NavRow key={item.to} item={item} />)}

        <SectionHeader
          collapsible
          open={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >More</SectionHeader>
        {moreOpen && MORE.map((item) => <NavRow key={item.to} item={item} />)}

        <SectionHeader>
          <span>Saved Views</span>
          <button
            onClick={() => setShowSaveModal(true)}
            title="Save current filters"
            style={{
              background: 'transparent', border: 'none', color: '#5865F2',
              fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1,
            }}
          >＋</button>
        </SectionHeader>
        {views.length === 0 ? (
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#555', fontStyle: 'italic' }}>
            None yet — apply filters then save.
          </div>
        ) : (
          views.map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px', borderRadius: 6, marginBottom: 1,
                fontSize: 12, color: '#aaa',
              }}
            >
              <button
                onClick={() => goToView(v)}
                style={{
                  flex: 1, textAlign: 'left', background: 'transparent', border: 'none',
                  color: 'inherit', fontSize: 12, cursor: 'pointer', padding: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ marginRight: 6 }}>{v.pinned ? '★' : '☆'}</span>
                {v.name}
              </button>
              <button onClick={() => togglePinned(v)} title="Pin" style={iconBtn}>{v.pinned ? '★' : '☆'}</button>
              <button onClick={() => deleteView(v.id)} title="Delete" style={iconBtn}>×</button>
            </div>
          ))
        )}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid #1a1a1a' }}>
        <button
          onClick={() => {
            // Synthesize a Cmd+K so the global palette opens. Avoids importing
            // the palette directly into the sidebar.
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8, marginBottom: 10,
            background: '#1a1a22', border: '1px solid #2a2a32',
            color: '#aaa', fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span>🔍 Quick search</span>
          <kbd style={{ fontSize: 9, background: '#0a0a0a', padding: '1px 5px', borderRadius: 3, color: '#888' }}>⌘K</kbd>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 8px', background: '#111', borderRadius: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: systemOnline ? '#57F287' : '#ED4245', boxShadow: systemOnline ? '0 0 6px #57F287' : 'none' }} />
          <span style={{ fontSize: 11, color: systemOnline ? '#57F287' : '#ED4245', fontWeight: 600 }}>
            System {systemOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user.discord_avatar ? (
              <img src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=32`} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #333' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {user.discord_username?.[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.discord_username}</div>
              <div style={{ color: '#5865F2', fontSize: 10, textTransform: 'capitalize' }}>{user.role}</div>
            </div>
            <button onClick={logout} title="Sign out" style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 4 }}>↩</button>
          </div>
        )}
      </div>

      {showSaveModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }} style={{
          position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ width: 'min(360px, 100%)', background: '#101015', border: '1px solid #2a2a32', borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 12 }}>Save current view</div>
            <input
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. My open critical cases"
              onKeyDown={(e) => e.key === 'Enter' && saveCurrentView()}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                background: '#0a0a0a', border: '1px solid #2a2a32', color: '#fff', fontSize: 13,
              }}
            />
            <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
              Captures the current page's filter URL — re-open it from the sidebar later.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowSaveModal(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'transparent', border: '1px solid #2a2a32', color: '#888', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              <button onClick={saveCurrentView} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#5865F2', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="admin-sidebar-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        style={{
          display: 'none', position: 'fixed', top: 12, left: 12, zIndex: 80,
          width: 40, height: 40, borderRadius: 8, background: '#1a1a22',
          border: '1px solid #2a2a32', color: '#fff', fontSize: 18, cursor: 'pointer',
        }}
      >☰</button>

      <div className="admin-sidebar-desktop">{sidebar}</div>

      {mobileOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setMobileOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.6)' }}
          className="admin-sidebar-mobile-wrap"
        >
          <div style={{ height: '100vh' }}>{sidebar}</div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .admin-sidebar-desktop { display: none; }
          .admin-sidebar-toggle { display: block !important; }
        }
      `}</style>
    </>
  );
}

function SectionHeader({ children, collapsible, open, onClick }: {
  children: React.ReactNode; collapsible?: boolean; open?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 12px 6px', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.08, color: '#555',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: collapsible ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {collapsible && <span style={{ fontSize: 8 }}>{open ? '▼' : '▶'}</span>}
        {children}
      </div>
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.exact}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 8, marginBottom: 2,
        textDecoration: 'none', fontSize: 13, fontWeight: 500,
        transition: 'all 0.15s',
        background: isActive ? '#5865F2' : 'transparent',
        color: isActive ? '#fff' : '#888',
      })}
    >
      <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#555',
  fontSize: 12, cursor: 'pointer', padding: 2, lineHeight: 1,
};
