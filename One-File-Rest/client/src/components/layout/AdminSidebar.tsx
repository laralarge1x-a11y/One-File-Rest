import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/admin', label: 'Overview', icon: '🏠', exact: true },
  { to: '/admin/cases', label: 'Cases', icon: '📋' },
  { to: '/admin/clients', label: 'Clients', icon: '👥' },
  { to: '/admin/ai', label: 'AI Tools', icon: '🤖' },
  { to: '#ask-elite', label: 'Ask Elite (⌘J)', icon: '✨', isAction: true },
  { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { to: '/admin/staff', label: 'Staff', icon: '👨‍💼' },
  { to: '/admin/broadcast', label: 'Broadcast', icon: '📢' },
  { to: '/admin/templates', label: 'Templates', icon: '📝' },
  { to: '/admin/kb', label: 'Knowledge Base', icon: '📚' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const [systemOnline, setSystemOnline] = useState(true);

  useEffect(() => {
    const check = () => fetch('/health').then(() => setSystemOnline(true)).catch(() => setSystemOnline(false));
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <aside style={{ width: '240px', minWidth: '240px', minHeight: '100vh', background: '#0F0F0F', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1a1a1a' }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #5865F2, #EB459E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚡</div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '14px', lineHeight: 1 }}>Elite Tok Club</div>
            <div style={{ color: '#5865F2', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {navItems.map((item) => {
          if ((item as any).isAction) {
            // Synthesise the Cmd/Ctrl+J keypress so the global handler in
            // AskElitePanel handles open + focus consistently.
            const trigger = () => {
              const isMac = /Mac/.test(navigator.platform);
              const ev = new KeyboardEvent('keydown', { key: 'j', metaKey: isMac, ctrlKey: !isMac, bubbles: true });
              window.dispatchEvent(ev);
            };
            return (
              <button
                key={item.to}
                onClick={trigger}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: 'linear-gradient(135deg, rgba(88,101,242,0.15), rgba(235,69,158,0.15))',
                  color: '#e7e7ea', fontSize: '13px', fontWeight: 600,
                }}>
                <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
                textDecoration: 'none', fontSize: '13px', fontWeight: '500',
                transition: 'all 0.15s',
                background: isActive ? '#5865F2' : 'transparent',
                color: isActive ? '#fff' : '#888',
              })}
            >
              <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom — user + system status */}
      <div style={{ padding: '12px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', padding: '6px 8px', background: '#111', borderRadius: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: systemOnline ? '#57F287' : '#ED4245', boxShadow: systemOnline ? '0 0 6px #57F287' : 'none' }} />
          <span style={{ fontSize: '11px', color: systemOnline ? '#57F287' : '#ED4245', fontWeight: '600' }}>
            System {systemOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {user.discord_avatar ? (
              <img
                src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=32`}
                alt=""
                style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #333' }}
              />
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: '700' }}>
                {user.discord_username?.[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.discord_username}</div>
              <div style={{ color: '#5865F2', fontSize: '10px', textTransform: 'capitalize' }}>{user.role}</div>
            </div>
            <button onClick={logout} title="Sign out" style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '4px' }}>↩</button>
          </div>
        )}
      </div>
    </aside>
  );
}
