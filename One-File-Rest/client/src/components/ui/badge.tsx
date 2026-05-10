import React from 'react';
import clsx from 'clsx';

const variantStyles: Record<string, string> = {
  default: 'bg-[var(--bg-glass)] text-[var(--text-primary)] border-[var(--border)]',
  success: 'bg-[rgba(87,242,135,0.12)] text-[#57F287] border-[rgba(87,242,135,0.3)]',
  warning: 'bg-[rgba(250,166,26,0.12)] text-[#FAA61A] border-[rgba(250,166,26,0.3)]',
  danger: 'bg-[rgba(237,66,69,0.12)] text-[#ED4245] border-[rgba(237,66,69,0.3)]',
  info: 'bg-[rgba(88,101,242,0.12)] text-[#5865F2] border-[rgba(88,101,242,0.3)]',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

interface BadgeProps {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', size = 'md', className, children }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-semibold rounded-full border',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  );
}