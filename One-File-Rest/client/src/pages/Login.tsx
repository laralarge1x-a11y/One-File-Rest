import { useState } from 'react';
import logoUrl from '@assets/logo_1777749351893.jpeg';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = '/auth/discord';
  };

  return (
    <div className="etc-login-root">
      <style>{styles}</style>

      {/* Background orbs */}
      <div className="etc-orb etc-orb-1" />
      <div className="etc-orb etc-orb-2" />
      <div className="etc-orb etc-orb-3" />
      <div className="etc-grid" />

      {/* Center card */}
      <div className="etc-card">
        <img src={logoUrl} alt="Elite Tok Club" className="etc-logo etc-anim" style={{ animationDelay: '0s' }} />

        <h1 className="etc-headline etc-anim" style={{ animationDelay: '0.08s' }}>
          Sign in to your Portal
        </h1>
        <p className="etc-subtext etc-anim" style={{ animationDelay: '0.12s' }}>
          Access your TikTok recovery dashboard
        </p>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="etc-discord-btn etc-anim"
          style={{ animationDelay: '0.18s' }}
          aria-label="Continue with Discord"
        >
          {loading ? (
            <span className="etc-spinner" aria-label="Signing in" />
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Continue with Discord</span>
            </>
          )}
        </button>

        <div className="etc-divider etc-anim" style={{ animationDelay: '0.22s' }} />

        <div className="etc-pills etc-anim" style={{ animationDelay: '0.26s' }}>
          <span className="etc-pill">⚡ 48h Response Time</span>
          <span className="etc-pill">✍️ Expert Appeal Writers</span>
          <span className="etc-pill">🔔 Real-time Updates</span>
        </div>

        <div className="etc-bottom etc-anim" style={{ animationDelay: '0.3s' }}>
          <div>Access is by invitation only · Contact us on Discord</div>
          <div>By continuing you agree to our Terms &amp; Privacy Policy</div>
        </div>
      </div>
    </div>
  );
}

const styles = `
  .etc-login-root {
    min-height: 100vh;
    width: 100%;
    background: #07070F;
    color: #fff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 20px;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }

  .etc-grid {
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    opacity: 0.6;
    z-index: 1;
  }

  .etc-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    pointer-events: none;
    z-index: 0;
    animation: etcFloat 10s ease-in-out infinite alternate;
  }
  .etc-orb-1 {
    width: 480px; height: 480px;
    background: rgba(88,101,242,0.20);
    top: -120px; left: -120px;
    animation-delay: 0s;
  }
  .etc-orb-2 {
    width: 520px; height: 520px;
    background: rgba(88,101,242,0.12);
    bottom: -160px; right: -140px;
    animation-delay: -3s;
  }
  .etc-orb-3 {
    width: 320px; height: 320px;
    background: rgba(114,137,218,0.10);
    top: 50%; left: 55%;
    transform: translate(-50%, -50%);
    animation-delay: -6s;
  }

  @keyframes etcFloat {
    from { transform: translateY(-20px); }
    to   { transform: translateY(20px); }
  }
  .etc-orb-3 {
    animation-name: etcFloatCenter;
  }
  @keyframes etcFloatCenter {
    from { transform: translate(-50%, calc(-50% - 20px)); }
    to   { transform: translate(-50%, calc(-50% + 20px)); }
  }

  .etc-card {
    position: relative;
    z-index: 2;
    width: 420px;
    max-width: calc(100% - 40px);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 24px;
    padding: 48px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    text-align: center;
    opacity: 0;
    animation: etcFadeUp 0.4s ease forwards;
    box-sizing: border-box;
  }

  .etc-logo {
    display: block;
    height: 52px;
    width: auto;
    margin: 0 auto;
    object-fit: contain;
    border-radius: 12px;
  }

  .etc-headline {
    margin: 28px 0 0;
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.3px;
    line-height: 1.2;
  }

  .etc-subtext {
    margin: 6px 0 0;
    font-size: 14px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
  }

  .etc-discord-btn {
    margin-top: 32px;
    width: 100%;
    height: 54px;
    background: #5865F2;
    border: none;
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
    box-shadow: 0 4px 20px rgba(88,101,242,0.45);
    transition: background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
  }
  .etc-discord-btn:hover:not(:disabled) {
    background: #4752C4;
    box-shadow: 0 8px 30px rgba(88,101,242,0.6);
    transform: translateY(-1px);
  }
  .etc-discord-btn:active:not(:disabled) {
    transform: scale(0.985) translateY(0);
  }
  .etc-discord-btn:disabled {
    cursor: progress;
    opacity: 0.85;
  }

  .etc-spinner {
    width: 22px; height: 22px;
    border: 2.5px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: etcSpin 0.7s linear infinite;
  }
  @keyframes etcSpin { to { transform: rotate(360deg); } }

  .etc-divider {
    margin-top: 20px;
    height: 1px;
    background: rgba(255,255,255,0.07);
    width: 100%;
  }

  .etc-pills {
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .etc-pill {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 100px;
    padding: 8px 14px;
    font-size: 12px;
    color: rgba(255,255,255,0.6);
    white-space: nowrap;
    line-height: 1;
  }

  .etc-bottom {
    margin-top: 20px;
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    line-height: 1.6;
  }

  /* Stagger entrance */
  .etc-anim {
    opacity: 0;
    animation: etcFadeUp 0.5s ease forwards;
  }
  @keyframes etcFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Mobile */
  @media (max-width: 480px) {
    .etc-login-root { padding: 20px 16px; }
    .etc-card {
      padding: 36px;
      border-radius: 20px;
    }
    .etc-logo { height: 44px; }
    .etc-headline { font-size: 22px; }
    .etc-subtext { font-size: 13px; }
    .etc-discord-btn { min-height: 52px; height: 52px; }
    .etc-pill { font-size: 12px; }
    .etc-orb-1 { width: 320px; height: 320px; }
    .etc-orb-2 { width: 360px; height: 360px; }
    .etc-orb-3 { width: 220px; height: 220px; }
  }
`;
