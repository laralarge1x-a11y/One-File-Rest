import { useQuery } from '@tanstack/react-query';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function usePolicyAlerts() {
  return useQuery<any[]>({
    queryKey: ['policy-alerts'],
    queryFn: () => fetchJson('/api/policies'),
  });
}