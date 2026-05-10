import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Case {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  priority: string;
  appeal_deadline: string;
  created_at: string;
  updated_at?: string;
  outcome?: string | null;
  violation_description?: string;
  stage?: string;
  staff_name?: string;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useCases() {
  return useQuery<Case[]>({
    queryKey: ['cases'],
    queryFn: () => fetchJson('/api/cases'),
  });
}

export function useCase(id: number | string | undefined) {
  return useQuery<any>({
    queryKey: ['case', id],
    queryFn: () => fetchJson(`/api/cases/${id}`),
    enabled: !!id,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetch('/api/cases', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to create case');
        return r.json();
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cases'] }),
  });
}

export function useUploadEvidence() {
  return useMutation({
    mutationFn: (body: any) =>
      fetch('/api/evidence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to upload evidence');
        return r.json();
      }),
  });
}