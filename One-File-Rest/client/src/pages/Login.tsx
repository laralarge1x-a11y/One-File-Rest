import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import logoUrl from '@assets/logo_1777749351893.jpeg';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // ---- Mouse-follow spotlight on the card (card-local + RAF throttled) ----
  useEffect(() => {
    if (reduceMotion) return;
    const el = cardRef.current;
    if (!el) return;
    let frame = 0;
    let nextX = 50;
    let nextY = -20;
    const flush = () => {
      frame = 0;
      el.style.setProperty('--mx', `${nextX}%`);
      el.style.setProperty('--my', `${nextY}%`);
    };
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      nextX = ((e.clientX - rect.left) / rect.width) * 100;
      nextY = ((e.clientY - rect.top) / rect.height) * 100;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const onLeave = () => {
      nextX = 50;
      nextY = -20;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    onLeave();
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  // ---- Floating background particles ----
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        delay: -Math.random() * 18,
        dur: 14 + Math.random() * 14,
        opacity: 0.25 + Math.random() * 0.45,
      })),
    []
  );

  const handleLogin = () => {
    if (loading) return;
    setLoading(true);
    window.location.href = '/auth/discord';
  };

  // ---- Honest value props (no fabricated metrics) ----
  const valueProps = [
    { k: 'Response', v: '< 48h' },
    { k: 'Channel', v: 'Discord' },
    { k: 'Updates', v: 'Real-time' },
    { k: 'Support', v: 'Concierge' },
  ];

  // Helper to gate Framer Motion when reduced-motion is on
  const enter = (delay: number) =>
    reduceMotion
      ? { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.45 } };

  return (
    <div className="etc-root">
      <style>{styles}</style>

      {/* ----------- BACKGROUND ----------- */}
      <div className="etc-bg">
        <div className="etc-orb etc-orb-purple" />
        <div className="etc-orb etc-orb-blue" />
        <div className="etc-orb etc-orb-pink" />
        <div className="etc-orb etc-orb-cyan" />
        <div className="etc-grid" />
        <div className="etc-vignette" />
        <div className="etc-particles">
          {particles.map((p) => (
            <span
              key={p.id}
              className="etc-particle"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
              }}
            />
          ))}
        </div>
        <div className="etc-grain" aria-hidden="true" />
      </div>

      {/* ----------- CARD ----------- */}
      <motion.div
        ref={cardRef}
        className="etc-card"
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* rotating conic border */}
        <div className="etc-card-border" aria-hidden="true" />
        {/* mouse spotlight */}
        <div className="etc-card-spot" aria-hidden="true" />
        {/* top edge highlight */}
        <div className="etc-card-shine" aria-hidden="true" />

        <div className="etc-card-inner">
          {/* member badge */}
          <motion.div className="etc-anim etc-live" {...enter(0.05)}>
            <span className="etc-live-dot" />
            <span>Members-only · Concierge support</span>
          </motion.div>

          {/* logo with glow ring */}
          <motion.div
            className="etc-logo-wrap"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.1, duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="etc-logo-glow" />
            <img src={logoUrl} alt="Elite Tok Club" className="etc-logo" />
          </motion.div>

          {/* headline */}
          <motion.h1 className="etc-headline" {...enter(0.18)}>
            Welcome back to <span className="etc-grad">Elite Tok</span>
          </motion.h1>
          <motion.p className="etc-subtext" {...enter(0.22)}>
            Sign in to manage your TikTok violation appeals, chat with your
            recovery specialist, and track every case in real time.
          </motion.p>

          {/* Discord button */}
          <motion.button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="etc-discord-btn"
            {...enter(0.3)}
            whileHover={loading || reduceMotion ? undefined : { y: -1 }}
            whileTap={loading || reduceMotion ? undefined : { scale: 0.985 }}
            aria-label="Continue with Discord"
          >
            <span className="etc-discord-glow" aria-hidden="true" />
            <span className="etc-discord-shine" aria-hidden="true" />
            {loading ? (
              <span className="etc-spinner" aria-label="Redirecting to Discord" />
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                <span>Continue with Discord</span>
              </>
            )}
          </motion.button>

          <motion.div className="etc-helper" {...enter(0.36)}>
            You'll be redirected to Discord to authorize
          </motion.div>

          {/* Divider */}
          <motion.div className="etc-divider" {...enter(0.4)}>
            <span>What you get</span>
          </motion.div>

          {/* Honest value-prop strip */}
          <motion.div className="etc-stats" {...enter(0.46)}>
            {valueProps.map((s) => (
              <div key={s.k} className="etc-stat">
                <div className="etc-stat-v">{s.v}</div>
                <div className="etc-stat-k">{s.k}</div>
              </div>
            ))}
          </motion.div>

          {/* Feature pills */}
          <motion.div className="etc-pills" {...enter(0.52)}>
            <span className="etc-pill">⚡ Fast turnaround</span>
            <span className="etc-pill">✍️ Expert appeal writers</span>
            <span className="etc-pill">🔔 Live case updates</span>
          </motion.div>

          {/* Footer status + legal */}
          <motion.div className="etc-footer" {...enter(0.6)}>
            <div className="etc-status">
              <span className="etc-status-dot" />
              Portal online
            </div>
            <div className="etc-legal">
              By continuing you agree to our Terms &amp; Privacy Policy
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

const styles = `
  .etc-root {
    min-height: 100vh;
    width: 100%;
    background: #07070F;
    color: #fff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }

  /* ============ BACKGROUND ============ */
  .etc-bg {
    position: absolute; inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .etc-grid {
    position: absolute; inset: 0;
    background-image:
      radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.6;
    mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, #000 30%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, #000 30%, transparent 80%);
  }
  .etc-vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 60% 50% at 50% 50%, transparent 0%, rgba(0,0,0,0.55) 100%);
  }
  .etc-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(110px);
    will-change: transform;
  }
  .etc-orb-purple {
    width: 520px; height: 520px;
    background: rgba(88,101,242,0.28);
    top: -140px; left: -140px;
    animation: etcFloat 11s ease-in-out infinite alternate;
  }
  .etc-orb-blue {
    width: 560px; height: 560px;
    background: rgba(88,101,242,0.16);
    bottom: -180px; right: -160px;
    animation: etcFloat 13s -3s ease-in-out infinite alternate;
  }
  .etc-orb-pink {
    width: 320px; height: 320px;
    background: rgba(254,44,85,0.10);  /* TikTok pink */
    top: 60%; left: 8%;
    animation: etcFloat 16s -6s ease-in-out infinite alternate-reverse;
  }
  .etc-orb-cyan {
    width: 280px; height: 280px;
    background: rgba(37,244,238,0.07);  /* TikTok cyan */
    top: 8%; right: 10%;
    animation: etcFloat 14s -2s ease-in-out infinite alternate;
  }
  @keyframes etcFloat {
    from { transform: translate3d(0,-20px,0); }
    to   { transform: translate3d(0, 20px,0); }
  }

  .etc-particles {
    position: absolute; inset: 0;
    overflow: hidden;
  }
  .etc-particle {
    position: absolute;
    bottom: -10px;
    background: #fff;
    border-radius: 50%;
    animation-name: etcRise;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    box-shadow: 0 0 6px rgba(255,255,255,0.5);
  }
  @keyframes etcRise {
    0%   { transform: translateY(0)    translateX(0); opacity: 0; }
    8%   { opacity: 1; }
    100% { transform: translateY(-110vh) translateX(20px); opacity: 0; }
  }

  .etc-grain {
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    opacity: 0.5;
    mix-blend-mode: overlay;
  }

  /* ============ CARD ============ */
  .etc-card {
    position: relative;
    z-index: 2;
    width: 440px;
    max-width: calc(100% - 32px);
    border-radius: 26px;
    padding: 0;
    isolation: isolate;
    --mx: 50%;
    --my: -20%;
  }

  .etc-card-inner {
    position: relative;
    z-index: 2;
    padding: 44px 40px 32px;
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(20,20,32,0.85), rgba(12,12,22,0.9));
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    box-shadow:
      0 30px 90px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.04) inset;
    text-align: center;
  }

  /* rotating conic border */
  .etc-card-border {
    position: absolute;
    inset: -1px;
    border-radius: 26px;
    padding: 1px;
    background: conic-gradient(
      from 0deg,
      rgba(88,101,242,0.0) 0deg,
      rgba(88,101,242,0.6) 60deg,
      rgba(254,44,85,0.45) 140deg,
      rgba(37,244,238,0.4) 220deg,
      rgba(88,101,242,0.55) 300deg,
      rgba(88,101,242,0.0) 360deg
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    animation: etcSpin 9s linear infinite;
    z-index: 1;
    opacity: 0.85;
    pointer-events: none;
  }
  @keyframes etcSpin { to { transform: rotate(360deg); } }

  /* mouse spotlight inside card */
  .etc-card-spot {
    position: absolute; inset: 0;
    border-radius: 24px;
    background: radial-gradient(
      400px circle at var(--mx) var(--my),
      rgba(88,101,242,0.18),
      transparent 60%
    );
    z-index: 3;
    pointer-events: none;
    transition: background-position 0.1s linear;
    mix-blend-mode: screen;
  }

  /* top inner edge highlight */
  .etc-card-shine {
    position: absolute;
    top: 0; left: 12%; right: 12%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
    z-index: 4;
    pointer-events: none;
    border-radius: 1px;
  }

  /* ============ LIVE BADGE ============ */
  .etc-live {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px 6px 10px;
    border-radius: 100px;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.25);
    color: rgba(220,255,232,0.92);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.1px;
    margin-bottom: 22px;
  }
  .etc-live strong { color: #fff; font-weight: 700; }
  .etc-live-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 0 rgba(34,197,94,0.6);
    animation: etcPulse 1.6s ease-out infinite;
  }
  @keyframes etcPulse {
    0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
    70%  { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }

  /* ============ LOGO ============ */
  .etc-logo-wrap {
    position: relative;
    width: 76px;
    height: 76px;
    margin: 0 auto;
    display: grid;
    place-items: center;
  }
  .etc-logo-glow {
    position: absolute; inset: -14px;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgba(88,101,242,0.55), transparent 70%);
    filter: blur(8px);
    animation: etcGlow 3.4s ease-in-out infinite alternate;
  }
  @keyframes etcGlow {
    from { opacity: 0.55; transform: scale(0.96); }
    to   { opacity: 1;    transform: scale(1.06); }
  }
  .etc-logo {
    position: relative;
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    background: #0c0c14;
  }

  /* ============ HEADLINE ============ */
  .etc-headline {
    margin: 22px 0 0;
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.4px;
    line-height: 1.18;
  }
  .etc-grad {
    background: linear-gradient(95deg, #fe2c55 0%, #a8a4ff 45%, #25f4ee 100%);
    -webkit-background-clip: text;
            background-clip: text;
    color: transparent;
    background-size: 200% 100%;
    animation: etcGradShift 8s ease-in-out infinite alternate;
  }
  @keyframes etcGradShift {
    from { background-position: 0% 50%; }
    to   { background-position: 100% 50%; }
  }

  .etc-subtext {
    margin: 8px auto 0;
    max-width: 320px;
    font-size: 14px;
    color: rgba(255,255,255,0.55);
    line-height: 1.55;
  }

  /* ============ DISCORD BUTTON ============ */
  .etc-discord-btn {
    position: relative;
    margin-top: 26px;
    width: 100%;
    height: 54px;
    background: linear-gradient(180deg, #5b69ff 0%, #4954e0 100%);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 14px;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 8px 30px rgba(88,101,242,0.45),
      0 0 0 1px rgba(255,255,255,0.05) inset,
      0 1px 0 rgba(255,255,255,0.18) inset;
    transition: box-shadow 200ms ease, background 200ms ease;
  }
  .etc-discord-btn:hover:not(:disabled) {
    background: linear-gradient(180deg, #6a78ff 0%, #4f5ce8 100%);
    box-shadow:
      0 12px 40px rgba(88,101,242,0.65),
      0 0 0 1px rgba(255,255,255,0.08) inset,
      0 1px 0 rgba(255,255,255,0.22) inset;
  }
  .etc-discord-btn:disabled { cursor: progress; opacity: 0.92; }

  .etc-discord-glow {
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    background: radial-gradient(60% 80% at 50% 110%, rgba(255,255,255,0.45), transparent 70%);
    pointer-events: none;
    opacity: 0.6;
  }
  .etc-discord-shine {
    position: absolute;
    top: 0; bottom: 0;
    width: 50%;
    left: -60%;
    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.28), transparent);
    transform: skewX(-20deg);
    animation: etcSweep 3.6s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes etcSweep {
    0%   { left: -60%; }
    60%  { left: 120%; }
    100% { left: 120%; }
  }

  .etc-spinner {
    width: 22px; height: 22px;
    border: 2.5px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: etcSpin 0.7s linear infinite;
    position: relative;
    z-index: 2;
  }

  .etc-helper {
    margin-top: 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.55);
  }

  /* ============ DIVIDER ============ */
  .etc-divider {
    position: relative;
    margin: 26px 0 18px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
  }
  .etc-divider span {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background:
      linear-gradient(180deg, rgba(20,20,32,1), rgba(12,12,22,1));
    padding: 0 12px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: rgba(255,255,255,0.55);
    white-space: nowrap;
  }

  /* ============ STATS ============ */
  .etc-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 22px;
  }
  .etc-stat {
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 10px 6px;
    text-align: center;
  }
  .etc-stat-v {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.2px;
    line-height: 1.1;
  }
  .etc-stat-k {
    margin-top: 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.6);
  }

  /* ============ PILLS ============ */
  .etc-pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 22px;
  }
  .etc-pill {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 100px;
    padding: 7px 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.65);
    white-space: nowrap;
    line-height: 1;
  }

  /* ============ FOOTER ============ */
  .etc-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding-top: 18px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .etc-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: rgba(255,255,255,0.65);
    letter-spacing: 0.2px;
  }
  .etc-status-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34,197,94,0.8);
    animation: etcPulse 1.8s ease-out infinite;
  }
  .etc-legal {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
  }

  /* ============ MOBILE ============ */
  @media (max-width: 480px) {
    .etc-root { padding: 20px 14px; }
    .etc-card { width: 100%; border-radius: 22px; }
    .etc-card-inner { padding: 36px 26px 26px; border-radius: 20px; }
    .etc-card-border { border-radius: 22px; }
    .etc-headline { font-size: 22px; }
    .etc-subtext { font-size: 13px; }
    .etc-discord-btn { height: 52px; min-height: 52px; }
    .etc-stats { grid-template-columns: repeat(2, 1fr); }
    .etc-orb-purple { width: 320px; height: 320px; }
    .etc-orb-blue   { width: 360px; height: 360px; }
    .etc-orb-pink   { width: 220px; height: 220px; }
    .etc-orb-cyan   { width: 200px; height: 200px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .etc-card-border, .etc-discord-shine, .etc-particle,
    .etc-orb, .etc-grad, .etc-logo-glow, .etc-live-dot, .etc-status-dot {
      animation: none !important;
    }
  }
`;
