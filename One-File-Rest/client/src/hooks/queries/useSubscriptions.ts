import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useSubscription() {
  return useQuery<any>({
    queryKey: ['subscription'],
    queryFn: () => fetchJson('/api/subscriptions/me'),
  });
}

export function useSubscriptionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: any }) =>
      fetch(`/api/subscriptions/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => {
        if (!r.ok) throw new Error('Action failed');
        return r.json();
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  });
}