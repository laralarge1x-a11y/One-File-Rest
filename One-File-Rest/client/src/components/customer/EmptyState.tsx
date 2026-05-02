import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}
    >
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--bg-glass)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18, color: 'var(--text-muted)', fontSize: 32,
      }}>
        {icon || '✨'}
      </div>
      <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{title}</h3>
      {subtitle && <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 14, maxWidth: 380 }}>{subtitle}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary" style={{ marginTop: 20 }}>
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
