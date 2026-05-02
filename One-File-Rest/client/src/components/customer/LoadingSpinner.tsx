import React from 'react';

interface Props { size?: number; label?: string; fullScreen?: boolean; }

export default function LoadingSpinner({ size = 48, label, fullScreen }: Props) {
  const spinner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, transparent 0%, var(--accent) 100%)',
          maskImage: 'radial-gradient(circle, transparent 55%, black 56%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 55%, black 56%)',
          animation: 'spinDot 0.9s linear infinite',
          filter: 'drop-shadow(0 0 10px var(--accent-glow))',
        }} />
      </div>
      {label && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{label}</div>}
    </div>
  );
  if (fullScreen) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {spinner}
    </div>
  );
  return spinner;
}
