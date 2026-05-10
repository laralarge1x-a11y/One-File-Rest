import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useStaff() {
  return useQuery<any[]>({
    queryKey: ['staff-public'],
    queryFn: () => fetchJson('/api/staff-public'),
  });
}

export function useFavoriteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ discordId, favorited }: { discordId: string; favorited: boolean }) =>
      fetch(`/api/staff-public/${discordId}/favorite`, {
        method: favorited ? 'DELETE' : 'POST',
        credentials: 'include',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-public'] }),
  });
}