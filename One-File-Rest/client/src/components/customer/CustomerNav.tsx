import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from './NotificationBell';
import AccountSwitcher from './AccountSwitcher';

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Dashboard' },
  { to: '/cases',        label: 'My Cases' },
  { to: '/messages',     label: 'Messages' },
  { to: '/kb',           label: 'Knowledge' },
  { to: '/specialists',  label: 'Specialists' },
];

function openCommandPalette() {
  // The CommandPalette listens globally for Cmd/Ctrl+K. Dispatching a
  // synthesized event is more robust than reaching into its component
  // ref because the palette is mounted once at the App root.
  const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
  window.dispatchEvent(ev);
}

function Avatar({ url, name, size = 32 }: { url?: string; name?: string; size?: number }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  if (url) {
    return <img src={url} alt={name} loading="lazy" style={{
      width: size, height: size, borderRadius: '50%', objectFit: 'cover',
      border: '1px solid var(--border)',
    }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.4,
    }}>{initial}</div>
  );
}

export default function CustomerNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isActive = (path: string) => loc.pathname === path || loc.pathname.startsWith(path + '/');

  const avatarUrl = (user as any)?.avatar_url || (user as any)?.avatar;

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 'var(--nav-h)',
        background: 'rgba(8,8,8,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: '100%', maxWidth: 1180, margin: '0 auto',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        }} className="nav-inner">
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #5865F2, #7289DA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px var(--accent-glow)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" fill="#fff" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.2 }}>TikTok Recovery</span>
          </Link>

          <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} style={{
                position: 'relative',
                padding: '8px 14px', borderRadius: 8,
                fontSize: 14, fontWeight: 500,
                color: isActive(item.to) ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive(item.to) ? 'var(--bg-glass)' : 'transparent',
                transition: 'var(--transition)',
              }}>
                {item.label}
                {isActive(item.to) && (
                  <motion.span layoutId="navUnderline" style={{
                    position: 'absolute', left: '50%', bottom: -16, transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)',
                    boxShadow: '0 0 8px var(--accent-glow)',
                  }} />
                )}
              </Link>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="nav-desktop"
              onClick={openCommandPalette}
              title="Search (⌘K)"
              aria-label="Open search"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', borderRadius: 999,
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <span>Search</span>
              <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>⌘K</kbd>
            </button>
            <div className="nav-desktop"><AccountSwitcher /></div>
            <NotificationBell />
            <div ref={menuRef} className="nav-desktop" style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen((v) => !v)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '4px 10px 4px 4px', borderRadius: 999,
                background: menuOpen ? 'var(--bg-glass-hover)' : 'var(--bg-glass)',
                border: '1px solid var(--border)',
                transition: 'var(--transition)',
              }}>
                <Avatar url={avatarUrl} name={user?.discord_username} size={28} />
                <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.discord_username}
                </span>
                <svg width="10" height="6" viewBox="0 0 12 8"><path d="M6 8L0 0h12z" fill="rgba(255,255,255,0.5)" /></svg>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                      minWidth: 200, background: 'rgba(20,20,20,0.96)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                      padding: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    {NAV_ITEMS.map((it) => (
                      <button key={it.to} onClick={() => navigate(it.to)} style={menuItem}>{it.label}</button>
                    ))}
                    <button onClick={() => navigate('/notifications')} style={menuItem}>Notifications</button>
                    <button onClick={() => navigate('/subscription')} style={menuItem}>Account & Plan</button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <button onClick={logout} style={{ ...menuItem, color: 'var(--danger)' }}>Logout</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button className="nav-mobile" onClick={() => setMobileOpen(true)} aria-label="Open menu" style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--bg-glass)', border: '1px solid var(--border)',
              display: 'none', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <rect width="18" height="2" rx="1" fill="#fff" />
                <rect y="6" width="18" height="2" rx="1" fill="#fff" />
                <rect y="12" width="18" height="2" rx="1" fill="#fff" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              height: 'var(--nav-h-mobile)', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '0 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 700 }}>Menu</span>
              <button onClick={() => setMobileOpen(false)} style={{
                width: 36, height: 36, borderRadius: 8, fontSize: 22,
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
              }}>×</button>
            </div>
            <motion.nav
              initial="hidden" animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
              style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {NAV_ITEMS.map((it) => (
                <motion.div key={it.to} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <Link to={it.to} style={{
                    display: 'block', padding: '14px 16px', borderRadius: 'var(--radius-md)',
                    background: isActive(it.to) ? 'var(--bg-glass-hover)' : 'transparent',
                    color: isActive(it.to) ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: 600, fontSize: 16,
                  }}>{it.label}</Link>
                </motion.div>
              ))}
              <motion.button
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                onClick={() => { logout(); }}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)', fontWeight: 600, fontSize: 16, marginTop: 8,
                  background: 'rgba(237,66,69,0.08)', border: '1px solid rgba(237,66,69,0.2)',
                }}
              >Logout</motion.button>
            </motion.nav>
            {user && (
              <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar url={avatarUrl} name={user.discord_username} size={40} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{user.discord_username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.role}</div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .nav-inner { padding: 0 14px !important; height: var(--nav-h-mobile) !important; }
          .nav-desktop { display: none !important; }
          .nav-mobile { display: flex !important; }
        }
        header { height: var(--nav-h); }
        @media (max-width: 768px) { header { height: var(--nav-h-mobile) !important; } }
      `}</style>
    </>
  );
}

const menuItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '10px 12px', borderRadius: 8,
  fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
  transition: 'var(--transition)',
};
