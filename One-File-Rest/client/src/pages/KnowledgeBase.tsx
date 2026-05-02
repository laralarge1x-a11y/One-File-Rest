import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Article {
  id: number;
  slug: string;
  title: string;
  category: string | null;
  tags: string[];
  excerpt: string;
  view_count: number;
  updated_at: string;
}

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [cats, setCats] = useState<Array<{ category: string; count: number }>>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cat) params.set('category', cat);
    fetch(`/api/kb?${params}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then(setArticles)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch('/api/kb/categories', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then(setCats);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q, cat]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 100px', color: '#fff' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Knowledge Base</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        Guides, policy explainers, and tactical playbooks.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search articles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '10px 14px',
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
          }}
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{
          padding: '10px 14px', background: 'var(--bg-glass)',
          border: '1px solid var(--border)', borderRadius: 8, color: '#fff', fontSize: 14,
        }}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : articles.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          No articles found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {articles.map((a) => (
            <Link key={a.id} to={`/kb/${a.slug}`} style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              background: 'var(--bg-glass)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 16,
              transition: 'var(--transition)',
            }}>
              {a.category && (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#5865F2', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                  {a.category}
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {a.excerpt?.replace(/[#*`]/g, '').slice(0, 140)}
                {(a.excerpt?.length || 0) > 140 ? '…' : ''}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(a.tags || []).slice(0, 3).map((t) => (
                  <span key={t} style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: 'var(--text-muted)' }}>{t}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
