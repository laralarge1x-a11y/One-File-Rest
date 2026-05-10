import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  count?: number;
  height?: number | string;
  width?: number | string;
  borderRadius?: string;
}

export function Skeleton({ className, count = 1, height = 16, width = '100%', borderRadius = 'var(--radius-sm)' }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={clsx('skeleton', className)}
          style={{
            height,
            width,
            borderRadius,
            marginBottom: i < count - 1 ? 8 : 0,
          }}
        />
      ))}
    </>
  );
}

export function CardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--border)] p-5 bg-[var(--bg-glass)]">
          <Skeleton height={14} width="40%" />
          <Skeleton height={24} width="70%" className="mt-3" />
          <Skeleton height={14} width="55%" className="mt-2" />
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <Skeleton height={12} width="30%" />
          </div>
        </div>
      ))}
    </>
  );
}