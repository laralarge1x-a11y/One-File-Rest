import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; type: ToastType; message: string; }
interface Ctx { toast: (message: string, type?: ToastType) => void; }

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) return { toast: (m: string) => console.log('[toast]', m) };
  return ctx;
}

const COLOR: Record<ToastType, { bg: string; border: string; fg: string; icon: string }> = {
  success: { bg: 'rgba(87,242,135,0.10)', border: 'rgba(87,242,135,0.35)', fg: '#57F287', icon: '✓' },
  error:   { bg: 'rgba(237,66,69,0.10)',  border: 'rgba(237,66,69,0.35)',  fg: '#ED4245', icon: '✕' },
  info:    { bg: 'rgba(88,101,242,0.10)', border: 'rgba(88,101,242,0.35)', fg: '#5865F2', icon: 'i' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', zIndex: 9999, pointerEvents: 'none',
        top: 'env(safe-area-inset-top, 16px)', right: 16,
        display: 'flex', flexDirection: 'column', gap: 10,
        maxWidth: 360,
      }} className="toast-root">
        <AnimatePresence>
          {items.map((t) => {
            const c = COLOR[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.25 }}
                style={{
                  pointerEvents: 'auto',
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  color: c.fg,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13, fontWeight: 500,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: c.fg, color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, flexShrink: 0,
                }}>{c.icon}</div>
                <span style={{ color: 'var(--text-primary)' }}>{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .toast-root { top: auto !important; right: 12px !important; left: 12px !important; bottom: calc(var(--bottomnav-h) + 16px); max-width: none !important; }
        }
      `}</style>
    </ToastCtx.Provider>
  );
}
