import React from 'react';
import clsx from 'clsx';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 32, className }: AvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        loading="lazy"
        className={clsx('rounded-full object-cover border border-[var(--border)]', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-bold text-white bg-[var(--accent)]',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={name || 'User avatar'}
    >
      {initial}
    </div>
  );
}