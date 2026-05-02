import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glowing?: boolean;
  glowColor?: string;
  style?: React.CSSProperties;
  noHover?: boolean;
  ariaLabel?: string;
}

export default function GlassCard({ children, className, onClick, glowing, glowColor, style, noHover, ariaLabel }: Props) {
  const interactive = !!onClick;
  const baseStyle: React.CSSProperties = {
    background: 'var(--bg-glass)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: glowing ? `0 0 40px ${glowColor || 'var(--accent-glow)'}, var(--shadow-card)` : 'var(--shadow-card)',
    transition: 'var(--transition)',
    cursor: interactive ? 'pointer' : 'default',
    ...style,
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      className={className}
      style={baseStyle}
      onClick={onClick}
      onKeyDown={interactive ? handleKey : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      whileHover={noHover ? undefined : { scale: 1.005, borderColor: 'rgba(255,255,255,0.15)' as any }}
      whileTap={interactive ? { scale: 0.99 } : undefined}
    >
      {children}
    </motion.div>
  );
}
