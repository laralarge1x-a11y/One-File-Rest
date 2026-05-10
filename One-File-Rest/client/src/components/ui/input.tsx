import React, { forwardRef } from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] px-3.5 py-2.5 text-sm',
            'placeholder:text-[var(--text-muted)] transition-all duration-200',
            'focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-glow)] focus:bg-[var(--bg-glass-hover)]',
            error && 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_rgba(237,66,69,0.3)]',
            icon && 'pl-10',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';