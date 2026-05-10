import { useQuery } from '@tanstack/react-query';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useKbArticles(params?: { q?: string; category?: string }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.category) sp.set('category', params.category);
  const qs = sp.toString();
  return useQuery<any[]>({
    queryKey: ['kb', params],
    queryFn: () => fetchJson(`/api/kb${qs ? `?${qs}` : ''}`),
  });
}

export function useKbCategories() {
  return useQuery<any[]>({
    queryKey: ['kb-categories'],
    queryFn: () => fetchJson('/api/kb/categories'),
  });
}

export function useKbArticle(slug: string | undefined) {
  return useQuery<any>({
    queryKey: ['kb', slug],
    queryFn: () => fetchJson(`/api/kb/${slug}`),
    enabled: !!slug,
  });
}