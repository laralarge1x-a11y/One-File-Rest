import { useQuery } from '@tanstack/react-query';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useCompliance(caseId?: number) {
  return useQuery<any>({
    queryKey: ['compliance', caseId],
    queryFn: () => fetchJson(`/api/cases/${caseId}`),
    enabled: !!caseId,
    select: (data: any) => data?.complianceScore ?? null,
  });
}