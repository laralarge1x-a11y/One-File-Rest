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

  const enter = (delay: number) =>
    reduceMotion
      ? { initial: false, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="etc-root">
      <style>{styles}</style>

      {/* Background — single soft aurora + faint grid, nothing else */}
      <div className="etc-bg" aria-hidden="true">
        <div className="etc-aurora etc-aurora-a" />
        <div className="etc-aurora etc-aurora-b" />
        <div className="etc-aurora etc-aurora-c" />
        <div className="etc-grid" />
        <div className="etc-vignette" />
      </div>

      <main className="etc-main">
        {/* Logo */}
        <motion.div className="etc-brand" {...enter(0.0)}>
          <div className="etc-logo-halo" aria-hidden="true" />
          <img src={logoUrl} alt="Elite Tok Club" className="etc-logo" />
        </motion.div>

        {/* Tiny brand line */}
        <motion.div className="etc-eyebrow" {...enter(0.08)}>
          <span className="etc-eyebrow-dot" />
          Elite Tok Club · Recovery Portal
        </motion.div>

        {/* Headline */}
        <motion.h1 className="etc-headline" {...enter(0.16)}>
          Welcome back
        </motion.h1>

        {/* Subtext */}
        <motion.p className="etc-subtext" {...enter(0.22)}>
          Sign in to manage your TikTok violation appeals and chat with your
          recovery specialist in real time.
        </motion.p>

        {/* Discord button */}
        <motion.button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="etc-btn"
          {...enter(0.3)}
          whileHover={loading || reduceMotion ? undefined : { y: -1 }}
          whileTap={loading || reduceMotion ? undefined : { scale: 0.985 }}
          aria-label="Continue with Discord"
        >
          <span className="etc-btn-shine" aria-hidden="true" />
          {loading ? (
            <span className="etc-spinner" aria-label="Redirecting to Discord" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Continue with Discord</span>
            </>
          )}
        </motion.button>

        {/* Helper micro-text */}
        <motion.p className="etc-helper" {...enter(0.36)}>
          Members-only · You'll be redirected to Discord to authorize
        </motion.p>

        {/* Footer */}
        <motion.footer className="etc-footer" {...enter(0.44)}>
          <span className="etc-status">
            <span className="etc-status-dot" />
            Portal online
          </span>
          <span className="etc-dot-sep">·</span>
          <span>Terms</span>
          <span className="etc-dot-sep">·</span>
          <span>Privacy</span>
        </motion.footer>
      </main>
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
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  /* ============ BACKGROUND ============ */
  .etc-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* Three soft, slow-drifting auroras — calm, premium feel */
  .etc-aurora {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    will-change: transform;
  }
  .etc-aurora-a {
    width: 720px; height: 720px;
    background: radial-gradient(circle, rgba(88,101,242,0.32), transparent 65%);
    top: -260px; left: -200px;
    animation: etcDriftA 18s ease-in-out infinite alternate;
  }
  .etc-aurora-b {
    width: 640px; height: 640px;
    background: radial-gradient(circle, rgba(254,44,85,0.16), transparent 65%);
    bottom: -240px; right: -180px;
    animation: etcDriftB 22s ease-in-out infinite alternate;
  }
  .etc-aurora-c {
    width: 480px; height: 480px;
    background: radial-gradient(circle, rgba(37,244,238,0.10), transparent 65%);
    top: 55%; left: 50%;
    transform: translate(-50%, -50%);
    animation: etcDriftC 26s ease-in-out infinite alternate;
  }
  @keyframes etcDriftA {
    from { transform: translate3d(0, -20px, 0); }
    to   { transform: translate3d(40px, 30px, 0); }
  }
  @keyframes etcDriftB {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-30px, -40px, 0); }
  }
  @keyframes etcDriftC {
    from { transform: translate(-50%, calc(-50% - 30px)); }
    to   { transform: translate(calc(-50% + 30px), calc(-50% + 30px)); }
  }

  .etc-grid {
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse 70% 50% at 50% 50%, #000 30%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse 70% 50% at 50% 50%, #000 30%, transparent 80%);
    opacity: 0.7;
  }

  .etc-vignette {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%);
  }

  /* ============ MAIN ============ */
  .etc-main {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 380px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* ============ LOGO ============ */
  .etc-brand {
    position: relative;
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    margin-bottom: 28px;
  }
  .etc-logo-halo {
    position: absolute;
    inset: -22px;
    border-radius: 50%;
    background:
      radial-gradient(closest-side, rgba(88,101,242,0.55), transparent 70%);
    filter: blur(8px);
    animation: etcHalo 4s ease-in-out infinite alternate;
  }
  @keyframes etcHalo {
    from { opacity: 0.55; transform: scale(0.95); }
    to   { opacity: 0.95; transform: scale(1.08); }
  }
  .etc-logo {
    position: relative;
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow:
      0 12px 36px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.04) inset;
    background: #0c0c14;
  }

  /* ============ EYEBROW ============ */
  .etc-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px 5px 10px;
    border-radius: 100px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.1px;
    margin-bottom: 24px;
  }
  .etc-eyebrow-dot {
    width: 6px; height: 6px;
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

  /* ============ HEADLINE ============ */
  .etc-headline {
    margin: 0;
    font-size: 38px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -1px;
    line-height: 1.1;
  }

  .etc-subtext {
    margin: 14px 0 36px;
    max-width: 340px;
    font-size: 15px;
    color: rgba(255,255,255,0.55);
    line-height: 1.55;
  }

  /* ============ DISCORD BUTTON ============ */
  .etc-btn {
    position: relative;
    width: 100%;
    height: 56px;
    background: linear-gradient(180deg, #5b69ff 0%, #4954e0 100%);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 14px;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.1px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 12px 36px rgba(88,101,242,0.45),
      0 0 0 1px rgba(255,255,255,0.06) inset,
      0 1px 0 rgba(255,255,255,0.18) inset;
    transition: box-shadow 220ms ease, background 220ms ease, transform 220ms ease;
  }
  .etc-btn:hover:not(:disabled) {
    background: linear-gradient(180deg, #6a78ff 0%, #4f5ce8 100%);
    box-shadow:
      0 16px 48px rgba(88,101,242,0.6),
      0 0 0 1px rgba(255,255,255,0.1) inset,
      0 1px 0 rgba(255,255,255,0.22) inset;
  }
  .etc-btn:disabled { cursor: progress; opacity: 0.92; }

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
  @keyframes etcSweep {
    0%   { left: -55%; }
    55%  { left: 115%; }
    100% { left: 115%; }
  }

  .etc-spinner {
    width: 22px; height: 22px;
    border: 2.5px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: etcSpin 0.7s linear infinite;
  }
  @keyframes etcSpin { to { transform: rotate(360deg); } }

  /* ============ HELPER + FOOTER ============ */
  .etc-helper {
    margin: 16px 0 0;
    font-size: 12.5px;
    color: rgba(255,255,255,0.42);
  }

  .etc-footer {
    margin-top: 56px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    flex-wrap: wrap;
    justify-content: center;
  }
  .etc-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: rgba(255,255,255,0.65);
  }
  .etc-status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34,197,94,0.7);
    animation: etcPulse 1.8s ease-out infinite;
  }
  .etc-dot-sep { color: rgba(255,255,255,0.2); }

  /* ============ MOBILE ============ */
  @media (max-width: 480px) {
    .etc-root { padding: 24px 20px; }
    .etc-main { max-width: 100%; }
    .etc-brand { margin-bottom: 22px; }
    .etc-eyebrow { margin-bottom: 20px; font-size: 11.5px; }
    .etc-headline { font-size: 32px; letter-spacing: -0.6px; }
    .etc-subtext { font-size: 14px; margin-bottom: 28px; }
    .etc-btn { height: 54px; }
    .etc-footer { margin-top: 42px; }
    .etc-aurora-a { width: 480px; height: 480px; top: -160px; left: -140px; }
    .etc-aurora-b { width: 420px; height: 420px; bottom: -160px; right: -120px; }
    .etc-aurora-c { width: 320px; height: 320px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .etc-aurora, .etc-btn-shine, .etc-eyebrow-dot,
    .etc-status-dot, .etc-logo-halo {
      animation: none !important;
    }
  }
`;
