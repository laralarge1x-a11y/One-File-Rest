import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import logoUrl from '@assets/logo_1777749351893.jpeg';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleLogin = () => {
    if (loading) return;
    setLoading(true);
    window.location.href = '/auth/discord';
  };

  const enter = (delay: number, y = 14) =>
    reduceMotion
      ? { initial: false, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
        };

  const features = [
    {
      title: 'Expert Support',
      desc: 'Chat with recovery specialists in real time',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: 'Secure & Private',
      desc: 'Your data is encrypted and always protected',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      ),
    },
    {
      title: 'Fast & Reliable',
      desc: 'We help you get back on track, faster',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      ),
    },
  ];

  const cardChips = [
    {
      title: 'Instant Access',
      sub: 'Get started right away',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      ),
    },
    {
      title: 'Secure Connection',
      sub: 'Powered by Discord OAuth',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      ),
    },
    {
      title: 'Exclusive Support',
      sub: 'Only for members',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 15 9l7 .8-5.3 4.7L18.2 22 12 18l-6.2 4 1.5-7.5L2 9.8 9 9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="etc-root">
      <style>{styles}</style>

      {/* ============ BACKGROUND ============ */}
      <div className="etc-bg" aria-hidden="true">
        <div className="etc-aurora etc-aurora-a" />
        <div className="etc-aurora etc-aurora-b" />
        <div className="etc-aurora etc-aurora-c" />
        <div className="etc-stars" />
        <div className="etc-mountains" />
        <div className="etc-portal">
          <div className="etc-portal-ring etc-portal-ring-1" />
          <div className="etc-portal-ring etc-portal-ring-2" />
          <div className="etc-portal-ring etc-portal-ring-3" />
          <div className="etc-portal-core" />
        </div>
        <div className="etc-vignette" />
      </div>

      {/* ============ HEADER ============ */}
      <motion.header className="etc-header" {...enter(0.0, 8)}>
        <div className="etc-brand">
          <div className="etc-brand-logo-wrap">
            <img src={logoUrl} alt="" className="etc-brand-logo" />
          </div>
          <div className="etc-brand-text">
            <span>ELITE TOK</span>
            <span>CLUB</span>
          </div>
        </div>
        <div className="etc-header-status">
          <span className="etc-status-dot" />
          <span>Live support</span>
        </div>
      </motion.header>

      {/* ============ MAIN GRID ============ */}
      <main className="etc-main">
        {/* LEFT — intro */}
        <section className="etc-left">
          <motion.div className="etc-eyebrow" {...enter(0.05)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Elite Tok Club Recovery Portal</span>
          </motion.div>

          <motion.h1 className="etc-headline" {...enter(0.1)}>
            Welcome <span className="etc-grad">back</span>
          </motion.h1>

          <motion.p className="etc-subtext" {...enter(0.16)}>
            Get real-time support for your TikTok violation appeals and recover
            your account with our experts.
          </motion.p>

          <ul className="etc-feature-list">
            {features.map((f, i) => (
              <motion.li key={f.title} className="etc-feature" {...enter(0.22 + i * 0.06, 12)}>
                <span className="etc-feature-icon">{f.icon}</span>
                <div className="etc-feature-text">
                  <strong>{f.title}</strong>
                  <span>{f.desc}</span>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>

        {/* RIGHT — action card */}
        <section className="etc-right">
          <motion.div className="etc-card" {...enter(0.18, 18)}>
            <div className="etc-card-glow" aria-hidden="true" />
            <div className="etc-card-shine" aria-hidden="true" />

            {/* Brand logo orb */}
            <div className="etc-discord-orb">
              <span className="etc-discord-orb-pulse" aria-hidden="true" />
              <span className="etc-discord-orb-ring" aria-hidden="true" />
              <span className="etc-discord-orb-glow" aria-hidden="true" />
              <img src={logoUrl} alt="Elite Tok Club" className="etc-discord-orb-logo" />
            </div>

            <h2 className="etc-card-title">Continue with Discord</h2>
            <p className="etc-card-sub">Join our secure server to access your recovery portal</p>

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="etc-btn"
              aria-label="Continue with Discord"
            >
              <span className="etc-btn-shine" aria-hidden="true" />
              {loading ? (
                <span className="etc-spinner" aria-label="Redirecting" />
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span>Continue with Discord</span>
                  <svg className="etc-btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>

            <ul className="etc-card-chips">
              {cardChips.map((c) => (
                <li key={c.title}>
                  <span className="etc-chip-icon">{c.icon}</span>
                  <div className="etc-chip-text">
                    <strong>{c.title}</strong>
                    <span>{c.sub}</span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div className="etc-notice" {...enter(0.36, 12)}>
            <span className="etc-notice-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 15 9l7 .8-5.3 4.7L18.2 22 12 18l-6.2 4 1.5-7.5L2 9.8 9 9z" />
              </svg>
            </span>
            <p>
              By continuing, you'll be redirected to Discord to verify your
              membership.
            </p>
          </motion.div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <motion.footer className="etc-footer" {...enter(0.45, 6)}>
        <span className="etc-status">
          <span className="etc-status-dot" />
          Portal online
        </span>
        <span className="etc-foot-link">Terms</span>
        <span className="etc-foot-link">Privacy</span>
      </motion.footer>
    </div>
  );
}

const styles = `
  .etc-root {
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    background: #07070F;
    color: #fff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 24px 28px 80px;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    display: flex;
    flex-direction: column;
  }
  .etc-root *, .etc-root *::before, .etc-root *::after { box-sizing: border-box; }

  /* ============ BACKGROUND ============ */
  .etc-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .etc-aurora { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
  .etc-aurora-a {
    width: 760px; height: 760px;
    background: radial-gradient(circle, rgba(124,77,255,0.38), transparent 65%);
    top: -260px; left: -180px;
    animation: etcDriftA 22s ease-in-out infinite alternate;
  }
  .etc-aurora-b {
    width: 620px; height: 620px;
    background: radial-gradient(circle, rgba(88,101,242,0.30), transparent 65%);
    top: 20%; right: -200px;
    animation: etcDriftB 26s ease-in-out infinite alternate;
  }
  .etc-aurora-c {
    width: 520px; height: 520px;
    background: radial-gradient(circle, rgba(254,44,85,0.14), transparent 65%);
    bottom: -180px; left: 30%;
    animation: etcDriftC 30s ease-in-out infinite alternate;
  }
  @keyframes etcDriftA { from { transform: translate3d(0,-20px,0);} to { transform: translate3d(40px,30px,0);} }
  @keyframes etcDriftB { from { transform: translate3d(0,0,0);} to { transform: translate3d(-30px,-40px,0);} }
  @keyframes etcDriftC { from { transform: translate3d(0,0,0);} to { transform: translate3d(20px,-20px,0);} }

  /* tiny twinkling stars */
  .etc-stars {
    position: absolute; inset: 0;
    background-image:
      radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.7), transparent 50%),
      radial-gradient(1px 1px at 25% 60%, rgba(255,255,255,0.55), transparent 50%),
      radial-gradient(1.2px 1.2px at 38% 28%, rgba(255,255,255,0.6), transparent 50%),
      radial-gradient(1px 1px at 55% 75%, rgba(255,255,255,0.45), transparent 50%),
      radial-gradient(1px 1px at 68% 12%, rgba(255,255,255,0.65), transparent 50%),
      radial-gradient(1.4px 1.4px at 78% 45%, rgba(255,255,255,0.55), transparent 50%),
      radial-gradient(1px 1px at 88% 70%, rgba(255,255,255,0.5), transparent 50%),
      radial-gradient(1px 1px at 8% 82%, rgba(255,255,255,0.4), transparent 50%),
      radial-gradient(1.2px 1.2px at 45% 8%, rgba(255,255,255,0.6), transparent 50%),
      radial-gradient(1px 1px at 62% 38%, rgba(255,255,255,0.45), transparent 50%),
      radial-gradient(1px 1px at 92% 22%, rgba(255,255,255,0.5), transparent 50%),
      radial-gradient(1px 1px at 18% 48%, rgba(255,255,255,0.45), transparent 50%);
    opacity: 0.85;
    animation: etcTwinkle 4s ease-in-out infinite alternate;
  }
  @keyframes etcTwinkle { from { opacity: 0.55;} to { opacity: 0.95;} }

  /* mountain silhouette */
  .etc-mountains {
    position: absolute; left: 0; right: 0; bottom: 0; height: 38%;
    background:
      linear-gradient(180deg, transparent 0%, rgba(7,7,15,0.6) 50%, #07070F 100%),
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320' preserveAspectRatio='none'><path fill='%23120c2a' d='M0 240 L120 200 L240 230 L360 170 L480 215 L600 160 L720 220 L860 180 L990 230 L1120 175 L1260 215 L1440 195 L1440 320 L0 320 Z'/><path fill='%231a0f3a' opacity='0.7' d='M0 270 L150 245 L300 265 L450 220 L600 250 L750 215 L900 255 L1050 230 L1200 265 L1350 240 L1440 255 L1440 320 L0 320 Z'/></svg>");
    background-size: cover;
    background-position: center bottom;
    background-repeat: no-repeat;
    opacity: 0.85;
  }

  /* portal under everything center-bottom */
  .etc-portal {
    position: absolute;
    left: 50%;
    bottom: 4%;
    width: 520px; height: 260px;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .etc-portal-ring {
    position: absolute;
    left: 50%; bottom: 0;
    border-radius: 50%;
    border: 1px solid rgba(155,108,255,0.55);
    transform: translateX(-50%);
    box-shadow:
      0 0 24px rgba(155,108,255,0.45) inset,
      0 0 36px rgba(155,108,255,0.35);
  }
  .etc-portal-ring-1 { width: 520px; height: 90px; border-color: rgba(155,108,255,0.35); animation: etcPortal 3.6s ease-in-out infinite; }
  .etc-portal-ring-2 { width: 380px; height: 70px; border-color: rgba(155,108,255,0.55); animation: etcPortal 3.6s ease-in-out -1.2s infinite; }
  .etc-portal-ring-3 { width: 250px; height: 50px; border-color: rgba(180,140,255,0.75); animation: etcPortal 3.6s ease-in-out -2.4s infinite; }
  .etc-portal-core {
    position: absolute;
    left: 50%; bottom: -10px;
    width: 200px; height: 60px;
    border-radius: 50%;
    transform: translateX(-50%);
    background: radial-gradient(ellipse at center, rgba(180,140,255,0.85), rgba(124,77,255,0.4) 40%, transparent 70%);
    filter: blur(14px);
    animation: etcPortalCore 3s ease-in-out infinite alternate;
  }
  @keyframes etcPortal {
    0%   { opacity: 0.4; transform: translateX(-50%) scale(0.92); }
    50%  { opacity: 1;   transform: translateX(-50%) scale(1.03); }
    100% { opacity: 0.4; transform: translateX(-50%) scale(0.92); }
  }
  @keyframes etcPortalCore {
    from { opacity: 0.7; }
    to   { opacity: 1; }
  }

  .etc-vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 100%);
  }

  /* ============ HEADER ============ */
  .etc-header {
    position: relative; z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px 0;
    margin-bottom: 56px;
  }
  .etc-brand { display: flex; align-items: center; gap: 12px; }
  .etc-brand-logo-wrap {
    width: 44px; height: 44px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.12);
    background: #0c0c14;
    display: grid; place-items: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .etc-brand-logo {
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .etc-brand-text {
    display: flex; flex-direction: column;
    line-height: 1.05;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 1.4px;
    color: #fff;
  }
  .etc-brand-text span:last-child { color: rgba(255,255,255,0.5); font-weight: 700; }

  .etc-header-status {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 8px 14px 8px 12px;
    border-radius: 100px;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.25);
    color: rgba(255,255,255,0.85);
    font-size: 12.5px; font-weight: 500;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  /* ============ MAIN ============ */
  .etc-main {
    position: relative; z-index: 2;
    flex: 1;
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: center;
  }

  /* ============ LEFT ============ */
  .etc-left { max-width: 520px; }
  .etc-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px 6px 10px;
    border-radius: 100px;
    background: rgba(124,77,255,0.12);
    border: 1px solid rgba(155,108,255,0.3);
    color: #cab8ff;
    font-size: 12px; font-weight: 500;
    margin-bottom: 22px;
  }

  .etc-headline {
    margin: 0 0 16px;
    font-size: 64px;
    line-height: 1.02;
    font-weight: 700;
    letter-spacing: -2px;
  }
  .etc-grad {
    background: linear-gradient(135deg, #b88dff 0%, #7c4dff 50%, #5865f2 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .etc-subtext {
    margin: 0 0 32px;
    font-size: 16px;
    color: rgba(255,255,255,0.55);
    line-height: 1.6;
    max-width: 460px;
  }

  .etc-feature-list {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 16px;
  }
  .etc-feature {
    display: flex; align-items: flex-start; gap: 14px;
  }
  .etc-feature-icon {
    width: 40px; height: 40px;
    border-radius: 10px;
    display: grid; place-items: center;
    background: rgba(124,77,255,0.14);
    border: 1px solid rgba(155,108,255,0.28);
    color: #b88dff;
    flex-shrink: 0;
  }
  .etc-feature-icon svg { width: 18px; height: 18px; }
  .etc-feature-text { display: flex; flex-direction: column; gap: 2px; }
  .etc-feature-text strong { font-size: 14.5px; font-weight: 600; color: #fff; }
  .etc-feature-text span { font-size: 13px; color: rgba(255,255,255,0.5); }

  /* ============ RIGHT — CARD ============ */
  .etc-right { display: flex; flex-direction: column; align-items: center; gap: 18px; }

  .etc-card {
    position: relative;
    width: 100%;
    max-width: 460px;
    padding: 36px 32px 28px;
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(28,20,55,0.85), rgba(18,12,38,0.85));
    border: 1px solid rgba(155,108,255,0.18);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow:
      0 30px 80px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 1px 0 rgba(255,255,255,0.06) inset;
    overflow: hidden;
    text-align: center;
  }
  .etc-card-glow {
    position: absolute;
    top: -120px; left: 50%;
    transform: translateX(-50%);
    width: 380px; height: 240px;
    background: radial-gradient(ellipse at center, rgba(155,108,255,0.45), transparent 65%);
    filter: blur(40px);
    pointer-events: none;
  }
  .etc-card-shine {
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
  }

  .etc-discord-orb {
    position: relative;
    width: 96px; height: 96px;
    margin: 4px auto 22px;
    border-radius: 28px;
    background:
      linear-gradient(160deg, rgba(155,108,255,0.45), rgba(88,101,242,0.35) 60%, rgba(58,68,196,0.25));
    padding: 4px;
    display: grid; place-items: center;
    box-shadow:
      0 0 50px rgba(124,77,255,0.6),
      0 14px 36px rgba(0,0,0,0.6),
      0 0 0 1px rgba(155,108,255,0.4) inset;
  }
  .etc-discord-orb-logo {
    position: relative; z-index: 2;
    width: 100%; height: 100%;
    object-fit: cover;
    border-radius: 22px;
    background: #0a0a14;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .etc-discord-orb-glow {
    position: absolute; inset: -22px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(155,108,255,0.45), transparent 65%);
    filter: blur(14px);
    z-index: 0;
  }
  .etc-discord-orb-pulse {
    position: absolute; inset: -10px;
    border-radius: 32px;
    border: 1.5px solid rgba(155,108,255,0.5);
    animation: etcRingPulse 2.4s ease-out infinite;
    z-index: 1;
  }
  .etc-discord-orb-ring {
    position: absolute; inset: -20px;
    border-radius: 36px;
    border: 1px solid rgba(155,108,255,0.3);
    animation: etcRingPulse 2.4s ease-out -1.2s infinite;
    z-index: 1;
  }
  @keyframes etcRingPulse {
    0%   { opacity: 0.8; transform: scale(0.95); }
    100% { opacity: 0;   transform: scale(1.25); }
  }

  .etc-card-title {
    margin: 0 0 8px;
    font-size: 22px; font-weight: 700;
    letter-spacing: -0.4px;
  }
  .etc-card-sub {
    margin: 0 0 24px;
    font-size: 14px;
    color: rgba(255,255,255,0.55);
    line-height: 1.55;
  }

  .etc-btn {
    position: relative;
    width: 100%;
    height: 54px;
    border: none;
    border-radius: 14px;
    color: #fff;
    font-family: inherit; font-size: 15px; font-weight: 600;
    background: linear-gradient(135deg, #8b6fff 0%, #6a5cff 50%, #5865f2 100%);
    display: flex; align-items: center; justify-content: center; gap: 10px;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 14px 40px rgba(124,77,255,0.55),
      0 0 0 1px rgba(255,255,255,0.1) inset,
      0 1px 0 rgba(255,255,255,0.22) inset;
    transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
  }
  .etc-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.06);
    box-shadow:
      0 20px 56px rgba(124,77,255,0.7),
      0 0 0 1px rgba(255,255,255,0.16) inset,
      0 1px 0 rgba(255,255,255,0.28) inset;
  }
  .etc-btn:hover:not(:disabled) .etc-btn-arrow { transform: translateX(4px); }
  .etc-btn:active:not(:disabled) { transform: translateY(0) scale(0.99); }
  .etc-btn:disabled { cursor: progress; opacity: 0.92; }
  .etc-btn-arrow { transition: transform 220ms ease; }

  .etc-btn-shine {
    position: absolute;
    top: 0; bottom: 0;
    width: 45%;
    left: -55%;
    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.22), transparent);
    transform: skewX(-18deg);
    animation: etcSweep 4.4s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes etcSweep { 0% { left: -55%; } 55% { left: 115%; } 100% { left: 115%; } }

  .etc-spinner {
    width: 22px; height: 22px;
    border: 2.5px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: etcSpin 0.7s linear infinite;
  }
  @keyframes etcSpin { to { transform: rotate(360deg); } }

  .etc-card-chips {
    list-style: none; margin: 24px 0 0; padding: 20px 0 0;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    text-align: center;
  }
  .etc-card-chips li {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .etc-chip-icon {
    width: 32px; height: 32px;
    border-radius: 9px;
    display: grid; place-items: center;
    background: rgba(124,77,255,0.14);
    border: 1px solid rgba(155,108,255,0.25);
    color: #b88dff;
  }
  .etc-chip-icon svg { width: 14px; height: 14px; }
  .etc-chip-text { display: flex; flex-direction: column; gap: 1px; }
  .etc-chip-text strong { font-size: 11.5px; font-weight: 600; color: #fff; }
  .etc-chip-text span { font-size: 10.5px; color: rgba(255,255,255,0.45); line-height: 1.3; }

  /* notice */
  .etc-notice {
    width: 100%;
    max-width: 460px;
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .etc-notice-icon {
    width: 32px; height: 32px;
    border-radius: 9px;
    flex-shrink: 0;
    display: grid; place-items: center;
    background: rgba(124,77,255,0.14);
    border: 1px solid rgba(155,108,255,0.25);
    color: #b88dff;
  }
  .etc-notice-icon svg { width: 15px; height: 15px; }
  .etc-notice p { margin: 0; font-size: 12.5px; line-height: 1.45; color: rgba(255,255,255,0.65); }

  /* ============ FOOTER ============ */
  .etc-footer {
    position: relative; z-index: 3;
    margin-top: 48px;
    display: flex; align-items: center; justify-content: center; gap: 22px;
    font-size: 12.5px;
    color: rgba(255,255,255,0.5);
  }
  .etc-status { display: inline-flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.7); }
  .etc-status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 10px rgba(34,197,94,0.7);
    animation: etcPulse 1.8s ease-out infinite;
  }
  @keyframes etcPulse {
    0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
    70%  { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }
  .etc-foot-link { cursor: pointer; transition: color 180ms ease; }
  .etc-foot-link:hover { color: rgba(255,255,255,0.9); }

  /* ============ TABLET ============ */
  @media (max-width: 960px) {
    .etc-root { padding: 20px 22px 64px; }
    .etc-header { margin-bottom: 36px; }
    .etc-main {
      grid-template-columns: 1fr;
      gap: 36px;
      max-width: 520px;
    }
    .etc-left { text-align: center; max-width: 100%; }
    .etc-eyebrow { margin-left: auto; margin-right: auto; }
    .etc-feature-list { max-width: 380px; margin: 0 auto; }
    .etc-feature { text-align: left; }
    .etc-headline { font-size: 52px; letter-spacing: -1.4px; }
    .etc-subtext { margin-left: auto; margin-right: auto; }
    .etc-portal { width: 380px; height: 200px; }
    .etc-portal-ring-1 { width: 380px; height: 70px; }
    .etc-portal-ring-2 { width: 280px; height: 55px; }
    .etc-portal-ring-3 { width: 180px; height: 40px; }
  }

  /* ============ MOBILE ============ */
  @media (max-width: 640px) {
    .etc-root { padding: 16px 16px 40px; }
    .etc-header { margin-bottom: 24px; padding: 4px 0 0; }
    .etc-brand { gap: 10px; }
    .etc-brand-logo-wrap { width: 36px; height: 36px; border-radius: 10px; }
    .etc-brand-text { font-size: 11px; letter-spacing: 1px; }
    .etc-header-status {
      padding: 6px 11px 6px 9px;
      font-size: 11.5px;
      gap: 7px;
    }

    .etc-main { gap: 24px; max-width: 440px; }
    .etc-left { padding: 0 4px; }
    .etc-eyebrow { font-size: 11.5px; padding: 5px 11px 5px 9px; margin-bottom: 16px; }
    .etc-headline { font-size: 38px; letter-spacing: -1px; line-height: 1.05; margin-bottom: 14px; }
    .etc-subtext { font-size: 14px; margin-bottom: 22px; line-height: 1.5; }

    .etc-feature-list { gap: 14px; max-width: 100%; }
    .etc-feature { gap: 12px; }
    .etc-feature-icon { width: 36px; height: 36px; border-radius: 9px; }
    .etc-feature-icon svg { width: 16px; height: 16px; }
    .etc-feature-text strong { font-size: 14px; }
    .etc-feature-text span { font-size: 12.5px; }

    .etc-card { padding: 26px 20px 20px; border-radius: 22px; }
    .etc-discord-orb {
      width: 78px; height: 78px;
      border-radius: 22px;
      margin-bottom: 18px;
      padding: 3px;
    }
    .etc-discord-orb-logo { border-radius: 18px; }
    .etc-discord-orb-pulse { inset: -8px; border-radius: 26px; }
    .etc-discord-orb-ring { inset: -16px; border-radius: 30px; }
    .etc-card-title { font-size: 19px; margin-bottom: 6px; }
    .etc-card-sub { font-size: 13.5px; margin-bottom: 20px; line-height: 1.5; }
    .etc-btn { height: 52px; font-size: 14.5px; gap: 8px; }
    .etc-btn-arrow { width: 16px; height: 16px; }

    /* Stack chips vertically on mobile with proper alignment */
    .etc-card-chips {
      grid-template-columns: 1fr;
      gap: 14px;
      margin-top: 22px;
      padding-top: 18px;
      text-align: left;
    }
    .etc-card-chips li {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .etc-chip-icon { width: 34px; height: 34px; border-radius: 10px; }
    .etc-chip-icon svg { width: 15px; height: 15px; }
    .etc-chip-text strong { font-size: 13px; }
    .etc-chip-text span { font-size: 11.5px; }

    .etc-notice { padding: 12px 14px; gap: 10px; border-radius: 12px; }
    .etc-notice-icon { width: 30px; height: 30px; border-radius: 9px; }
    .etc-notice-icon svg { width: 14px; height: 14px; }
    .etc-notice p { font-size: 12px; line-height: 1.45; }

    .etc-footer { margin-top: 28px; gap: 14px; font-size: 11.5px; }

    .etc-aurora-a { width: 420px; height: 420px; top: -140px; left: -140px; }
    .etc-aurora-b { width: 360px; height: 360px; right: -140px; }
    .etc-aurora-c { width: 280px; height: 280px; }
    .etc-portal { display: none; }
    .etc-mountains { height: 26%; opacity: 0.6; }
  }

  @media (max-width: 400px) {
    .etc-headline { font-size: 32px; letter-spacing: -0.7px; }
    .etc-card { padding: 22px 18px 18px; }
    .etc-discord-orb { width: 72px; height: 72px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .etc-aurora, .etc-btn-shine, .etc-status-dot,
    .etc-portal-ring, .etc-portal-core, .etc-stars,
    .etc-discord-orb-pulse, .etc-discord-orb-ring {
      animation: none !important;
    }
  }
`;
