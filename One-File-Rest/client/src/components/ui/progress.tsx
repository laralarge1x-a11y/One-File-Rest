import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  glowColor?: string;
}

export function Progress({ value, max = 100, className, barClassName, glowColor }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={clsx('h-2 rounded-full overflow-hidden bg-[var(--bg-glass)]', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className={clsx('h-full rounded-full', barClassName)}
        style={{
          background: glowColor
            ? `linear-gradient(90deg, var(--accent), ${glowColor})`
            : 'linear-gradient(90deg, var(--accent), var(--accent-light))',
          boxShadow: glowColor ? `0 0 12px ${glowColor}` : '0 0 12px var(--accent-glow)',
        }}
      />
    </div>
  );
}