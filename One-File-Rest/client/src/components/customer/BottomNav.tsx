import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  cases: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  messages: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  profile: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

const ITEMS = [
  { to: '/dashboard', label: 'Home',     icon: ICONS.home },
  { to: '/cases',     label: 'Cases',    icon: ICONS.cases },
  { to: '/messages',  label: 'Messages', icon: ICONS.messages },
  { to: '/subscription', label: 'Profile', icon: ICONS.profile },
];

export default function BottomNav() {
  const loc = useLocation();
  const isActive = (p: string) => loc.pathname === p || loc.pathname.startsWith(p + '/');
  return (
    <nav className="bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
      height: 'var(--bottomnav-h)',
      background: 'rgba(8,8,8,0.92)',
      borderTop: '1px solid var(--border)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'none',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{ display: 'flex', height: '100%', width: '100%' }}>
        {ITEMS.map((item) => {
          const active = isActive(item.to);
          return (
            <Link key={item.to} to={item.to} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              position: 'relative',
            }}>
              <motion.div animate={{ scale: active ? 1.1 : 1, y: active ? -2 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                {item.icon}
              </motion.div>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</span>
              {active && <span style={{
                position: 'absolute', bottom: 8, width: 4, height: 4, borderRadius: '50%',
                background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)',
              }} />}
            </Link>
          );
        })}
      </div>
      <style>{`
        @media (max-width: 768px) {
          .bottom-nav { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
