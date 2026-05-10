import { useQuery } from '@tanstack/react-query';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useNotifications() {
  return useQuery<{ notifications: any[]; unread: number }>({
    queryKey: ['notifications'],
    queryFn: () => fetchJson('/api/notifications'),
    refetchInterval: 60_000,
  });
}