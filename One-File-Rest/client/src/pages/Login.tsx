import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const handleClick = () => {
    setLoading(true);
    window.location.href = '/auth/discord';
  };

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: 'var(--bg-primary)',
      display: 'grid', gridTemplateColumns: '1fr',
    }} className="login-root">
      <div className="blob" style={{
        width: 520, height: 520, top: -160, left: -120,
        background: 'radial-gradient(circle, #5865F2 0%, transparent 70%)',
      }} />
      <div className="blob" style={{
        width: 460, height: 460, bottom: -200, right: -100, animationDelay: '-7s',
        background: 'radial-gradient(circle, #7289DA 0%, transparent 70%)',
      }} />

      <div className="login-left" style={{
        display: 'none', position: 'relative', padding: 60,
        flexDirection: 'column', justifyContent: 'space-between', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #5865F2, #7289DA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px var(--accent-glow)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" fill="#fff" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 17 }}>TikTok Recovery</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 style={{
            fontSize: 48, fontWeight: 800, lineHeight: 1.1, margin: 0,
            letterSpacing: -1.5, color: 'var(--text-primary)',
          }}>
            Recover Your<br />TikTok Account
          </h1>
          <p style={{ marginTop: 18, fontSize: 17, color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.6 }}>
            Expert appeal writing, case management, and 1-on-1 support — all in one place.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 28 }}>
            {['48h Response Time', 'Expert Appeal Writers', 'Real-time Updates'].map((p, i) => (
              <motion.div
                key={p}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  padding: '8px 14px', borderRadius: 999,
                  fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                <span style={{ color: 'var(--success)' }}>✓</span>{p}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 22,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            maxWidth: 460,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            "They got my account back in 36 hours after I'd given up. The team's appeal writing is on another level."
          </p>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FE2C55, #25F4EE)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Marcus T.</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@marcus.shops · 320K followers</div>
            </div>
          </div>
        </motion.div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', position: 'relative', zIndex: 1,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', maxWidth: 380 }}
        >
          <div className="login-mobile-brand" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, marginBottom: 28,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #5865F2, #7289DA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px var(--accent-glow)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" fill="#fff" /></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>TikTok Recovery</span>
          </div>

          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Welcome back
          </p>
          <h2 style={{ margin: '8px 0 10px', fontSize: 30, fontWeight: 800, letterSpacing: -0.8 }}>
            Sign in to your Portal
          </h2>
          <p style={{ margin: '0 0 28px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            Use your Discord account to access your recovery dashboard.
          </p>

          <motion.button
            onClick={handleClick}
            disabled={loading}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{
              width: '100%', height: 52, borderRadius: 12,
              background: '#5865F2', color: '#fff',
              fontSize: 15, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 0 30px var(--accent-glow)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <span className="spin-dot" style={{ color: '#fff' }} />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.211.375-.444.864-.607 1.25a18.27 18.27 0 00-5.487 0c-.163-.386-.395-.875-.607-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.08.08 0 00.087-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 00-.042-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.294.075.075 0 01.078-.01c3.928 1.793 8.18 1.793 12.062 0a.075.075 0 01.079.009c.12.098.246.198.373.295a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.076.076 0 00-.041.107c.36.699.77 1.364 1.225 1.994a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-4.467.151-8.35-.882-12.458a.06.06 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.964-2.157 2.157-2.157 1.193 0 2.156.964 2.157 2.157 0 1.191-.964 2.156-2.157 2.156zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.964-2.157 2.157-2.157 1.193 0 2.157.964 2.157 2.157 0 1.191-.964 2.156-2.157 2.156z" /></svg>
                Continue with Discord
              </>
            )}
          </motion.button>

          <p style={{ marginTop: 22, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            New here? Access is by invitation only.<br />Contact us on Discord to request access.
          </p>

          <p style={{ marginTop: 32, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            By continuing, you agree to our Terms of Service & Privacy Policy.
          </p>
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .login-root { grid-template-columns: 1.1fr 1fr !important; }
          .login-left { display: flex !important; }
          .login-mobile-brand { display: none !important; }
        }
      `}</style>
    </div>
  );
}
