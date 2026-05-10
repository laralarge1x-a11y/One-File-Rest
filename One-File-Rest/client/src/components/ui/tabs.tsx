import React, { useState } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface TabsProps {
  tabs: Array<{ key: string; label: string; count?: number }>;
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={clsx('flex border-b border-[var(--border)]', className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={clsx(
              'relative px-4 py-3 text-sm font-semibold transition-colors duration-200',
              isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={clsx(
                'ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full',
                isActive ? 'bg-[rgba(255,255,255,0.12)]' : 'bg-[var(--bg-glass)]',
              )}>
                {tab.count}
              </span>
            )}
            {isActive && (
              <motion.span
                layoutId="tab-underline"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)] rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabContentProps {
  active: string;
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabContent({ active, value, children, className }: TabContentProps) {
  return (
    <AnimatePresence mode="wait">
      {active === value && (
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}