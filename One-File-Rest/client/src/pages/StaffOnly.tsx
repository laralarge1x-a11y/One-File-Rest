// Friendly screen shown when a non-staff account opens the admin APK.
// The native app only exposes the admin portal, so we hard-block client
// users with a clear "use the website" message instead of a 404.
import React from 'react';

const StaffOnly: React.FC = () => {
  const portalUrl = window.location.origin.replace(/^capacitor:\/\//, 'https://');
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'linear-gradient(160deg, #0a0a0a 0%, #1a1633 100%)',
      color: '#fff',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🛡️</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          Staff-only app
        </h1>
        <p style={{ color: '#bbb', lineHeight: 1.6, marginBottom: 24 }}>
          The Elite Tok Admin app is reserved for our staff and case
          managers. Your client portal lives on the website — please open it
          there to manage your cases.
        </p>
        <a
          href={portalUrl}
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            borderRadius: 12,
            background: '#5865F2',
            color: '#fff',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Open client portal
        </a>
        <button
          onClick={() => fetch('/auth/logout', { credentials: 'include' }).then(() => window.location.reload())}
          style={{
            display: 'block',
            margin: '20px auto 0',
            padding: '8px 16px',
            background: 'transparent',
            color: '#888',
            border: '1px solid #333',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default StaffOnly;
