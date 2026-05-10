import React from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  glowing?: boolean;
  glowColor?: string;
  noHover?: boolean;
  style?: React.CSSProperties;
}

export function Card({ className, children, onClick, glowing, glowColor, noHover, style }: CardProps) {
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={style}
      className={clsx(
        'rounded-[var(--radius-lg)] backdrop-blur-md transition-all duration-200',
        'bg-[var(--bg-glass)] border border-[var(--border)]',
        glowing && `shadow-[0_0_40px_${glowColor || 'var(--accent-glow)'}]`,
        !glowing && 'shadow-[var(--shadow-card)]',
        interactive && 'cursor-pointer',
        !noHover && interactive && 'hover:border-[rgba(255,255,255,0.15)] hover:scale-[1.005]',
        interactive && 'active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('px-5 pt-5 pb-3', className)}>{children}</div>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('px-5 pb-5', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('px-5 py-3 border-t border-[var(--border)]', className)}>{children}</div>;
}