// Active TikTok account context (cookie-light: localStorage + custom event)
import { useEffect, useState, useCallback } from 'react';

export interface TiktokAccount {
  id: number;
  username: string;
  account_url?: string | null;
  is_primary: boolean;
  notes?: string | null;
  active_cases?: number;
}

const KEY = 'etc.activeAccount';

export function getActiveAccountId(): number | null {
  const v = localStorage.getItem(KEY);
  return v ? parseInt(v) : null;
}

export function setActiveAccountId(id: number | null) {
  if (id === null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, String(id));
  window.dispatchEvent(new CustomEvent('accounts:active-changed', { detail: { id } }));
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<TiktokAccount[]>([]);
  const [activeId, setActiveId] = useState<number | null>(getActiveAccountId());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/accounts', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setAccounts(data);
        if (activeId === null && data.length > 0) {
          const primary = data.find((a: TiktokAccount) => a.is_primary) || data[0];
          setActiveAccountId(primary.id);
          setActiveId(primary.id);
        } else if (activeId !== null && !data.some((a: TiktokAccount) => a.id === activeId)) {
          // selected account got deleted
          const fallback = data[0]?.id ?? null;
          setActiveAccountId(fallback);
          setActiveId(fallback);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = (e: any) => setActiveId(e.detail?.id ?? null);
    window.addEventListener('accounts:active-changed', handler as any);
    return () => window.removeEventListener('accounts:active-changed', handler as any);
  }, []);

  const setActive = (id: number | null) => { setActiveAccountId(id); setActiveId(id); };
  const active = accounts.find((a) => a.id === activeId) || null;

  return { accounts, active, activeId, loading, setActive, refresh };
}
